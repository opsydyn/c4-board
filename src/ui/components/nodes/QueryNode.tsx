/**
 * QueryNode - DDD Application Element
 *
 * Represents a query in Domain-Driven Design (CQRS pattern).
 * Queries represent read operations that retrieve data without side effects.
 */

import { useState, useCallback } from "react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	queryNode,
	queryNodeDescription,
	queryNodeIcon,
	queryNodeLabel,
	editableField,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";
import { InlineEditor } from "./InlineEditor";

interface QueryNodeData {
	label?: string;
	description?: string;
	iconId?: NodeIconId;
	onUpdate?: (updates: Partial<QueryNodeData>) => void;
}

function isQueryNodeData(value: unknown): value is QueryNodeData {
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

export function QueryNode({ data, selected }: NodeProps) {
	const nodeData: QueryNodeData = isQueryNodeData(data) ? data : {};
	const Icon = getNodeIconComponent(nodeData.iconId, "query");

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
		<div className={queryNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Left} id="left" />

			<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
				<div className={queryNodeIcon}>
					<Icon size={20} weight="duotone" />
				</div>
				{isEditingLabel ? (
					<InlineEditor
						value={nodeData.label ?? ""}
						mode="plain"
						maxLength={50}
						placeholder="Enter query name..."
						onSave={handleSaveLabel}
						onCancel={() => setIsEditingLabel(false)}
						autoFocus
					/>
				) : (
					<div
						className={`${queryNodeLabel} ${editableField}`}
						onDoubleClick={() => setIsEditingLabel(true)}
						title="Double-click to edit"
					>
						{nodeData.label ?? "Query"}
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
						className={`${queryNodeDescription} ${editableField}`}
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
