/**
 * QueryNode - DDD Application Element
 *
 * Represents a query in Domain-Driven Design (CQRS pattern).
 * Queries represent read operations that retrieve data without side effects.
 */

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	queryNode,
	queryNodeDescription,
	queryNodeIcon,
	queryNodeLabel,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";

interface QueryNodeData {
	label?: string;
	description?: string;
	iconId?: NodeIconId;
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

	return (
		<div className={queryNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Left} id="left" />

			<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
				<div className={queryNodeIcon}>
					<Icon size={20} weight="duotone" />
				</div>
				<div className={queryNodeLabel}>{nodeData.label ?? "Query"}</div>
			</div>

			<div className={nodeContent}>
				{nodeData.description && (
					<div className={queryNodeDescription}>{nodeData.description}</div>
				)}
			</div>

			<Handle type="source" position={Position.Right} id="right" />
			<Handle type="source" position={Position.Bottom} id="bottom" />
		</div>
	);
}
