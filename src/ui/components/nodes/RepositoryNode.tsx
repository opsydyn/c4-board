/**
 * RepositoryNode - DDD Tactical Element
 *
 * Represents a repository in Domain-Driven Design.
 * Repositories abstract data access and persistence for aggregates.
 */

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	repositoryNode,
	repositoryNodeDescription,
	repositoryNodeIcon,
	repositoryNodeLabel,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";

interface RepositoryNodeData {
	label?: string;
	description?: string;
	iconId?: NodeIconId;
}

function isRepositoryNodeData(value: unknown): value is RepositoryNodeData {
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

export function RepositoryNode({ data, selected }: NodeProps) {
	const nodeData: RepositoryNodeData = isRepositoryNodeData(data) ? data : {};
	const Icon = getNodeIconComponent(nodeData.iconId, "repository");

	return (
		<div className={repositoryNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Left} id="left" />

			<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
				<div className={repositoryNodeIcon}>
					<Icon size={24} weight="duotone" />
				</div>
				<div className={repositoryNodeLabel}>{nodeData.label ?? "Repository"}</div>
			</div>

			<div className={nodeContent}>
				{nodeData.description && (
					<div className={repositoryNodeDescription}>{nodeData.description}</div>
				)}
			</div>

			<Handle type="source" position={Position.Right} id="right" />
			<Handle type="source" position={Position.Bottom} id="bottom" />
		</div>
	);
}
