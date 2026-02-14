/**
 * PropertiesPanel - Edit selected node properties
 *
 * Displays when a node is selected, allows editing its properties.
 */

import { XIcon } from "@phosphor-icons/react";
import type { Node } from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import type { CouplingOverrides, CouplingScoreMode, NodeData } from "../../core/effects/node-operations";
import { IconPicker } from "./icons/IconPicker";
import {
  dangerIconButton,
  formGroup,
  formInlineRow,
  input,
  inputGrow,
  label,
  panelTitle,
  propertiesPanel,
  textarea,
  toolbarButton,
} from "./styles.css";
import { TacticalSelect } from "./TacticalSelect";

const TEAM_UNASSIGNED_VALUE = "__unassigned__";

const normalizeTeamKey = (value: string): string => value.trim().toLowerCase();

interface PropertiesPanelProps {
  selectedNode: Node<NodeData> | null;
  ownershipTeams: readonly string[];
  onRemoveOwnershipTeamFromBoard: (team: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<NodeData>) => void;
}

type CouplingOverridePatch = {
  [K in keyof CouplingOverrides]?: CouplingOverrides[K] | undefined;
};

const scoreModeOptions = [
  { value: "auto", label: "AUTO (DERIVED)" },
  { value: "hybrid", label: "HYBRID (DERIVED + OVERRIDES)" },
  { value: "manual", label: "MANUAL (CURATED)" },
] as const;

const integrationOverrideOptions = [
  { value: "", label: "USE NODE DEFAULT" },
  { value: "intrusive", label: "INTRUSIVE" },
  { value: "contract", label: "CONTRACT" },
  { value: "functional", label: "FUNCTIONAL" },
] as const;

const subdomainOverrideOptions = [
  { value: "", label: "USE NODE DEFAULT" },
  { value: "core", label: "CORE" },
  { value: "supporting", label: "SUPPORTING" },
  { value: "generic", label: "GENERIC" },
] as const;

