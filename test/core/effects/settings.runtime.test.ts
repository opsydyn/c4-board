import { DatabaseError, DatabaseService } from "@/core/effects/database.base";
import { getSettings, patchSettings, resetSettings } from "@/core/effects/settings.runtime";
import { APP_SETTING_KEYS, DEFAULT_APP_SETTINGS } from "@/core/effects/settings.types";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

interface Row {
  key: string;
  value: string;
  updated_at: number;
}

interface InMemorySettingsDb {
  readonly service: {
    readonly query: <T>(sql: string, bindValues?: unknown[]) => Effect.Effect<T[], DatabaseError>;
    readonly execute: (sql: string, bindValues?: unknown[]) => Effect.Effect<void, DatabaseError>;
    readonly transaction: <A, E, R>(
      effect: Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E | DatabaseError, R>;
  };
  readonly state: {
    rows: Map<string, Row>;
    executeCount: number;
    transactionCount: number;
  };
}

const UPSERT_SQL_KEYWORD = "INSERT INTO app_settings";

const makeInMemorySettingsDb = (seedRows: ReadonlyArray<Row> = []): InMemorySettingsDb => {
  const rows = new Map<string, Row>(
    seedRows.map((row) => [row.key, row]),
  );
  const state = {
    rows,
    executeCount: 0,
    transactionCount: 0,
  };

  const service: InMemorySettingsDb["service"] = {
    query: <T>(sql: string) =>
      Effect.sync(() => {
        if (sql.includes("SELECT key, value, updated_at")) {
          return Array.from(state.rows.values()) as T[];
        }

        throw new DatabaseError({
          message: "Unsupported query in test double",
          cause: sql,
        });
      }),
    execute: (sql: string, bindValues?: unknown[]) =>
      Effect.sync(() => {
        state.executeCount += 1;

        if (!sql.includes(UPSERT_SQL_KEYWORD)) {
          throw new DatabaseError({
            message: "Unsupported execute in test double",
            cause: sql,
          });
        }

        const [key, value, updatedAt] = bindValues ?? [];

        if (typeof key !== "string") {
          throw new DatabaseError({
            message: "Invalid key bind value",
            cause: bindValues,
          });
        }

        state.rows.set(key, {
          key,
          value: String(value),
          updated_at: Number(updatedAt ?? Date.now()),
        });
      }),
    transaction: (effect) =>
      Effect.sync(() => {
        state.transactionCount += 1;
      }).pipe(Effect.flatMap(() => effect)),
  };

  return {
    service,
    state,
  };
};

const runWithService = <A, E>(
  effect: Effect.Effect<A, E, DatabaseService>,
  service: InMemorySettingsDb["service"],
): Promise<A> => Effect.runPromise(effect.pipe(Effect.provideService(DatabaseService, service)));

describe("settings.runtime", () => {
  it("hydrates defaults when app_settings is empty", async () => {
    const db = makeInMemorySettingsDb();
    const settings = await runWithService(getSettings(), db.service);
    expect(settings).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("patches only changed keys and keeps all defaults", async () => {
    const db = makeInMemorySettingsDb();
    await runWithService(resetSettings(), db.service);
    const executeBefore = db.state.executeCount;

    const patched = await runWithService(
      patchSettings({
        autosaveIntervalMs: 2_500,
        saveOnNavigate: false,
        bigBallOfMudAlertThreshold: 7.6,
      }),
      db.service,
    );

    expect(patched.autosaveIntervalMs).toBe(2_500);
    expect(patched.saveOnNavigate).toBe(false);
    expect(patched.bigBallOfMudAlertThreshold).toBe(7.6);
    expect(patched.masterAudioEnabled).toBe(DEFAULT_APP_SETTINGS.masterAudioEnabled);
    expect(db.state.executeCount - executeBefore).toBe(3);
  });

  it("no-ops when patch does not change values", async () => {
    const db = makeInMemorySettingsDb();
    await runWithService(resetSettings(), db.service);
    const executeBefore = db.state.executeCount;

    const current = await runWithService(getSettings(), db.service);
    const next = await runWithService(
      patchSettings({
        autosaveIntervalMs: current.autosaveIntervalMs,
      }),
      db.service,
    );

    expect(next).toEqual(current);
    expect(db.state.executeCount).toBe(executeBefore);
  });

  it("persists agentPolicy as a single root setting patch", async () => {
    const db = makeInMemorySettingsDb();
    await runWithService(resetSettings(), db.service);
    const executeBefore = db.state.executeCount;

    const patched = await runWithService(
      patchSettings({
        agentPolicy: {
          ...DEFAULT_APP_SETTINGS.agentPolicy,
          maxActionsPerBatch: 16,
          allowSettingsMutation: true,
        },
      }),
      db.service,
    );

    expect(patched.agentPolicy).toEqual({
      ...DEFAULT_APP_SETTINGS.agentPolicy,
      maxActionsPerBatch: 16,
      allowSettingsMutation: true,
    });
    expect(db.state.executeCount - executeBefore).toBe(1);
  });

  it("persists rigAgentRolloutPreference as a single root setting patch", async () => {
    const db = makeInMemorySettingsDb();
    await runWithService(resetSettings(), db.service);
    const executeBefore = db.state.executeCount;

    const patched = await runWithService(
      patchSettings({
        rigAgentRolloutPreference: "canary",
      }),
      db.service,
    );

    expect(patched.rigAgentRolloutPreference).toBe("canary");
    expect(db.state.executeCount - executeBefore).toBe(1);
  });

  it("reset writes all setting keys", async () => {
    const db = makeInMemorySettingsDb();
    await runWithService(resetSettings(), db.service);

    expect(db.state.transactionCount).toBe(1);
    expect(db.state.rows.size).toBe(APP_SETTING_KEYS.length);
    expect(Array.from(db.state.rows.keys()).sort()).toEqual(
      [...APP_SETTING_KEYS].sort(),
    );
  });

  it("fails for invalid stored JSON in known setting keys", async () => {
    const db = makeInMemorySettingsDb([
      {
        key: "masterVolume",
        value: "not-json",
        updated_at: Date.now(),
      },
    ]);

    await expect(runWithService(getSettings(), db.service)).rejects.toThrow(
      "Stored setting \"masterVolume\" is not valid JSON",
    );
  });

  it("ignores unknown keys in storage rows", async () => {
    const db = makeInMemorySettingsDb([
      {
        key: "unknown_key",
        value: JSON.stringify("ignored"),
        updated_at: Date.now(),
      },
    ]);

    const settings = await runWithService(getSettings(), db.service);
    expect(settings).toEqual(DEFAULT_APP_SETTINGS);
  });

  it("fails for schema-invalid aiSettings payloads", async () => {
    const db = makeInMemorySettingsDb([
      {
        key: "aiSettings",
        value: JSON.stringify({
          provider: "openai",
          model: "gpt-4o-mini",
          temperature: 0.2,
          maxTokens: 1024,
          actionMode: "auto-apply",
        }),
        updated_at: Date.now(),
      },
    ]);

    await expect(runWithService(getSettings(), db.service)).rejects.toThrow(
      "App settings schema validation failed",
    );
  });

  it("fails for schema-invalid agentPolicy payloads", async () => {
    const db = makeInMemorySettingsDb([
      {
        key: "agentPolicy",
        value: JSON.stringify({
          maxActionsPerBatch: -1,
          maxNodesCreatedPerRun: 12,
          maxEdgesCreatedPerRun: 24,
          allowSettingsMutation: false,
        }),
        updated_at: Date.now(),
      },
    ]);

    await expect(runWithService(getSettings(), db.service)).rejects.toThrow(
      "App settings schema validation failed",
    );
  });
});
