/**
 * IntegrationEventNode - DDD Infrastructure Element
 *
 * Represents an integration event in Domain-Driven Design.
 * Integration events communicate changes between bounded contexts.
 */

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	integrationEventNode,
	integrationEventNodeDescription,
	integrationEventNodeIcon,
	integrationEventNodeLabel,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";

interface IntegrationEventNodeData {
	label?: string;
	description?: string;
	iconId?: NodeIconId;
}

function isIntegrationEventNodeData(value: unknown): value is IntegrationEventNodeData {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const record = value as Record<string, unknown>;
	const { label, description, iconId } = record;

	return (
		(label === undefined || typeof label === "string") &&
		(description === undefined || typeof description === "string") &&
		(iconId === undefined || typeof iconId === "string")
	);
}

export function IntegrationEventNode({ data, selected }: NodeProps) {
	const nodeData: IntegrationEventNodeData = isIntegrationEventNodeData(data) ? data : {};
	const Icon = getNodeIconComponent(nodeData.iconId, "integrationEvent");

	return (
		<div className={integrationEventNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Left} id="left" />

			<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
				<div className={integrationEventNodeIcon}>
					<Icon size={20} weight="duotone" />
				</div>
				<div className={integrationEventNodeLabel}>{nodeData.label ?? "Integration Event"}</div>
			</div>

			<div className={nodeContent}>
				{nodeData.description && (
					<div className={integrationEventNodeDescription}>{nodeData.description}</div>
				)}
			</div>

			<Handle type="source" position={Position.Right} id="right" />
			<Handle type="source" position={Position.Bottom} id="bottom" />
		</div>
	);
}
