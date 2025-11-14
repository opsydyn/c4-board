/**
 * ValueObjectNode - DDD Tactical Element
 *
 * Represents a value object in Domain-Driven Design.
 * Value objects are immutable objects defined by their attributes.
 */

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	valueObjectNode,
	valueObjectNodeDescription,
	valueObjectNodeIcon,
	valueObjectNodeLabel,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";

interface ValueObjectNodeData {
	label?: string;
	description?: string;
	iconId?: NodeIconId;
}

function isValueObjectNodeData(value: unknown): value is ValueObjectNodeData {
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

export function ValueObjectNode({ data, selected }: NodeProps) {
	const nodeData: ValueObjectNodeData = isValueObjectNodeData(data) ? data : {};
	const Icon = getNodeIconComponent(nodeData.iconId, "valueObject");

	return (
		<div className={valueObjectNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Left} id="left" />

			<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
				<div className={valueObjectNodeIcon}>
					<Icon size={20} weight="duotone" />
				</div>
				<div className={valueObjectNodeLabel}>{nodeData.label ?? "Value Object"}</div>
			</div>

			<div className={nodeContent}>
				{nodeData.description && (
					<div className={valueObjectNodeDescription}>{nodeData.description}</div>
				)}
			</div>

			<Handle type="source" position={Position.Right} id="right" />
			<Handle type="source" position={Position.Bottom} id="bottom" />
		</div>
	);
}
