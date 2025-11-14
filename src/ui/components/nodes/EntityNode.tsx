/**
 * EntityNode - DDD Tactical Element
 *
 * Represents an entity in Domain-Driven Design.
 * Entities are objects defined by their identity rather than their attributes.
 */

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	entityNode,
	entityNodeDescription,
	entityNodeIcon,
	entityNodeLabel,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";

interface EntityNodeData {
	label?: string;
	description?: string;
	iconId?: NodeIconId;
}

function isEntityNodeData(value: unknown): value is EntityNodeData {
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

export function EntityNode({ data, selected }: NodeProps) {
	const nodeData: EntityNodeData = isEntityNodeData(data) ? data : {};
	const Icon = getNodeIconComponent(nodeData.iconId, "entity");

	return (
		<div className={entityNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Left} id="left" />

			<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
				<div className={entityNodeIcon}>
					<Icon size={24} weight="duotone" />
				</div>
				<div className={entityNodeLabel}>{nodeData.label ?? "Entity"}</div>
			</div>

			<div className={nodeContent}>
				{nodeData.description && (
					<div className={entityNodeDescription}>{nodeData.description}</div>
				)}
			</div>

			<Handle type="source" position={Position.Right} id="right" />
			<Handle type="source" position={Position.Bottom} id="bottom" />
		</div>
	);
}
