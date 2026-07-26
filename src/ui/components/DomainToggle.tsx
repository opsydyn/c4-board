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

const MODES: ReadonlyArray<{ readonly domain: DiagramDomain; readonly label: string }> = [
  { domain: "c4", label: "MODE::C4" },
  { domain: "ddd", label: "MODE::DDD" },
  { domain: "eventStorming", label: "MODE::STORM" },
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
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
