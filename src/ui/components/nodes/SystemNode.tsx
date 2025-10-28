/**
 * SystemNode - C4 Software System Element
 *
 * Represents a software system in the architecture.
 * Styled as a gray/blue box.
 */

import {  PackageIcon } from "@phosphor-icons/react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	systemNode,
	systemNodeDescription,
	systemNodeIcon,
	systemNodeLabel,
	systemNodeTechnology,
} from "./styles.css";

interface SystemNodeData {
	label?: string;
	technology?: string;
	description?: string;
}

function isSystemNodeData(value: unknown): value is SystemNodeData {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const record = value as Record<string, unknown>;
	const { label, technology, description } = record;

	return (
		(label === undefined || typeof label === "string") &&
		(technology === undefined || typeof technology === "string") &&
		(description === undefined || typeof description === "string")
	);
}

export function SystemNode({ data, selected }: NodeProps) {
	const nodeData: SystemNodeData = isSystemNodeData(data) ? data : {};

	return (
		<div className={systemNode} data-selected={selected}>
			{/* Input handles (target) - can receive connections from any direction */}
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Left} id="left" />

			{/* Header: Icon + Label inline */}
			<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
				<div className={systemNodeIcon}>
					<PackageIcon size={24} weight="duotone" />
				</div>
				<div className={systemNodeLabel}>{nodeData.label ?? "Unnamed"}</div>
			</div>

			{/* Content: Technology and Description stacked below */}
			<div className={nodeContent}>
				{nodeData.technology && (
					<div className={systemNodeTechnology}>[{nodeData.technology}]</div>
				)}
				{nodeData.description && (
					<div className={systemNodeDescription}>{nodeData.description}</div>
				)}
			</div>

			{/* Output handles (source) - can send connections in any direction */}
			<Handle type="source" position={Position.Right} id="right" />
			<Handle type="source" position={Position.Bottom} id="bottom" />
		</div>
	);
}
