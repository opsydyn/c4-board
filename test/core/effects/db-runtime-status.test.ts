import {
  DatabaseRuntimeProbeSchema,
  DatabaseRuntimeStatusSchema,
} from "@/core/effects/db-runtime-status";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

describe("db-runtime-status schemas", () => {
  it("decodes runtime probe payload including db size fields", () => {
    const decoded = Schema.decodeUnknownSync(DatabaseRuntimeProbeSchema)({
      journal_mode: "wal",
      foreign_keys: true,
      busy_timeout_ms: 5_000,
      synchronous_mode: "normal",
      max_connections: 1,
      db_file_size_bytes: 2_621_440,
      db_file_size_mb: 2.5,
      wal_file_size_bytes: 131_072,
      wal_file_size_mb: 0.13,
    });

    expect(decoded.db_file_size_bytes).toBe(2_621_440);
    expect(decoded.db_file_size_mb).toBe(2.5);
    expect(decoded.wal_file_size_bytes).toBe(131_072);
    expect(decoded.wal_file_size_mb).toBe(0.13);
  });

  it("accepts null db size values for missing files", () => {
    const decoded = Schema.decodeUnknownSync(DatabaseRuntimeProbeSchema)({
      journal_mode: "wal",
      foreign_keys: true,
      busy_timeout_ms: 5_000,
      synchronous_mode: "normal",
      max_connections: 1,
      db_file_size_bytes: null,
      db_file_size_mb: null,
      wal_file_size_bytes: null,
      wal_file_size_mb: null,
    });

    expect(decoded.db_file_size_bytes).toBeNull();
    expect(decoded.db_file_size_mb).toBeNull();
    expect(decoded.wal_file_size_bytes).toBeNull();
    expect(decoded.wal_file_size_mb).toBeNull();
  });

  it("accepts probe payloads that omit new size fields", () => {
    const decoded = Schema.decodeUnknownSync(DatabaseRuntimeProbeSchema)({
      journal_mode: "wal",
      foreign_keys: true,
      busy_timeout_ms: 5_000,
      synchronous_mode: "normal",
      max_connections: 1,
    });

    expect(decoded.db_file_size_bytes).toBeUndefined();
    expect(decoded.db_file_size_mb).toBeUndefined();
    expect(decoded.wal_file_size_bytes).toBeUndefined();
    expect(decoded.wal_file_size_mb).toBeUndefined();
  });

  it("requires numeric db size values when present", () => {
    expect(() =>
      Schema.decodeUnknownSync(DatabaseRuntimeStatusSchema)({
        status: "online",
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
        busyTimeoutMs: 5_000,
        foreignKeysEnabled: true,
        synchronousMode: "normal",
        dbFileSizeBytes: "invalid",
        dbFileSizeMb: null,
        walFileSizeBytes: null,
        walFileSizeMb: null,
        probeLastUpdatedAt: null,
        probeError: null,
      })
    ).toThrow();
  });
});
