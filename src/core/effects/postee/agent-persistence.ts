/**
 * The audit trail for Postee agent runs — ADR-012.
 *
 * ADR-008 makes replayability a principle, which needs a record of what was asked,
 * what the boundary withheld, what came back, and whether the operator took it.
 * `withheld_json` is the load-bearing column: without it a replay cannot tell
 * whether the model saw a body and ignored it or was never shown one.
 */

import { Effect } from "effect";
import { DatabaseService } from "../database.base";
import type { PosteeRequestProposal } from "./agent-proposal";

export interface PosteeAgentUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export interface RecordPosteeAgentRunInput {
  readonly runId: string;
  readonly proposalId: string;
  readonly description: string;
  readonly model: string;
  readonly includeBodies: boolean;
  readonly withheld: ReadonlyArray<string>;
  readonly usage: PosteeAgentUsage;
  readonly proposal: PosteeRequestProposal;
  readonly now: number;
}

export const recordPosteeAgentRun = (input: RecordPosteeAgentRunInput) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;

    yield* service.execute(
      `INSERT INTO postee_agent_runs (
        id, description, model, status, include_bodies, withheld_json,
        input_tokens, output_tokens, total_tokens, error_summary, created_at, updated_at
      ) VALUES (?, ?, ?, 'proposed', ?, ?, ?, ?, ?, NULL, ?, ?)`,
      [
        input.runId,
        input.description,
        input.model,
        input.includeBodies ? 1 : 0,
        JSON.stringify(input.withheld),
        input.usage.inputTokens,
        input.usage.outputTokens,
        input.usage.totalTokens,
        input.now,
        input.now,
      ],
    );

    yield* service.execute(
      `INSERT INTO postee_agent_proposals (
        id, run_id, summary, rationale, warnings_json, name, method, url, headers_json,
        body_mode, body_raw, graphql_document, graphql_variables_json,
        graphql_operation_name, scratch_draft_id, accepted_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)`,
      [
        input.proposalId,
        input.runId,
        input.proposal.summary,
        input.proposal.rationale,
        JSON.stringify(input.proposal.warnings),
        input.proposal.name,
        input.proposal.method,
        input.proposal.url,
        JSON.stringify(input.proposal.headers),
        input.proposal.bodyMode,
        input.proposal.body,
        input.proposal.graphqlDocument,
        input.proposal.graphqlVariablesJson,
        input.proposal.graphqlOperationName,
        input.now,
      ],
    );
  });

/** Links a proposal to the draft it became, which is the only record that it was taken up. */
export const markPosteeAgentProposalAccepted = (
  proposalId: string,
  scratchDraftId: string,
  now: number,
) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(
      `UPDATE postee_agent_proposals SET scratch_draft_id = ?, accepted_at = ? WHERE id = ?`,
      [scratchDraftId, now, proposalId],
    );
    yield* service.execute(
      `UPDATE postee_agent_runs SET status = 'accepted', updated_at = ?
       WHERE id = (SELECT run_id FROM postee_agent_proposals WHERE id = ?)`,
      [now, proposalId],
    );
  });
