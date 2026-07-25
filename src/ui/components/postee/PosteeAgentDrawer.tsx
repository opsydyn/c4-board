/**
 * The OPY surface in Postee — ADR-012 Phase 5.
 *
 * A drawer rather than a pane: it overlays, so asking the agent something never
 * costs the request or response you are looking at (ADR-011).
 *
 * Styled with the global settings vocabulary — cards, rows, row hints, action
 * buttons — rather than a local one. Two surfaces that ask the user to make a
 * decision should not look like two different applications.
 *
 * The interaction is proposal-then-accept. The agent drafts; the operator reads the
 * draft, its rationale, and its warnings; only an explicit action turns it into a
 * scratch tab. Nothing here writes to the database.
 */

import type { PosteeRequestProposal } from "@/core/effects/postee/agent-proposal";
import { useCallback, useState } from "react";
import * as settings from "../../../styles/pages/settings.css";
import { Drawer } from "./Drawer";
import {
  agentBody,
  agentCard,
  agentCardDanger,
  agentMethod,
  agentPrompt,
  agentProposalMeta,
  agentRationale,
  agentUrl,
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
      <div className={agentBody}>
        <section className={agentCard}>
          <h3 className={settings.settingsCardTitle}>Request</h3>
          <p className={settings.settingsCardDescription}>
            Describe what you need. OPY drafts it against your cached schema, saved requests, and environment variable
            names.
          </p>
          <label className={settings.settingsRowLabel}>
            Describe the request
            <textarea
              className={agentPrompt}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Fetch every system from the GraphQL API"
              rows={4}
            />
          </label>
        </section>

        <section className={agentCard}>
          <h3 className={settings.settingsCardTitle}>Data sharing</h3>
          <p className={settings.settingsCardDescription}>
            Environment values and header values never leave this machine. Response bodies are the one thing you can
            choose to share, and the choice resets every time.
          </p>
          <div className={settings.settingsRow}>
            <div className={settings.settingsRowLabel}>
              <span>Response bodies</span>
              <span className={settings.settingsRowHint}>Shared for this run only</span>
            </div>
            <div className={settings.settingsControlGroup}>
              {/* The settings ON/OFF control, kept a checkbox to assistive tech. */}
              <button
                type="button"
                role="checkbox"
                aria-label="Response bodies shared with the model for this run"
                aria-checked={includeBodies}
                className={settings.settingsToggleControl}
                data-active={includeBodies ? "true" : "false"}
                onClick={() => setIncludeBodies((shared) => !shared)}
              >
                {includeBodies ? "ON" : "OFF"}
              </button>
            </div>
          </div>
          <div className={settings.settingsInlineActions}>
            <button
              type="button"
              className={settings.settingsActionButton}
              onClick={handlePropose}
              disabled={isProposing}
            >
              {isProposing ? "Proposing…" : "Propose a request"}
            </button>
          </div>
        </section>

        {error !== null && (
          <section className={agentCardDanger}>
            <h3 className={settings.settingsCardTitle}>Could not propose</h3>
            <p className={settings.settingsErrorText} role="alert">{error}</p>
          </section>
        )}

        {proposal !== null && (
          <section className={agentCard} aria-label="Proposed request">
            <h3 className={settings.settingsCardTitle}>Proposal</h3>
            <p className={settings.settingsCardDescription}>{proposal.summary}</p>

            <div className={settings.settingsRow}>
              <div className={agentProposalMeta}>
                <span className={agentMethod}>{proposal.method}</span>
                <span className={agentUrl}>{proposal.url}</span>
              </div>
            </div>

            <p className={agentRationale}>{proposal.rationale}</p>

            {proposal.warnings.map((warning) => <p key={warning} className={agentWarning}>{warning}</p>)}

            <div className={settings.settingsInlineActions}>
              <button
                type="button"
                className={settings.settingsActionButton}
                onClick={() => onAcceptProposal(proposal)}
              >
                Open as draft
              </button>
            </div>
          </section>
        )}
      </div>
    </Drawer>
  );
}
