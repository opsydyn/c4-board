/**
 * ExternalSystemNode - C4 External System Element
 *
 * Represents an external/third-party system.
 * Styled as a gray box with dashed border.
 */

import { Cloud as CloudIcon } from "@phosphor-icons/react";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	externalSystemNode,
	externalSystemNodeDescription,
	externalSystemNodeIcon,
	externalSystemNodeLabel,
	externalSystemNodeTechnology,
	nodeContent,
} from "./styles.css";

interface ExternalSystemNodeData {
	label?: string;
	technology?: string;
	description?: string;
}

function isExternalSystemNodeData(value: unknown): value is ExternalSystemNodeData {
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

export function ExternalSystemNode({
	data,
	selected,
}: NodeProps) {
	const nodeData: ExternalSystemNodeData = isExternalSystemNodeData(data) ? data : {};

	return (
		<div className={externalSystemNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} />

			<div className={externalSystemNodeIcon}>
				<CloudIcon size={24} weight="duotone" />
			</div>

			<div className={nodeContent}>
				<div className={externalSystemNodeLabel}>{nodeData.label ?? "Unnamed"}</div>
				{nodeData.technology && (
					<div className={externalSystemNodeTechnology}>[{nodeData.technology}]</div>
				)}
				{nodeData.description && (
					<div className={externalSystemNodeDescription}>
						{nodeData.description}
					</div>
				)}
			</div>

			<Handle type="source" position={Position.Bottom} />
		</div>
	);
}
