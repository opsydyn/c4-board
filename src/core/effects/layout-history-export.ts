import { pipe, Schema } from "effect";
import { LAYOUT_AUDIT_RETENTION_LIMIT, type LayoutApplicationAudit } from "./layout.types";

const NonNegativeIntegerSchema = pipe(
  Schema.Number,
  Schema.filter((value) => Number.isInteger(value) && value >= 0, {
    message: () => "Expected a non-negative integer",
  }),
);

const FiniteNumberSchema = pipe(
  Schema.Number,
  Schema.filter(Number.isFinite, { message: () => "Expected a finite number" }),
);

export const LayoutApplicationAuditSchema = Schema.Struct({
  version: Schema.Literal(1),
  appliedAt: NonNegativeIntegerSchema,
  preset: Schema.String,
  strategyId: Schema.String,
  engine: Schema.Literal("dagre", "elk", "custom"),
  selectedVariant: Schema.Literal("single", "original", "recommended"),
  comparisonMetrics: Schema.Array(Schema.Struct({
    key: Schema.Literal("overlaps", "canvasArea", "routedCrossings", "routedLength"),
    original: FiniteNumberSchema,
    recommended: FiniteNumberSchema,
    favored: Schema.Literal("original", "recommended", "tie"),
  })),
});

type SummarizedAudit = Pick<LayoutApplicationAudit, "appliedAt" | "engine" | "selectedVariant">;

const summarizeAudits = (audits: ReadonlyArray<SummarizedAudit>) => {
  const sorted = [...audits].sort((left, right) => right.appliedAt - left.appliedAt);
  return {
    applicationCount: sorted.length,
    firstAppliedAt: sorted.at(-1)?.appliedAt ?? null,
    lastAppliedAt: sorted[0]?.appliedAt ?? null,
    variants: {
      single: sorted.filter((audit) => audit.selectedVariant === "single").length,
      original: sorted.filter((audit) => audit.selectedVariant === "original").length,
      recommended: sorted.filter((audit) => audit.selectedVariant === "recommended").length,
    },
    engines: {
      dagre: sorted.filter((audit) => audit.engine === "dagre").length,
      elk: sorted.filter((audit) => audit.engine === "elk").length,
      custom: sorted.filter((audit) => audit.engine === "custom").length,
    },
  };
};

const LayoutHistorySummarySchema = Schema.Struct({
  applicationCount: NonNegativeIntegerSchema,
  firstAppliedAt: Schema.NullOr(NonNegativeIntegerSchema),
  lastAppliedAt: Schema.NullOr(NonNegativeIntegerSchema),
  variants: Schema.Struct({
    single: NonNegativeIntegerSchema,
    original: NonNegativeIntegerSchema,
    recommended: NonNegativeIntegerSchema,
  }),
  engines: Schema.Struct({
    dagre: NonNegativeIntegerSchema,
    elk: NonNegativeIntegerSchema,
    custom: NonNegativeIntegerSchema,
  }),
});

const Sha256HexSchema = pipe(
  Schema.String,
  Schema.filter((value) => /^[a-f0-9]{64}$/.test(value), {
    message: () => "Expected a lowercase SHA-256 hex digest",
  }),
);

export const LayoutHistoryArtifactSchema = pipe(
  Schema.Struct({
    schema: Schema.Literal("opsydyn.layout-history"),
    version: Schema.Literal(2),
    exportedAt: NonNegativeIntegerSchema,
    diagram: Schema.Struct({
      id: Schema.String,
      name: Schema.String,
    }),
    retention: Schema.Struct({
      limit: Schema.Literal(LAYOUT_AUDIT_RETENTION_LIMIT),
      exportedCount: NonNegativeIntegerSchema,
    }),
    summary: LayoutHistorySummarySchema,
    audits: Schema.Array(LayoutApplicationAuditSchema),
    fingerprint: Schema.Struct({
      algorithm: Schema.Literal("SHA-256"),
      value: Sha256HexSchema,
    }),
  }),
  Schema.filter(
    (artifact) =>
      artifact.retention.exportedCount === artifact.audits.length
      && artifact.audits.length <= LAYOUT_AUDIT_RETENTION_LIMIT
      && JSON.stringify(artifact.summary) === JSON.stringify(summarizeAudits(artifact.audits)),
    { message: () => "Export count and summary must match retained audit history" },
  ),
);

export type LayoutHistoryArtifact = Schema.Schema.Type<typeof LayoutHistoryArtifactSchema>;

export const validateLayoutHistoryArtifact = Schema.decodeUnknownSync(LayoutHistoryArtifactSchema);

export interface BuildLayoutHistoryArtifactInput {
  diagramId: string;
  diagramName: string;
  exportedAt: number;
  audits: ReadonlyArray<LayoutApplicationAudit>;
}

const canonicalize = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${
    Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`).join(",")
  }}`;
};

const fingerprintPayload = (artifact: LayoutHistoryArtifact) => {
  const { fingerprint: _fingerprint, ...payload } = artifact;
  return payload;
};

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

export const buildLayoutHistoryArtifact = async (
  input: BuildLayoutHistoryArtifactInput,
): Promise<LayoutHistoryArtifact> => {
  const audits = [...input.audits].sort((left, right) => right.appliedAt - left.appliedAt);
  const unsigned = {
    schema: "opsydyn.layout-history",
    version: 2,
    exportedAt: input.exportedAt,
    diagram: {
      id: input.diagramId,
      name: input.diagramName,
    },
    retention: {
      limit: LAYOUT_AUDIT_RETENTION_LIMIT,
      exportedCount: input.audits.length,
    },
    summary: summarizeAudits(audits),
    audits,
  } as const;
  const value = await sha256Hex(canonicalize(unsigned));
  return validateLayoutHistoryArtifact({
    ...unsigned,
    fingerprint: { algorithm: "SHA-256", value },
  });
};

export const verifyLayoutHistoryArtifactFingerprint = async (
  input: unknown,
): Promise<boolean> => {
  try {
    const artifact = validateLayoutHistoryArtifact(input);
    const expected = await sha256Hex(canonicalize(fingerprintPayload(artifact)));
    return expected === artifact.fingerprint.value;
  } catch {
    return false;
  }
};

export const serializeLayoutHistoryArtifact = (artifact: LayoutHistoryArtifact): string =>
  `${JSON.stringify(validateLayoutHistoryArtifact(artifact), null, 2)}\n`;

export const createLayoutHistoryFilename = (diagramName: string): string => {
  const slug = diagramName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${slug || "diagram"}-layout-history.json`;
};
