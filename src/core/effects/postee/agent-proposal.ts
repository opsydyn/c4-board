/**
 * Turning an agent proposal into something the operator can accept — ADR-012.
 *
 * A proposal is never applied. It becomes a scratch draft: visible, editable,
 * runnable, and discardable, promoted into a collection only by explicit action.
 * The scratch-first workspace already is the approval boundary, so the agent needs
 * no new gate of its own — and there is nothing here that writes to the database.
 */

import type { HttpMethod, RequestBodyMode } from "./types";
import { newPosteeScratchDraft, type PosteeScratchDraft } from "./scratch-draft";

export interface PosteeProposalHeader {
  readonly key: string;
  readonly value: string;
}

/** Mirrors `RigPosteeRequestProposalPayload`, already sanitized and validated. */
export interface PosteeRequestProposal {
  readonly summary: string;
  readonly rationale: string;
  readonly warnings: ReadonlyArray<string>;
  readonly name: string;
  readonly method: string;
  readonly url: string;
  readonly headers: ReadonlyArray<PosteeProposalHeader>;
  readonly bodyMode: string;
  readonly body: string | null;
  readonly graphqlDocument: string | null;
  readonly graphqlVariablesJson: string | null;
  readonly graphqlOperationName: string | null;
}

export const proposalToScratchDraft = (
  proposal: PosteeRequestProposal,
  identity: { readonly id: string; readonly tabOrder: number; readonly now: number },
): PosteeScratchDraft => {
  const base = newPosteeScratchDraft(identity);
  const isGraphql = proposal.bodyMode === "graphql";

  return {
    ...base,
    name: proposal.name,
    method: proposal.method as HttpMethod,
    url: proposal.url,
    headers: proposal.headers.map((header, index) => ({
      id: `${identity.id}-header-${index}`,
      key: header.key,
      value: header.value,
      // Proposed headers arrive enabled; the operator disables what they do not want.
      enabled: true,
    })),
    body: {
      mode: proposal.bodyMode as RequestBodyMode,
      raw: isGraphql ? null : proposal.body,
      form_values: null,
    },
    graphql: isGraphql && proposal.graphqlDocument !== null
      ? {
        document: proposal.graphqlDocument,
        variables_json: proposal.graphqlVariablesJson ?? "{}",
        operation_name: proposal.graphqlOperationName,
      }
      : null,
  };
};
