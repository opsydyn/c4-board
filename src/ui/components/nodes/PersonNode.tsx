/**
 * PersonNode - C4 Person Element
 *
 * Represents a human user/actor in the system.
 * Styled as a blue box with an icon.
 */

import {  UserIcon } from "@phosphor-icons/react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	personNode,
	personNodeDescription,
	personNodeIcon,
	personNodeLabel,
	personNodeTechnology,
} from "./styles.css";

interface PersonNodeData {
	label?: string;
	technology?: string;
	description?: string;
}

function isPersonNodeData(value: unknown): value is PersonNodeData {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	const record = value as Record<string, unknown>;
	const { label, technology, description } = record;

	return (
		(label === undefined || typeof label === "string") &&
		(technology === undefined || typeof technology === "string") &&
		(description === undefined || typeof description === "string")
	);
}

export function PersonNode({ data, selected }: NodeProps) {
	const nodeData: PersonNodeData = isPersonNodeData(data) ? data : {};

	return (
		<div className={personNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} />

			<div className={personNodeIcon}>
				<UserIcon size={24} weight="duotone" />
			</div>

			<div className={nodeContent}>
				<div className={personNodeLabel}>{nodeData.label ?? "Unnamed"}</div>
				{nodeData.technology && (
					<div className={personNodeTechnology}>[{nodeData.technology}]</div>
				)}
				{nodeData.description && (
					<div className={personNodeDescription}>{nodeData.description}</div>
				)}
			</div>

			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}
