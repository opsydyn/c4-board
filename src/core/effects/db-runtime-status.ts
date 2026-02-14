import { invoke } from "@tauri-apps/api/core";
import { Match, Schema } from "effect";
import type { SqliteErrorClass } from "./sqlite-error-class";

export const DATABASE_RUNTIME_STATUS_EVENT_NAME = "opsydyn:db_runtime:status";

const RuntimeStatusSchema = Schema.Literal("booting", "online", "degraded", "offline");
const RuntimeErrorClassSchema = Schema.Literal(
  "locked",
  "busy",
  "transaction-state",
  "non-retryable",
);

export const DatabaseRuntimeStatusSchema = Schema.Struct({
  status: RuntimeStatusSchema,
  pendingWrites: Schema.Number,
  activeWrites: Schema.Number,
  lockRetries: Schema.Number,
  lastSuccessAt: Schema.NullOr(Schema.Number),
  lastFailureAt: Schema.NullOr(Schema.Number),
  lastErrorMessage: Schema.NullOr(Schema.String),
  lastErrorClass: Schema.NullOr(RuntimeErrorClassSchema),
  lastDurationMs: Schema.NullOr(Schema.Number),
  avgDurationMs: Schema.NullOr(Schema.Number),
  journalMode: Schema.String,
  maxConnections: Schema.Number,
  busyTimeoutMs: Schema.NullOr(Schema.Number),
  foreignKeysEnabled: Schema.NullOr(Schema.Boolean),
  synchronousMode: Schema.NullOr(Schema.String),
  dbFileSizeBytes: Schema.NullOr(Schema.Number),
  dbFileSizeMb: Schema.NullOr(Schema.Number),
  walFileSizeBytes: Schema.NullOr(Schema.Number),
  walFileSizeMb: Schema.NullOr(Schema.Number),
  probeLastUpdatedAt: Schema.NullOr(Schema.Number),
  probeError: Schema.NullOr(Schema.String),
});

export type DatabaseRuntimeStatus = Schema.Schema.Type<typeof DatabaseRuntimeStatusSchema>;
export type DatabaseOperationKind = "query" | "execute";

export const DatabaseRuntimeProbeSchema = Schema.Struct({
  journal_mode: Schema.String,
  foreign_keys: Schema.Boolean,
  busy_timeout_ms: Schema.Number,
  synchronous_mode: Schema.String,
  max_connections: Schema.Number,
  db_file_size_bytes: Schema.optional(Schema.NullOr(Schema.Number)),
  db_file_size_mb: Schema.optional(Schema.NullOr(Schema.Number)),
  wal_file_size_bytes: Schema.optional(Schema.NullOr(Schema.Number)),
  wal_file_size_mb: Schema.optional(Schema.NullOr(Schema.Number)),
});

type DatabaseRuntimeProbe = Schema.Schema.Type<typeof DatabaseRuntimeProbeSchema>;

interface OperationState {
  kind: DatabaseOperationKind;
  startedAt: number;
  retryCount: number;
}

interface WriteRequestState {
  acquired: boolean;
}

const decodeDatabaseRuntimeStatus = Schema.decodeUnknownSync(DatabaseRuntimeStatusSchema);
const decodeDatabaseRuntimeProbe = Schema.decodeUnknownSync(DatabaseRuntimeProbeSchema);

let runtimeProbeRefresh: Promise<void> | null = null;

let snapshot: DatabaseRuntimeStatus = {
  status: "booting",
  pendingWrites: 0,
  activeWrites: 0,
  lockRetries: 0,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastErrorMessage: null,
  lastErrorClass: null,
  lastDurationMs: null,
  avgDurationMs: null,
  journalMode: "wal",
  maxConnections: 1,
  busyTimeoutMs: null,
  foreignKeysEnabled: null,
  synchronousMode: null,
  dbFileSizeBytes: null,
  dbFileSizeMb: null,
  walFileSizeBytes: null,
  walFileSizeMb: null,
  probeLastUpdatedAt: null,
  probeError: null,
};

const listeners = new Set<() => void>();

const operationStateById = new Map<number, OperationState>();
let nextOperationId = 1;

const writeRequestById = new Map<number, WriteRequestState>();
let nextWriteRequestId = 1;

const toErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

const sqliteClassToLabel = (
  errorClass: SqliteErrorClass,
): DatabaseRuntimeStatus["lastErrorClass"] =>
  Match.value(errorClass).pipe(
    Match.tag("Locked", () => "locked" as const),
    Match.tag("Busy", () => "busy" as const),
    Match.tag("TransactionState", () => "transaction-state" as const),
    Match.tag("NonRetryable", () => "non-retryable" as const),
    Match.exhaustive,
  );

const isLockContentionClass = (errorClass: SqliteErrorClass): boolean =>
  Match.value(errorClass).pipe(
    Match.tag("Locked", () => true),
    Match.tag("Busy", () => true),
    Match.tag("TransactionState", () => false),
    Match.tag("NonRetryable", () => false),
    Match.exhaustive,
  );

const emitSnapshot = (): void => {
  for (const listener of listeners) {
    listener();
  }

  if (
    typeof window !== "undefined"
    && typeof window.dispatchEvent === "function"
  ) {
    window.dispatchEvent(
      new CustomEvent(DATABASE_RUNTIME_STATUS_EVENT_NAME, {
        detail: snapshot,
      }),
    );
  }
};

const setSnapshot = (
  updater: (current: DatabaseRuntimeStatus) => DatabaseRuntimeStatus,
): void => {
  snapshot = decodeDatabaseRuntimeStatus(updater(snapshot));
  emitSnapshot();
};

export const getDatabaseRuntimeStatusSnapshot = (): DatabaseRuntimeStatus => snapshot;

