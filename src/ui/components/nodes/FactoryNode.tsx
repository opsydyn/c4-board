/**
 * FactoryNode - DDD Tactical Element
 *
 * Represents a factory in Domain-Driven Design.
 * Factories encapsulate complex object creation logic.
 */

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	factoryNode,
	factoryNodeDescription,
	factoryNodeIcon,
	factoryNodeLabel,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";

interface FactoryNodeData {
	label?: string;
	description?: string;
	iconId?: NodeIconId;
}

function isFactoryNodeData(value: unknown): value is FactoryNodeData {
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

export function FactoryNode({ data, selected }: NodeProps) {
	const nodeData: FactoryNodeData = isFactoryNodeData(data) ? data : {};
	const Icon = getNodeIconComponent(nodeData.iconId, "factory");

	return (
		<div className={factoryNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Left} id="left" />

			<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
				<div className={factoryNodeIcon}>
					<Icon size={24} weight="duotone" />
				</div>
				<div className={factoryNodeLabel}>{nodeData.label ?? "Factory"}</div>
			</div>

			<div className={nodeContent}>
				{nodeData.description && (
					<div className={factoryNodeDescription}>{nodeData.description}</div>
				)}
			</div>

			<Handle type="source" position={Position.Right} id="right" />
			<Handle type="source" position={Position.Bottom} id="bottom" />
		</div>
	);
}
