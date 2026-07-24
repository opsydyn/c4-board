import { DatabaseService } from "@/core/effects/database.base";
import { insertPosteeHistory, type PosteeHistoryEntry } from "@/core/effects/database.postee";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

/**
 * postee_history.response_body is a JSON column: the INSERT wraps it in `json(?)`
 * and the table CHECKs `json_valid(...) OR ... IS NULL`. SQLite raises
 * "malformed JSON" for anything else, which fails the whole execute and makes a
 * perfectly good HTTP response surface as a failed request. Responses are not
 * always JSON — error pages, plain text, and empty bodies all reach here.
 */

const entry = (overrides: Partial<PosteeHistoryEntry>): PosteeHistoryEntry => ({
  id: "history-1",
  request_id: null,
  request_snapshot: "{}",
  response_status: 200,
  response_time_ms: 12,
  response_size_bytes: 34,
  response_body: null,
  response_headers: JSON.stringify({ "content-type": "application/json" }),
  error_message: null,
  executed_at: 1_700_000_000_000,
  ...overrides,
});

const makeDatabaseService = (): [
  typeof DatabaseService.Service,
  () => ReadonlyArray<ReadonlyArray<unknown> | undefined>,
] => {
  const executions: Array<ReadonlyArray<unknown> | undefined> = [];
  return [
    {
      query: <T>() => Effect.succeed([] as T[]),
      execute: (_sql: string, values?: unknown[]) => {
        executions.push(values);
        return Effect.void;
      },
      transaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
    },
    () => executions,
  ];
};

/** Mirrors the `json(?)` binding: SQLite accepts only valid JSON or NULL. */
const boundResponseBody = (values: ReadonlyArray<unknown> | undefined): unknown => values?.[6];

const isStorableAsJsonColumn = (value: unknown): boolean => {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

const run = <E>(effect: Effect.Effect<void, E, DatabaseService>, service: typeof DatabaseService.Service) =>
  Effect.runPromise(effect.pipe(Effect.provide(Layer.succeed(DatabaseService, service))));

describe("Postee history storage", () => {
  it("keeps a JSON response body intact", async () => {
    const [service, executions] = makeDatabaseService();
    const body = JSON.stringify({ args: { search: "red bmw" } });

    await run(insertPosteeHistory(entry({ response_body: body })), service);

    const bound = boundResponseBody(executions()[0]);
    expect(isStorableAsJsonColumn(bound)).toBe(true);
    expect(JSON.parse(bound as string)).toEqual({ args: { search: "red bmw" } });
  });

  it("stores a non-JSON response body without tripping the json() column", async () => {
    const [service, executions] = makeDatabaseService();
    const body = "<html><body>503 Service Unavailable</body></html>";

    await run(insertPosteeHistory(entry({ response_body: body })), service);

    const bound = boundResponseBody(executions()[0]);
    expect(isStorableAsJsonColumn(bound)).toBe(true);
    expect(JSON.parse(bound as string)).toBe(body);
  });

  it("stores an empty response body as null rather than malformed JSON", async () => {
    const [service, executions] = makeDatabaseService();

    await run(insertPosteeHistory(entry({ response_body: "" })), service);

    expect(boundResponseBody(executions()[0])).toBeNull();
  });
});
