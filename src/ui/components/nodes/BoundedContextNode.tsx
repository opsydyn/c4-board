/**
 * BoundedContextNode - DDD Strategic Element (Resizable Group)
 *
 * Represents a bounded context in Domain-Driven Design.
 * A bounded context is an explicit boundary within which a domain model is defined.
 * Can contain aggregates, entities, value objects, and other tactical DDD elements.
 */

import type { NodeProps } from "@xyflow/react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import {
	boundedContextNode,
	boundedContextNodeDescription,
	boundedContextNodeIcon,
	boundedContextNodeLabel,
	boundedContextNodeTechnology,
	boundedContextNodeHeader,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";

interface BoundedContextNodeData {
	label?: string;
	technology?: string;
	description?: string;
	iconId?: NodeIconId;
}

function isBoundedContextNodeData(value: unknown): value is BoundedContextNodeData {
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

export function BoundedContextNode({ data, selected }: NodeProps) {
	const nodeData: BoundedContextNodeData = isBoundedContextNodeData(data) ? data : {};
	const Icon = getNodeIconComponent(nodeData.iconId, "boundedContext");

	return (
		<>
			{/* NodeResizer makes this node resizable */}
			<NodeResizer
				minWidth={300}
				minHeight={200}
				isVisible={selected}
				lineClassName="border-purple-400"
			/>

			<div className={boundedContextNode} data-selected={selected}>
				{/* Input handles */}
				<Handle type="target" position={Position.Top} id="top" />
				<Handle type="target" position={Position.Left} id="left" />

				{/* Header with icon, label, and technology */}
				<div className={boundedContextNodeHeader}>
					<div className={boundedContextNodeIcon}>
						<Icon size={24} weight="duotone" />
					</div>
					<div>
						<div className={boundedContextNodeLabel}>{nodeData.label ?? "Bounded Context"}</div>
						{nodeData.technology && (
							<div className={boundedContextNodeTechnology}>[{nodeData.technology}]</div>
						)}
					</div>
				</div>

				{/* Description */}
				{nodeData.description && (
					<div className={boundedContextNodeDescription}>{nodeData.description}</div>
				)}

				{/* Output handles */}
				<Handle type="source" position={Position.Right} id="right" />
				<Handle type="source" position={Position.Bottom} id="bottom" />
			</div>
		</>
	);
}
