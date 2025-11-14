/**
 * ApplicationServiceNode - DDD Application Element
 *
 * Represents an application service in Domain-Driven Design.
 * Application services orchestrate use cases and coordinate domain logic.
 */

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	applicationServiceNode,
	applicationServiceNodeDescription,
	applicationServiceNodeIcon,
	applicationServiceNodeLabel,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";

interface ApplicationServiceNodeData {
	label?: string;
	description?: string;
	iconId?: NodeIconId;
}

function isApplicationServiceNodeData(value: unknown): value is ApplicationServiceNodeData {
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

export function ApplicationServiceNode({ data, selected }: NodeProps) {
	const nodeData: ApplicationServiceNodeData = isApplicationServiceNodeData(data) ? data : {};
	const Icon = getNodeIconComponent(nodeData.iconId, "applicationService");

	return (
		<div className={applicationServiceNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Left} id="left" />

			<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
				<div className={applicationServiceNodeIcon}>
					<Icon size={24} weight="duotone" />
				</div>
				<div className={applicationServiceNodeLabel}>{nodeData.label ?? "Application Service"}</div>
			</div>

			<div className={nodeContent}>
				{nodeData.description && (
					<div className={applicationServiceNodeDescription}>{nodeData.description}</div>
				)}
			</div>

			<Handle type="source" position={Position.Right} id="right" />
			<Handle type="source" position={Position.Bottom} id="bottom" />
		</div>
	);
}
