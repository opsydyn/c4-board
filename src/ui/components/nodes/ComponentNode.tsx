/**
 * ComponentNode - C4 Component Element
 *
 * Represents a component (module, service) within a container.
 * Styled as a smaller blue box with a cube icon.
 */

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	componentNode,
	componentNodeDescription,
	componentNodeIcon,
	componentNodeLabel,
	componentNodeTechnology,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";

interface ComponentNodeData {
	label?: string;
	technology?: string;
	description?: string;
	iconId?: NodeIconId;
}

function isComponentNodeData(value: unknown): value is ComponentNodeData {
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

export function ComponentNode({ data, selected }: NodeProps) {
	const nodeData: ComponentNodeData = isComponentNodeData(data) ? data : {};
	const Icon = getNodeIconComponent(nodeData.iconId, "component");

	return (
		<div className={componentNode} data-selected={selected}>
			{/* Input handles (target) - can receive connections from any direction */}
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Left} id="left" />

			{/* Header: Icon + Label inline */}
		<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
			<div className={componentNodeIcon}>
				<Icon size={20} weight="duotone" />
			</div>
				<div className={componentNodeLabel}>{nodeData.label ?? "Component"}</div>
			</div>

			{/* Content: Technology and Description stacked below */}
			<div className={nodeContent}>
				{nodeData.technology && (
					<div className={componentNodeTechnology}>[{nodeData.technology}]</div>
				)}
				{nodeData.description && (
					<div className={componentNodeDescription}>{nodeData.description}</div>
				)}
			</div>

			{/* Output handles (source) - can send connections in any direction */}
			<Handle type="source" position={Position.Right} id="right" />
			<Handle type="source" position={Position.Bottom} id="bottom" />
		</div>
	);
}
