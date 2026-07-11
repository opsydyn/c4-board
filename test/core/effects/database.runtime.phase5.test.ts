import { DatabaseError, DatabaseService } from "@/core/effects/database.base";
import { APP_SETTING_KEYS } from "@/core/effects/settings.types";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

interface InvokeArgs {
  sql?: string;
  values?: unknown[];
}

const getBootstrapRows = () => APP_SETTING_KEYS.map((key) => ({ key }));

const createDefaultInvoke = () =>
  vi.fn(async (command: string, args?: InvokeArgs) => {
    if (command === "sql_query") {
      if (args?.sql?.includes("SELECT key FROM app_settings")) {
        return getBootstrapRows();
      }
      return [];
    }

    if (command === "sql_execute") {
      return null;
    }

    throw new Error(`Unexpected invoke command: ${command}`);
  });

const runWithDatabaseRuntime = async <A, E>(
  program: Effect.Effect<A, E, DatabaseService>,
): Promise<A> => {
  const runtime = await import("@/core/effects/database.runtime");
  return Effect.runPromise(program.pipe(Effect.provide(runtime.DatabaseServiceLive)));
};

describe("database.runtime phase 5", () => {
  beforeEach(() => {
    vi.resetModules();
    invokeMock.mockReset();
  });

  it("retries SQLITE_BUSY/locked writes and eventually succeeds", async () => {
    const localInvoke = createDefaultInvoke();
    let writeAttempts = 0;

    localInvoke.mockImplementation(async (command: string, args?: InvokeArgs) => {
      if (command === "sql_query") {
        if (args?.sql?.includes("SELECT key FROM app_settings")) {
          return getBootstrapRows();
        }
        return [];
      }

      if (command === "sql_execute") {
        if (args?.sql === "UPDATE retry_target SET value = 1") {
          writeAttempts += 1;
          if (writeAttempts < 3) {
            throw new Error(
              "error returned from database: (code: 5) database is locked",
            );
          }
        }
        return null;
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });

    invokeMock.mockImplementation(localInvoke);

    const program = Effect.gen(function*() {
      const db = yield* DatabaseService;
      yield* db.execute("UPDATE retry_target SET value = 1");
    });

    await expect(runWithDatabaseRuntime(program)).resolves.toBeUndefined();
    expect(writeAttempts).toBe(3);
  });

  it("serializes high-concurrency writes through a single critical section", async () => {
    const localInvoke = createDefaultInvoke();
    let activeWrites = 0;
    let maxConcurrentWrites = 0;

    localInvoke.mockImplementation(async (command: string, args?: InvokeArgs) => {
      if (command === "sql_query") {
        if (args?.sql?.includes("SELECT key FROM app_settings")) {
          return getBootstrapRows();
        }
        return [];
      }

      if (command === "sql_execute") {
        if (args?.sql?.startsWith("UPDATE stress_target SET value =")) {
          activeWrites += 1;
          maxConcurrentWrites = Math.max(maxConcurrentWrites, activeWrites);
          await new Promise<void>((resolve) => setTimeout(resolve, 4));
          activeWrites -= 1;
        }
        return null;
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });

    invokeMock.mockImplementation(localInvoke);

    const program = Effect.gen(function*() {
      const db = yield* DatabaseService;
      const writes = Array.from({ length: 24 }, (_, index) => index);
      yield* Effect.forEach(
        writes,
        (index) => db.execute(`UPDATE stress_target SET value = ${index}`),
        {
          concurrency: "unbounded",
        },
      );
    });

    await runWithDatabaseRuntime(program);
    expect(maxConcurrentWrites).toBe(1);
  });

  it("rolls back transaction when inner operation fails", async () => {
    const localInvoke = createDefaultInvoke();
    const executedStatements: string[] = [];

    localInvoke.mockImplementation(async (command: string, args?: InvokeArgs) => {
      if (command === "sql_query") {
        if (args?.sql?.includes("SELECT key FROM app_settings")) {
          return getBootstrapRows();
        }
        return [];
      }

      if (command === "sql_execute") {
        if (typeof args?.sql === "string") {
          executedStatements.push(args.sql);
        }
        return null;
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });

    invokeMock.mockImplementation(localInvoke);

    const program = Effect.gen(function*() {
      const db = yield* DatabaseService;
      return yield* db.transaction(
        Effect.fail(new DatabaseError({ message: "inner transaction failure" })),
      );
    });

    const exit = await Effect.runPromiseExit(
      program.pipe(
        Effect.provide((await import("@/core/effects/database.runtime")).DatabaseServiceLive),
      ),
    );

    expect(exit._tag).toBe("Failure");
    expect(executedStatements).toContain("BEGIN IMMEDIATE");
    expect(executedStatements).toContain("ROLLBACK");
    expect(executedStatements).not.toContain("COMMIT");
  });
});
