import { DatabaseService } from "@/core/effects/database.base";
import { markPosteeAgentProposalAccepted, recordPosteeAgentRun } from "@/core/effects/postee/agent-persistence";
import type { PosteeRequestProposal } from "@/core/effects/postee/agent-proposal";
import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

/**
 * ADR-012. A run has to leave a trace: what was asked, what was withheld, what was
 * proposed, and whether the operator took it. Without that there is no replay and
 * no audit of what the agent was shown — and ADR-008 makes replayability a
 * principle, not a nicety.
 */

const proposal: PosteeRequestProposal = {
  summary: "Fetch systems",
  rationale: "The cached schema exposes a systems root field",
  warnings: ["Assumed a page size of 20"],
  name: "Fetch systems",
  method: "POST",
  url: "https://api.example.test/graphql",
  headers: [{ key: "Authorization", value: "Bearer {{API_TOKEN}}" }],
  bodyMode: "graphql",
  body: null,
  graphqlDocument: "query Systems { systems { id } }",
  graphqlVariablesJson: "{}",
  graphqlOperationName: "Systems",
};

interface Execution {
  readonly sql: string;
  readonly values: ReadonlyArray<unknown> | undefined;
}

const makeService = (): [typeof DatabaseService.Service, () => ReadonlyArray<Execution>] => {
  const executions: Execution[] = [];
  return [
    {
      query: <T>() => Effect.succeed([] as T[]),
      execute: (sql: string, values?: unknown[]) => {
        executions.push({ sql, values });
        return Effect.void;
      },
      transaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
    },
    () => executions,
  ];
};

const run = <A, E>(effect: Effect.Effect<A, E, DatabaseService>, service: typeof DatabaseService.Service) =>
  Effect.runPromise(effect.pipe(Effect.provide(Layer.succeed(DatabaseService, service))));

const sqlFor = (executions: ReadonlyArray<Execution>, table: string) =>
  executions.find((execution) => execution.sql.includes(table));

describe("Postee agent persistence", () => {
  it("records the run and its proposal together", async () => {
    const [service, executions] = makeService();

    await run(
      recordPosteeAgentRun({
        runId: "run-1",
        proposalId: "proposal-1",
        description: "fetch all systems",
        model: "gpt-4o-mini",
        includeBodies: false,
        withheld: ["header values", "response body"],
        usage: { inputTokens: 900, outputTokens: 120, totalTokens: 1020 },
        proposal,
        now: 1_700_000_000_000,
      }),
      service,
    );

    expect(sqlFor(executions(), "postee_agent_runs")).toBeDefined();
    expect(sqlFor(executions(), "postee_agent_proposals")).toBeDefined();
  });

  it("records what the boundary withheld, so a replay knows what the model never saw", async () => {
    const [service, executions] = makeService();

    await run(
      recordPosteeAgentRun({
        runId: "run-1",
        proposalId: "proposal-1",
        description: "fetch all systems",
        model: "gpt-4o-mini",
        includeBodies: false,
        withheld: ["header values", "response body"],
        usage: { inputTokens: 900, outputTokens: 120, totalTokens: 1020 },
        proposal,
        now: 1_700_000_000_000,
      }),
      service,
    );

    const values = sqlFor(executions(), "postee_agent_runs")?.values ?? [];
    expect(values).toContain(JSON.stringify(["header values", "response body"]));
    // Consent is part of the record: it says whether bodies could have left.
    expect(values).toContain(0);
  });

  it("records token usage, since a run has a cost", async () => {
    const [service, executions] = makeService();

    await run(
      recordPosteeAgentRun({
        runId: "run-1",
        proposalId: "proposal-1",
        description: "d",
        model: "gpt-4o-mini",
        includeBodies: true,
        withheld: [],
        usage: { inputTokens: 900, outputTokens: 120, totalTokens: 1020 },
        proposal,
        now: 1,
      }),
      service,
    );

    const values = sqlFor(executions(), "postee_agent_runs")?.values ?? [];
    expect(values).toContain(1020);
    expect(values).toContain(1);
  });

  it("stores the proposal fields needed to rebuild the draft", async () => {
    const [service, executions] = makeService();

    await run(
      recordPosteeAgentRun({
        runId: "run-1",
        proposalId: "proposal-1",
        description: "d",
        model: "m",
        includeBodies: false,
        withheld: [],
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        proposal,
        now: 1,
      }),
      service,
    );

    const values = sqlFor(executions(), "postee_agent_proposals")?.values ?? [];
    expect(values).toContain("POST");
    expect(values).toContain("https://api.example.test/graphql");
    expect(values).toContain("query Systems { systems { id } }");
    expect(values).toContain(JSON.stringify(["Assumed a page size of 20"]));
  });

  it("links a proposal to the draft it became when the operator accepts it", async () => {
    const [service, executions] = makeService();

    await run(markPosteeAgentProposalAccepted("proposal-1", "scratch-9", 1_700_000_000_001), service);

    const accepted = sqlFor(executions(), "postee_agent_proposals");
    expect(accepted?.sql).toContain("UPDATE");
    expect(accepted?.values).toContain("scratch-9");
    expect(accepted?.values).toContain("proposal-1");
  });
});
