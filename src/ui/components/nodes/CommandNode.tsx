/**
 * CommandNode - DDD Application Element
 *
 * Represents a command in Domain-Driven Design (CQRS pattern).
 * Commands represent write operations that change system state.
 */

import { useState, useCallback } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	commandNode,
	commandNodeDescription,
	commandNodeIcon,
	commandNodeLabel,
	editableField,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";
import { InlineEditor } from "./InlineEditor";

interface CommandNodeData {
	label?: string;
	description?: string;
	iconId?: NodeIconId;
	onUpdate?: (updates: Partial<CommandNodeData>) => void;
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

	// Edit state
	const [isEditingLabel, setIsEditingLabel] = useState(false);
	const [isEditingDescription, setIsEditingDescription] = useState(false);

	// Save handlers
	const handleSaveLabel = useCallback(
		(newLabel: string) => {
			if (nodeData.onUpdate) {
				nodeData.onUpdate({ label: newLabel });
			}
			setIsEditingLabel(false);
		},
		[nodeData],
	);

	const handleSaveDescription = useCallback(
		(newDescription: string) => {
			if (nodeData.onUpdate) {
				nodeData.onUpdate({ description: newDescription });
			}
			setIsEditingDescription(false);
		},
		[nodeData],
	);

	return (
		<div className={commandNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Left} id="left" />

			<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
				<div className={commandNodeIcon}>
					<Icon size={20} weight="duotone" />
				</div>
				{isEditingLabel ? (
					<InlineEditor
						value={nodeData.label ?? ""}
						mode="plain"
						maxLength={50}
						placeholder="Enter command name..."
						onSave={handleSaveLabel}
						onCancel={() => setIsEditingLabel(false)}
						autoFocus
					/>
				) : (
					<div
						className={`${commandNodeLabel} ${editableField}`}
						onDoubleClick={() => setIsEditingLabel(true)}
						title="Double-click to edit"
					>
						{nodeData.label ?? "Command"}
					</div>
				)}
			</div>

			<div className={nodeContent}>
				{isEditingDescription ? (
					<InlineEditor
						value={nodeData.description ?? ""}
						mode="rich"
						maxLength={500}
						placeholder="Enter description..."
						onSave={handleSaveDescription}
						onCancel={() => setIsEditingDescription(false)}
						autoFocus
					/>
				) : (
					<div
						className={`${commandNodeDescription} ${editableField}`}
						onDoubleClick={() => setIsEditingDescription(true)}
						title="Double-click to edit"
					>
						{nodeData.description ?? "Add description..."}
					</div>
				)}
			</div>

			<Handle type="source" position={Position.Right} id="right" />
			<Handle type="source" position={Position.Bottom} id="bottom" />
		</div>
	);
}