export function PropertiesPanel({
  selectedNode,
  ownershipTeams,
  onRemoveOwnershipTeamFromBoard,
  onUpdateNode,
}: PropertiesPanelProps) {
  const typeLabel = selectedNode?.data?.c4Type ?? selectedNode?.data?.dddType ?? selectedNode?.type ?? "node";
  const scoreMode: CouplingScoreMode = selectedNode?.data?.couplingScoreMode ?? "auto";
  const couplingOverrides: CouplingOverrides = selectedNode?.data?.couplingOverrides ?? {};
  const controlsDisabled = scoreMode === "auto";
  const hasOverrides = Object.keys(couplingOverrides).length > 0;
  const [draftTeamName, setDraftTeamName] = useState("");

  useEffect(() => {
    setDraftTeamName("");
  }, [selectedNode?.id]);

  const normalizedTeamMap = useMemo(() => {
    const teamMap = new Map<string, string>();
    for (const team of ownershipTeams) {
      const trimmed = team.trim();
      if (trimmed.length === 0) {
        continue;
      }
      const key = normalizeTeamKey(trimmed);
      if (!teamMap.has(key)) {
        teamMap.set(key, trimmed);
      }
    }

    const currentOwnership = selectedNode?.data?.teamOwnership;
    if (typeof currentOwnership === "string") {
      const trimmed = currentOwnership.trim();
      if (trimmed.length > 0) {
        const key = normalizeTeamKey(trimmed);
        if (!teamMap.has(key)) {
          teamMap.set(key, trimmed);
        }
      }
    }

    return teamMap;
  }, [ownershipTeams, selectedNode?.data?.teamOwnership]);

  const teamOptions = useMemo(() => {
    const teams = Array.from(normalizedTeamMap.entries())
      .sort(([teamA], [teamB]) => teamA.localeCompare(teamB))
      .map(([value, displayName]) => ({
        value,
        label: displayName.toUpperCase(),
      }));

    return [
      { value: TEAM_UNASSIGNED_VALUE, label: "UNASSIGNED" },
      ...teams,
    ];
  }, [normalizedTeamMap]);

  const currentTeamTrimmed = typeof selectedNode?.data?.teamOwnership === "string"
    ? selectedNode.data.teamOwnership.trim()
    : "";
  const currentTeamKey = currentTeamTrimmed.length > 0
    ? normalizeTeamKey(currentTeamTrimmed)
    : TEAM_UNASSIGNED_VALUE;
  const isRemoveTeamDisabled = currentTeamKey === TEAM_UNASSIGNED_VALUE;

  const handleChange = (field: keyof NodeData, value: string) => {
    if (!selectedNode) {
      return;
    }
    onUpdateNode(selectedNode.id, { [field]: value });
  };

  const handleTeamSelectionChange = (nextValue: string) => {
    if (!selectedNode) {
      return;
    }
    if (nextValue === TEAM_UNASSIGNED_VALUE) {
      onUpdateNode(selectedNode.id, { teamOwnership: "" });
      return;
    }

    const canonical = normalizedTeamMap.get(nextValue) ?? nextValue;
    onUpdateNode(selectedNode.id, { teamOwnership: canonical });
  };

  const handleAddTeam = () => {
    if (!selectedNode) {
      return;
    }
    const trimmed = draftTeamName.trim();
    if (trimmed.length === 0) {
      return;
    }

    const normalized = normalizeTeamKey(trimmed);
    const canonical = normalizedTeamMap.get(normalized) ?? trimmed;
    onUpdateNode(selectedNode.id, { teamOwnership: canonical });
    setDraftTeamName("");
  };

  const handleRemoveTeamFromBoard = () => {
    if (!selectedNode) {
      return;
    }
    if (currentTeamKey === TEAM_UNASSIGNED_VALUE) {
      return;
    }

    const teamLabel = normalizedTeamMap.get(currentTeamKey) ?? currentTeamTrimmed;
    if (teamLabel.length === 0) {
      return;
    }

    if (
      typeof window !== "undefined"
      && !window.confirm(`Remove team "${teamLabel}" from all nodes in this board?`)
    ) {
      return;
    }

    onRemoveOwnershipTeamFromBoard(teamLabel);
  };

  const clampDimension = (value: number): number => Math.max(1, Math.min(10, Number(value.toFixed(1))));

  const applyOverridePatch = (patch: CouplingOverridePatch) => {
    if (!selectedNode) {
      return;
    }
    const mergedOverrides: CouplingOverridePatch = {
      ...couplingOverrides,
      ...patch,
    };
    const nextOverrides: CouplingOverrides = {
      ...(mergedOverrides.strength !== undefined
        ? { strength: mergedOverrides.strength }
        : {}),
      ...(mergedOverrides.distance !== undefined
        ? { distance: mergedOverrides.distance }
        : {}),
      ...(mergedOverrides.volatility !== undefined
        ? { volatility: mergedOverrides.volatility }
        : {}),
      ...(mergedOverrides.integrationType !== undefined
        ? { integrationType: mergedOverrides.integrationType }
        : {}),
      ...(mergedOverrides.subdomainType !== undefined
        ? { subdomainType: mergedOverrides.subdomainType }
        : {}),
    };

    onUpdateNode(selectedNode.id, { couplingOverrides: nextOverrides });
  };

  const setScoreMode = (mode: CouplingScoreMode) => {
    if (!selectedNode) {
      return;
    }
    if (mode === "auto") {
      onUpdateNode(selectedNode.id, {
        couplingScoreMode: "auto",
        couplingOverrides: {},
      });
      return;
    }
    onUpdateNode(selectedNode.id, { couplingScoreMode: mode });
  };

  const handleDimensionOverrideChange = (
    field: "strength" | "distance" | "volatility",
    rawValue: string,
  ) => {
    const trimmed = rawValue.trim();
    if (trimmed.length === 0) {
      applyOverridePatch({ [field]: undefined });
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return;
    }

    applyOverridePatch({ [field]: clampDimension(parsed) });
  };

  const resetCouplingOverrides = () => {
    if (!selectedNode) {
      return;
    }
    onUpdateNode(selectedNode.id, {
      couplingScoreMode: "auto",
      couplingOverrides: {},
    });
  };

  if (!selectedNode) {
    return null;
  }

  return (
    <div className={propertiesPanel}>
      <h3 className={panelTitle}>MODE::EDIT {typeLabel}</h3>

      <IconPicker
        type={selectedNode.data?.c4Type ?? "system"}
        value={selectedNode.data?.iconId}
        onChange={(iconId) => onUpdateNode(selectedNode.id, { iconId })}
      />

      <div className={formGroup}>
        <label className={label} htmlFor="node-label">
          Name
        </label>
        <input
          id="node-label"
          type="text"
          className={input}
          value={selectedNode.data?.label || ""}
          onChange={(e) => handleChange("label", e.target.value)}
          placeholder="Element name"
        />
      </div>

      <div className={formGroup}>
        <label className={label} htmlFor="node-technology">
          Technology
        </label>
        <input
          id="node-technology"
          type="text"
          className={input}
          value={selectedNode.data?.technology || ""}
          onChange={(e) => handleChange("technology", e.target.value)}
          placeholder="E.G.::ASTRO / XSTATE / EFFECT"
        />
      </div>

      <div className={formGroup}>
        <label className={label} htmlFor="node-description">
          Description
        </label>
        <textarea
          id="node-description"
          className={textarea}
          value={selectedNode.data?.description || ""}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="META::DESC"
        />
      </div>

      <div className={formGroup}>
        <label className={label} htmlFor="node-team-ownership">
          Team Ownership
        </label>
        <div className={formInlineRow}>
          <div className={inputGrow}>
            <TacticalSelect
              id="node-team-ownership"
              ariaLabel="Team ownership"
              value={currentTeamKey}
              options={teamOptions}
              onChange={handleTeamSelectionChange}
            />
          </div>
          <button
            type="button"
            className={dangerIconButton}
            onClick={handleRemoveTeamFromBoard}
            disabled={isRemoveTeamDisabled}
            aria-disabled={isRemoveTeamDisabled}
            aria-label="Remove team from board"
            title={isRemoveTeamDisabled
              ? "UNASSIGNED cannot be removed"
              : "Remove team from board"}
          >
            <XIcon size={14} weight="bold" />
          </button>
        </div>
        <div className={formInlineRow}>
          <input
            id="node-team-ownership-new"
            type="text"
            className={`${input} ${inputGrow}`}
            value={draftTeamName}
            onChange={(event) => setDraftTeamName(event.currentTarget.value)}
            placeholder="ADD TEAM::TEAM-PLATFORM"
          />
          <button
            type="button"
            className={toolbarButton}
            onClick={handleAddTeam}
            disabled={draftTeamName.trim().length === 0}
          >
            Add Team
          </button>
        </div>
      </div>

      <div className={formGroup}>
        <label className={label} htmlFor="node-coupling-score-mode">
          Coupling Score Mode
        </label>
        <TacticalSelect
          id="node-coupling-score-mode"
          ariaLabel="Coupling score mode"
          value={scoreMode}
          options={scoreModeOptions}
          onChange={(nextValue) => setScoreMode(nextValue as CouplingScoreMode)}
        />
      </div>

      <div className={formGroup}>
        <label className={label} htmlFor="node-coupling-strength">
          Strength Override (1 - 10)
        </label>
        <input
          id="node-coupling-strength"
          type="number"
          className={input}
          min={1}
          max={10}
          step={0.1}
          disabled={controlsDisabled}
          value={couplingOverrides.strength !== undefined
            ? String(couplingOverrides.strength)
            : ""}
          onChange={(event) =>
            handleDimensionOverrideChange(
              "strength",
              event.currentTarget.value,
            )}
          placeholder="AUTO"
        />
      </div>

      <div className={formGroup}>
        <label className={label} htmlFor="node-coupling-distance">
          Distance Override (1 - 10)
        </label>
        <input
          id="node-coupling-distance"
          type="number"
          className={input}
          min={1}
          max={10}
          step={0.1}
          disabled={controlsDisabled}
          value={couplingOverrides.distance !== undefined
            ? String(couplingOverrides.distance)
            : ""}
          onChange={(event) =>
            handleDimensionOverrideChange(
              "distance",
              event.currentTarget.value,
            )}
          placeholder="AUTO"
        />
      </div>

      <div className={formGroup}>
        <label className={label} htmlFor="node-coupling-volatility">
          Volatility Override (1 - 10)
        </label>
        <input
          id="node-coupling-volatility"
          type="number"
          className={input}
          min={1}
          max={10}
          step={0.1}
          disabled={controlsDisabled}
          value={couplingOverrides.volatility !== undefined
            ? String(couplingOverrides.volatility)
            : ""}
          onChange={(event) =>
            handleDimensionOverrideChange(
              "volatility",
              event.currentTarget.value,
            )}
          placeholder="AUTO"
        />
      </div>

      <div className={formGroup}>
        <label className={label} htmlFor="node-coupling-integration">
          Integration Override
        </label>
        <TacticalSelect
          id="node-coupling-integration"
          ariaLabel="Integration override"
          value={couplingOverrides.integrationType ?? ""}
          options={integrationOverrideOptions}
          disabled={controlsDisabled}
          onChange={(nextValue) =>
            applyOverridePatch({
              integrationType: nextValue === ""
                ? undefined
                : (nextValue as CouplingOverrides["integrationType"]),
            })}
        />
      </div>

      <div className={formGroup}>
        <label className={label} htmlFor="node-coupling-subdomain">
          Subdomain Override
        </label>
        <TacticalSelect
          id="node-coupling-subdomain"
          ariaLabel="Subdomain override"
          value={couplingOverrides.subdomainType ?? ""}
          options={subdomainOverrideOptions}
          disabled={controlsDisabled}
          onChange={(nextValue) =>
            applyOverridePatch({
              subdomainType: nextValue === ""
                ? undefined
                : (nextValue as CouplingOverrides["subdomainType"]),
            })}
        />
      </div>

      <button
        type="button"
        className={toolbarButton}
        onClick={resetCouplingOverrides}
        disabled={!hasOverrides && scoreMode === "auto"}
      >
        Use Recommended Defaults
      </button>
    </div>
  );
}
