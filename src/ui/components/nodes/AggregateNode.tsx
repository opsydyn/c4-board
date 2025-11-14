/**
 * AggregateNode - DDD Tactical Element (Resizable Group)
 *
 * Represents an aggregate in Domain-Driven Design.
 * An aggregate is a cluster of domain objects treated as a single unit.
 * Can contain entities, value objects, and domain services.
 */

import type { NodeProps } from "@xyflow/react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import {
	aggregateNode,
	aggregateNodeDescription,
	aggregateNodeIcon,
	aggregateNodeLabel,
	aggregateNodeTechnology,
	aggregateNodeHeader,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";

interface AggregateNodeData {
	label?: string;
	technology?: string;
	description?: string;
	iconId?: NodeIconId;
}

function isAggregateNodeData(value: unknown): value is AggregateNodeData {
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

export function AggregateNode({ data, selected }: NodeProps) {
	const nodeData: AggregateNodeData = isAggregateNodeData(data) ? data : {};
	const Icon = getNodeIconComponent(nodeData.iconId, "aggregate");

	return (
		<>
			{/* NodeResizer makes this node resizable */}
			<NodeResizer
				minWidth={240}
				minHeight={160}
				isVisible={selected}
				lineClassName="border-cyan-400"
			/>

			<div className={aggregateNode} data-selected={selected}>
				<Handle type="target" position={Position.Top} id="top" />
				<Handle type="target" position={Position.Left} id="left" />

				{/* Header with icon, label, and technology */}
				<div className={aggregateNodeHeader}>
					<div className={aggregateNodeIcon}>
						<Icon size={24} weight="duotone" />
					</div>
					<div>
						<div className={aggregateNodeLabel}>{nodeData.label ?? "Aggregate"}</div>
						{nodeData.technology && (
							<div className={aggregateNodeTechnology}>[{nodeData.technology}]</div>
						)}
					</div>
				</div>

				{/* Description */}
				{nodeData.description && (
					<div className={aggregateNodeDescription}>{nodeData.description}</div>
				)}

				<Handle type="source" position={Position.Right} id="right" />
				<Handle type="source" position={Position.Bottom} id="bottom" />
			</div>
		</>
	);
}
