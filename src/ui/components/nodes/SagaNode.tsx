/**
 * SagaNode - DDD Infrastructure Element
 *
 * Represents a saga in Domain-Driven Design.
 * Sagas coordinate long-running business processes across multiple bounded contexts.
 */

import { useState, useCallback } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	sagaNode,
	sagaNodeDescription,
	sagaNodeIcon,
	sagaNodeLabel,
	editableField,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";
import { InlineEditor } from "./InlineEditor";

interface SagaNodeData {
	label?: string;
	description?: string;
	iconId?: NodeIconId;
	onUpdate?: (updates: Partial<SagaNodeData>) => void;
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
		<div className={sagaNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Left} id="left" />

			<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
				<div className={sagaNodeIcon}>
					<Icon size={24} weight="duotone" />
				</div>
				{isEditingLabel ? (
					<InlineEditor
						value={nodeData.label ?? ""}
						mode="plain"
						maxLength={50}
						placeholder="Enter saga name..."
						onSave={handleSaveLabel}
						onCancel={() => setIsEditingLabel(false)}
						autoFocus
					/>
				) : (
					<div
						className={`${sagaNodeLabel} ${editableField}`}
						onDoubleClick={() => setIsEditingLabel(true)}
						title="Double-click to edit"
					>
						{nodeData.label ?? "Saga"}
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
						className={`${sagaNodeDescription} ${editableField}`}
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
