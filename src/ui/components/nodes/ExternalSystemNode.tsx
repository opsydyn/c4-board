/**
 * ExternalSystemNode - C4 External System Element
 *
 * Represents an external/third-party system.
 * Styled as a gray box with dashed border.
 */

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	externalSystemNode,
	externalSystemNodeDescription,
	externalSystemNodeIcon,
	externalSystemNodeLabel,
	externalSystemNodeTechnology,
	nodeContent,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";

interface ExternalSystemNodeData {
	label?: string;
	technology?: string;
	description?: string;
	iconId?: NodeIconId;
}

function isExternalSystemNodeData(value: unknown): value is ExternalSystemNodeData {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const record = value as Record<string, unknown>;
const { label, technology, description, iconId } = record;

return (
	(label === undefined || typeof label === "string") &&
	(technology === undefined || typeof technology === "string") &&
	(description === undefined || typeof description === "string") &&
	(iconId === undefined || typeof iconId === "string")
);
}

export function ExternalSystemNode({
	data,
	selected,
}: NodeProps) {
	const nodeData: ExternalSystemNodeData = isExternalSystemNodeData(data) ? data : {};
	const Icon = getNodeIconComponent(nodeData.iconId, "externalSystem");

	return (
		<div className={externalSystemNode} data-selected={selected}>
			{/* Input handles (target) - can receive connections from any direction */}
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Left} id="left" />

			{/* Header: Icon + Label inline */}
		<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
			<div className={externalSystemNodeIcon}>
				<Icon size={24} weight="duotone" />
			</div>
				<div className={externalSystemNodeLabel}>{nodeData.label ?? "Unnamed"}</div>
			</div>

			{/* Content: Technology and Description stacked below */}
			<div className={nodeContent}>
				{nodeData.technology && (
					<div className={externalSystemNodeTechnology}>[{nodeData.technology}]</div>
				)}
				{nodeData.description && (
					<div className={externalSystemNodeDescription}>
						{nodeData.description}
					</div>
				)}
			</div>

			{/* Output handles (source) - can send connections in any direction */}
			<Handle type="source" position={Position.Right} id="right" />
			<Handle type="source" position={Position.Bottom} id="bottom" />
		</div>
	);
}
