/**
 * The OPY surface in Postee — ADR-012 Phase 5.
 *
 * A drawer rather than a pane: it overlays, so asking the agent something never
 * costs the request or response you are looking at (ADR-011).
 *
 * The interaction is deliberately proposal-then-accept. The agent drafts; the
 * operator reads the draft, its rationale, and its warnings; and only an explicit
 * action turns it into a scratch tab. Nothing here writes to the database.
 */

import type { PosteeRequestProposal } from "@/core/effects/postee/agent-proposal";
import { useCallback, useState } from "react";
import { Drawer } from "./Drawer";
import {
  agentConsent,
  agentError,
  agentField,
  agentInput,
  agentProposal,
  agentProposalRow,
  agentSubmit,
  agentWarning,
} from "./PosteeAgentDrawer.css";

export interface PosteeAgentProposeInput {
  readonly description: string;
  /** Per-run consent for response bodies leaving the machine (ADR-012). */
  readonly includeBodies: boolean;
}

export interface PosteeAgentDrawerProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onPropose: (input: PosteeAgentProposeInput) => Promise<PosteeRequestProposal>;
  readonly onAcceptProposal: (proposal: PosteeRequestProposal) => void;
}

export function PosteeAgentDrawer({
  isOpen,
  onClose,
  onPropose,
  onAcceptProposal,
}: PosteeAgentDrawerProps) {
  const [description, setDescription] = useState("");
  const [includeBodies, setIncludeBodies] = useState(false);
  const [proposal, setProposal] = useState<PosteeRequestProposal | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProposing, setIsProposing] = useState(false);

  const handlePropose = useCallback(async () => {
    const trimmed = description.trim();
    if (trimmed.length === 0 || isProposing) return;

    setIsProposing(true);
    setError(null);
    try {
      setProposal(await onPropose({ description: trimmed, includeBodies }));
    } catch (cause) {
      // A silent failure would leave the operator watching a spinner forever.
      setError(cause instanceof Error ? cause.message : String(cause));
      setProposal(null);
    } finally {
      setIsProposing(false);
    }
  }, [description, includeBodies, isProposing, onPropose]);

  return (
    <Drawer isOpen={isOpen} title="OPY // Request Author" onClose={onClose}>
      <label className={agentField}>
        Describe the request
        <textarea
          className={agentInput}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Fetch every system from the GraphQL API"
          rows={4}
        />
      </label>

      <label className={agentConsent}>
        <input
          type="checkbox"
          checked={includeBodies}
          onChange={(event) => setIncludeBodies(event.target.checked)}
        />
        Share response bodies with the model for this run
      </label>

      <button type="button" className={agentSubmit} onClick={handlePropose} disabled={isProposing}>
        {isProposing ? "Proposing…" : "Propose a request"}
      </button>

      {error !== null && <p className={agentError} role="alert">{error}</p>}

      {proposal !== null && (
        <section className={agentProposal} aria-label="Proposed request">
          <p>{proposal.summary}</p>
          <div className={agentProposalRow}>
            <strong>{proposal.method}</strong>
            <span>{proposal.url}</span>
          </div>
          <p>{proposal.rationale}</p>

          {proposal.warnings.map((warning) => (
            <p key={warning} className={agentWarning}>{warning}</p>
          ))}

          <button type="button" className={agentSubmit} onClick={() => onAcceptProposal(proposal)}>
            Open as draft
          </button>
        </section>
      )}
    </Drawer>
  );
}
