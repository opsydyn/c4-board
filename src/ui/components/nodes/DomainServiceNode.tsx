/**
 * DomainServiceNode - DDD Tactical Element
 *
 * Represents a domain service in Domain-Driven Design.
 * Domain services encapsulate domain logic that doesn't naturally fit within an entity or value object.
 */

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	domainServiceNode,
	domainServiceNodeDescription,
	domainServiceNodeIcon,
	domainServiceNodeLabel,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";

interface DomainServiceNodeData {
	label?: string;
	description?: string;
	iconId?: NodeIconId;
}

function isDomainServiceNodeData(value: unknown): value is DomainServiceNodeData {
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

export function DomainServiceNode({ data, selected }: NodeProps) {
	const nodeData: DomainServiceNodeData = isDomainServiceNodeData(data) ? data : {};
	const Icon = getNodeIconComponent(nodeData.iconId, "domainService");

	return (
		<div className={domainServiceNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Left} id="left" />

			<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
				<div className={domainServiceNodeIcon}>
					<Icon size={24} weight="duotone" />
				</div>
				<div className={domainServiceNodeLabel}>{nodeData.label ?? "Domain Service"}</div>
			</div>

			<div className={nodeContent}>
				{nodeData.description && (
					<div className={domainServiceNodeDescription}>{nodeData.description}</div>
				)}
			</div>

			<Handle type="source" position={Position.Right} id="right" />
			<Handle type="source" position={Position.Bottom} id="bottom" />
		</div>
	);
}
