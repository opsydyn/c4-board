/**
 * DomainToggle - Switch between C4 and DDD modeling modes
 *
 * Provides a toggle to switch the entire sidebar and toolset
 * between C4 Architecture and Domain-Driven Design modes.
 */

import { ArrowsLeftRightIcon as ArrowsLeftRight } from "@phosphor-icons/react";
import type { NodeDomain } from "../../core/effects/node-operations";
import { domainToggle, domainToggleActive, domainToggleButton } from "./styles.css";

/** Re-exported, not redeclared (ADR-016). */
export type DiagramDomain = NodeDomain;

interface DomainToggleProps {
  currentDomain: DiagramDomain;
  onDomainChange: (domain: DiagramDomain) => void;
}

/**
 * Short labels. `MODE::` repeated three times cost more width than the row has —
 * with three modes the first button was pushed out of the sidebar and clipped to
 * "ODE::C4" — and the swap icon beside them already says these are modes.
 */
const MODES: ReadonlyArray<
  { readonly domain: DiagramDomain; readonly label: string; readonly description: string }
> = [
  { domain: "c4", label: "C4", description: "C4 architecture mode" },
  { domain: "ddd", label: "DDD", description: "Domain-driven design mode" },
  { domain: "eventStorming", label: "STORM", description: "Event storming mode" },
];

export function DomainToggle({ currentDomain, onDomainChange }: DomainToggleProps) {
  return (
    <div className={domainToggle}>
      <ArrowsLeftRight size={16} weight="bold" />
      {MODES.map((mode) => (
        <button
          key={mode.domain}
          type="button"
          className={`${domainToggleButton} ${currentDomain === mode.domain ? domainToggleActive : ""}`}
          onClick={() => onDomainChange(mode.domain)}
          aria-pressed={currentDomain === mode.domain}
          aria-label={mode.description}
          title={mode.description}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
