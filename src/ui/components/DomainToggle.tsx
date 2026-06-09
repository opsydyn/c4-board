/**
 * DomainToggle - Switch between C4 and DDD modeling modes
 *
 * Provides a toggle to switch the entire sidebar and toolset
 * between C4 Architecture and Domain-Driven Design modes.
 */

import { ArrowsLeftRight } from "@phosphor-icons/react";
import { domainToggle, domainToggleActive, domainToggleButton } from "./styles.css";

export type DiagramDomain = "c4" | "ddd";

interface DomainToggleProps {
  currentDomain: DiagramDomain;
  onDomainChange: (domain: DiagramDomain) => void;
}

export function DomainToggle({ currentDomain, onDomainChange }: DomainToggleProps) {
  return (
    <div className={domainToggle}>
      <ArrowsLeftRight size={16} weight="bold" />
      <button
        type="button"
        className={`${domainToggleButton} ${currentDomain === "c4" ? domainToggleActive : ""}`}
        onClick={() => onDomainChange("c4")}
      >
        MODE::C4
      </button>
      <button
        type="button"
        className={`${domainToggleButton} ${currentDomain === "ddd" ? domainToggleActive : ""}`}
        onClick={() => onDomainChange("ddd")}
      >
        MODE::DDD
      </button>
    </div>
  );
}
