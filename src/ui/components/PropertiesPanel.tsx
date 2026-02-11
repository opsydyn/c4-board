/**
 * PropertiesPanel - Edit selected node properties
 *
 * Displays when a node is selected, allows editing its properties.
 */

import type { Node } from "@xyflow/react";
import type {
	CouplingOverrides,
	CouplingScoreMode,
	NodeData,
} from "../../core/effects/node-operations";
import {
	formGroup,
	input,
	label,
	panelTitle,
	propertiesPanel,
	textarea,
	toolbarButton,
} from "./styles.css";
import { TacticalSelect } from "./TacticalSelect";
import { IconPicker } from "./icons/IconPicker";

interface PropertiesPanelProps {
	selectedNode: Node<NodeData> | null;
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
	onUpdateNode,
}: PropertiesPanelProps) {
	if (!selectedNode) return null;

	const typeLabel =
		selectedNode.data?.c4Type ?? selectedNode.data?.dddType ?? selectedNode.type ?? "node";
	const scoreMode: CouplingScoreMode =
		selectedNode.data?.couplingScoreMode ?? "auto";
	const couplingOverrides: CouplingOverrides =
		selectedNode.data?.couplingOverrides ?? {};
	const controlsDisabled = scoreMode === "auto";
	const hasOverrides = Object.keys(couplingOverrides).length > 0;

	const handleChange = (field: keyof NodeData, value: string) => {
		onUpdateNode(selectedNode.id, { [field]: value });
	};

	const clampDimension = (value: number): number =>
		Math.max(1, Math.min(10, Number(value.toFixed(1))));

	const applyOverridePatch = (patch: CouplingOverridePatch) => {
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
		onUpdateNode(selectedNode.id, {
			couplingScoreMode: "auto",
			couplingOverrides: {},
		});
	};

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
					value={
						couplingOverrides.strength !== undefined
							? String(couplingOverrides.strength)
							: ""
					}
					onChange={(event) =>
						handleDimensionOverrideChange(
							"strength",
							event.currentTarget.value,
						)
					}
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
					value={
						couplingOverrides.distance !== undefined
							? String(couplingOverrides.distance)
							: ""
					}
					onChange={(event) =>
						handleDimensionOverrideChange(
							"distance",
							event.currentTarget.value,
						)
					}
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
					value={
						couplingOverrides.volatility !== undefined
							? String(couplingOverrides.volatility)
							: ""
					}
					onChange={(event) =>
						handleDimensionOverrideChange(
							"volatility",
							event.currentTarget.value,
						)
					}
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
							integrationType:
								nextValue === ""
									? undefined
									: (nextValue as CouplingOverrides["integrationType"]),
						})
					}
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
							subdomainType:
								nextValue === ""
									? undefined
									: (nextValue as CouplingOverrides["subdomainType"]),
						})
					}
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
