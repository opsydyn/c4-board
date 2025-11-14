/**
 * CommandNode - DDD Application Element
 *
 * Represents a command in Domain-Driven Design (CQRS pattern).
 * Commands represent write operations that change system state.
 */

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	commandNode,
	commandNodeDescription,
	commandNodeIcon,
	commandNodeLabel,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";

interface CommandNodeData {
	label?: string;
	description?: string;
	iconId?: NodeIconId;
}

function isCommandNodeData(value: unknown): value is CommandNodeData {
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

export function CommandNode({ data, selected }: NodeProps) {
	const nodeData: CommandNodeData = isCommandNodeData(data) ? data : {};
	const Icon = getNodeIconComponent(nodeData.iconId, "command");

	return (
		<div className={commandNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Left} id="left" />

			<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
				<div className={commandNodeIcon}>
					<Icon size={20} weight="duotone" />
				</div>
				<div className={commandNodeLabel}>{nodeData.label ?? "Command"}</div>
			</div>

			<div className={nodeContent}>
				{nodeData.description && (
					<div className={commandNodeDescription}>{nodeData.description}</div>
				)}
			</div>

			<Handle type="source" position={Position.Right} id="right" />
			<Handle type="source" position={Position.Bottom} id="bottom" />
		</div>
	);
}
