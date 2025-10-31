/**
 * ContainerNode - C4 Container Element (Resizable Group)
 *
 * Represents a container (application, database, etc.) that can contain components.
 * Styled as a resizable dashed border box that can group child nodes.
 */

import type { NodeProps } from "@xyflow/react";
import { Handle, Position, NodeResizer } from "@xyflow/react";
import {
	containerNode,
	containerNodeHeader,
	containerNodeIcon,
	containerNodeLabel,
	containerNodeTechnology,
	containerNodeDescription,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";

interface ContainerNodeData {
	label?: string;
	technology?: string;
	description?: string;
	iconId?: NodeIconId;
}

function isContainerNodeData(value: unknown): value is ContainerNodeData {
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

export function ContainerNode({ data, selected }: NodeProps) {
	const nodeData: ContainerNodeData = isContainerNodeData(data) ? data : {};
	const Icon = getNodeIconComponent(nodeData.iconId, "container");

	return (
		<>
			{/* NodeResizer makes this node resizable */}
			<NodeResizer
				minWidth={200}
				minHeight={150}
				isVisible={selected}
				lineClassName="border-blue-400"
			/>

			<div className={containerNode} data-selected={selected}>
				{/* Input handles (target) - can receive connections from any direction */}
				<Handle type="target" position={Position.Top} id="top" />
				<Handle type="target" position={Position.Left} id="left" />

				{/* Header with icon and label */}
				<div className={containerNodeHeader}>
			<div className={containerNodeIcon}>
				<Icon size={24} weight="duotone" />
			</div>
					<div>
						<div className={containerNodeLabel}>{nodeData.label ?? "Container"}</div>
						{nodeData.technology && (
							<div className={containerNodeTechnology}>[{nodeData.technology}]</div>
						)}
					</div>
				</div>

				{/* Description */}
				{nodeData.description && (
					<div className={containerNodeDescription}>{nodeData.description}</div>
				)}

				{/* Output handles (source) - can send connections in any direction */}
				<Handle type="source" position={Position.Right} id="right" />
				<Handle type="source" position={Position.Bottom} id="bottom" />
			</div>
		</>
	);
}
