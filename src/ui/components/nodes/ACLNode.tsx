/**
 * ACLNode - DDD Infrastructure Element
 *
 * Represents an Anti-Corruption Layer in Domain-Driven Design.
 * ACLs protect domain models from external systems and legacy code.
 */

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	aclNode,
	aclNodeDescription,
	aclNodeIcon,
	aclNodeLabel,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";

interface ACLNodeData {
	label?: string;
	description?: string;
	iconId?: NodeIconId;
}

function isACLNodeData(value: unknown): value is ACLNodeData {
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

export function ACLNode({ data, selected }: NodeProps) {
	const nodeData: ACLNodeData = isACLNodeData(data) ? data : {};
	const Icon = getNodeIconComponent(nodeData.iconId, "antiCorruptionLayer");

	return (
		<div className={aclNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Left} id="left" />

			<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
				<div className={aclNodeIcon}>
					<Icon size={24} weight="duotone" />
				</div>
				<div className={aclNodeLabel}>{nodeData.label ?? "Anti-Corruption Layer"}</div>
			</div>

			<div className={nodeContent}>
				{nodeData.description && (
					<div className={aclNodeDescription}>{nodeData.description}</div>
				)}
			</div>

			<Handle type="source" position={Position.Right} id="right" />
			<Handle type="source" position={Position.Bottom} id="bottom" />
		</div>
	);
}