export const subscribeDatabaseRuntimeStatus = (
  listener: () => void,
): () => void => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const markDatabaseRuntimeBootstrapped = (): void => {
  setSnapshot((current) =>
    current.status === "booting"
      ? {
        ...current,
        status: "online",
      }
      : current
  );
};

export const markDatabaseRuntimeBootstrapFailure = (error: unknown): void => {
  const now = Date.now();
  setSnapshot((current) => ({
    ...current,
    status: "offline",
    lastFailureAt: now,
    lastErrorMessage: toErrorMessage(error),
    lastErrorClass: "non-retryable",
  }));
};

export const beginDatabaseRuntimeWriteRequest = (): number => {
  const requestId = nextWriteRequestId++;
  writeRequestById.set(requestId, { acquired: false });

  setSnapshot((current) => ({
    ...current,
    pendingWrites: current.pendingWrites + 1,
  }));

  return requestId;
};

export const markDatabaseRuntimeWriteRequestAcquired = (
  requestId: number,
): void => {
  const request = writeRequestById.get(requestId);
  if (!request || request.acquired) {
    return;
  }

  request.acquired = true;
  setSnapshot((current) => ({
    ...current,
    activeWrites: current.activeWrites + 1,
  }));
};

export const completeDatabaseRuntimeWriteRequest = (requestId: number): void => {
  const request = writeRequestById.get(requestId);
  if (!request) {
    return;
  }

  writeRequestById.delete(requestId);

  setSnapshot((current) => ({
    ...current,
    pendingWrites: Math.max(0, current.pendingWrites - 1),
    activeWrites: request.acquired
      ? Math.max(0, current.activeWrites - 1)
      : current.activeWrites,
  }));
};

export const beginDatabaseRuntimeOperation = (
  kind: DatabaseOperationKind,
): number => {
  const operationId = nextOperationId++;
  operationStateById.set(operationId, {
    kind,
    startedAt: Date.now(),
    retryCount: 0,
  });
  return operationId;
};

export const recordDatabaseRuntimeRetry = (
  operationId: number,
  errorClass: SqliteErrorClass,
  error: unknown,
): void => {
  const operationState = operationStateById.get(operationId);
  if (!operationState) {
    return;
  }

  operationState.retryCount += 1;

  const lockContention = isLockContentionClass(errorClass);
  setSnapshot((current) => ({
    ...current,
    status: current.status === "offline" ? "offline" : "degraded",
    lockRetries: lockContention ? current.lockRetries + 1 : current.lockRetries,
    lastErrorMessage: toErrorMessage(error),
    lastErrorClass: sqliteClassToLabel(errorClass),
  }));
};

export const completeDatabaseRuntimeOperationSuccess = (
  operationId: number,
): void => {
  const operationState = operationStateById.get(operationId);
  if (!operationState) {
    return;
  }

  operationStateById.delete(operationId);
  const now = Date.now();
  const durationMs = Math.max(0, now - operationState.startedAt);

  setSnapshot((current) => ({
    ...current,
    status: "online",
    lastSuccessAt: now,
    lastDurationMs: durationMs,
    avgDurationMs: current.avgDurationMs === null
      ? durationMs
      : Math.round((current.avgDurationMs * 4 + durationMs) / 5),
    lastErrorMessage: null,
    lastErrorClass: null,
  }));
};

export const failDatabaseRuntimeOperation = (
  operationId: number,
  errorClass: SqliteErrorClass,
  error: unknown,
): void => {
  const operationState = operationStateById.get(operationId);
  const now = Date.now();
  const durationMs = operationState
    ? Math.max(0, now - operationState.startedAt)
    : 0;

  if (operationState) {
    operationStateById.delete(operationId);
  }

  setSnapshot((current) => ({
    ...current,
    status: isLockContentionClass(errorClass) ? "degraded" : "offline",
    lastFailureAt: now,
    lastDurationMs: durationMs,
    lastErrorMessage: toErrorMessage(error),
    lastErrorClass: sqliteClassToLabel(errorClass),
  }));
};

export const applyDatabaseRuntimeProbe = (probe: DatabaseRuntimeProbe): void => {
  const now = Date.now();
  const normalizedJournalMode = probe.journal_mode.trim().toLowerCase();
  const normalizedSynchronous = probe.synchronous_mode.trim().toLowerCase();

  setSnapshot((current) => ({
    ...current,
    journalMode: normalizedJournalMode.length > 0
      ? normalizedJournalMode
      : current.journalMode,
    maxConnections: probe.max_connections,
    busyTimeoutMs: probe.busy_timeout_ms,
    foreignKeysEnabled: probe.foreign_keys,
    synchronousMode: normalizedSynchronous.length > 0
      ? normalizedSynchronous
      : null,
    dbFileSizeBytes: probe.db_file_size_bytes ?? null,
    dbFileSizeMb: probe.db_file_size_mb ?? null,
    walFileSizeBytes: probe.wal_file_size_bytes ?? null,
    walFileSizeMb: probe.wal_file_size_mb ?? null,
    probeLastUpdatedAt: now,
    probeError: null,
  }));
};

export const refreshDatabaseRuntimeProbe = (): Promise<void> => {
  if (runtimeProbeRefresh) {
    return runtimeProbeRefresh;
  }

  runtimeProbeRefresh = invoke("db_runtime_probe")
    .then((payload) => {
      const probe = decodeDatabaseRuntimeProbe(payload);
      applyDatabaseRuntimeProbe(probe);
    })
    .catch((error) => {
      const now = Date.now();
      setSnapshot((current) => ({
        ...current,
        probeLastUpdatedAt: now,
        probeError: toErrorMessage(error),
      }));
    })
    .finally(() => {
      runtimeProbeRefresh = null;
    });

  return runtimeProbeRefresh;
};
