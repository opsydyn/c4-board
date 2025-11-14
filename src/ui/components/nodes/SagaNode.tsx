/**
 * SagaNode - DDD Infrastructure Element
 *
 * Represents a saga in Domain-Driven Design.
 * Sagas coordinate long-running business processes across multiple bounded contexts.
 */

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	sagaNode,
	sagaNodeDescription,
	sagaNodeIcon,
	sagaNodeLabel,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";

interface SagaNodeData {
	label?: string;
	description?: string;
	iconId?: NodeIconId;
}

function isSagaNodeData(value: unknown): value is SagaNodeData {
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

export function SagaNode({ data, selected }: NodeProps) {
	const nodeData: SagaNodeData = isSagaNodeData(data) ? data : {};
	const Icon = getNodeIconComponent(nodeData.iconId, "saga");

	return (
		<div className={sagaNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Left} id="left" />

			<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
				<div className={sagaNodeIcon}>
					<Icon size={24} weight="duotone" />
				</div>
				<div className={sagaNodeLabel}>{nodeData.label ?? "Saga"}</div>
			</div>

			<div className={nodeContent}>
				{nodeData.description && (
					<div className={sagaNodeDescription}>{nodeData.description}</div>
				)}
			</div>

			<Handle type="source" position={Position.Right} id="right" />
			<Handle type="source" position={Position.Bottom} id="bottom" />
		</div>
	);
}
