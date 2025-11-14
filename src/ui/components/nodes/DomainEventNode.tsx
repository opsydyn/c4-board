/**
 * DomainEventNode - DDD Strategic Element
 *
 * Represents a domain event in Domain-Driven Design.
 * Domain events are notifications of something that has happened in the domain.
 */

import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import {
	nodeContent,
	domainEventNode,
	domainEventNodeDescription,
	domainEventNodeIcon,
	domainEventNodeLabel,
} from "./styles.css";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import type { NodeIconId } from "../../../core/effects/node-operations";

interface DomainEventNodeData {
	label?: string;
	description?: string;
	iconId?: NodeIconId;
}

function isDomainEventNodeData(value: unknown): value is DomainEventNodeData {
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

export function DomainEventNode({ data, selected }: NodeProps) {
	const nodeData: DomainEventNodeData = isDomainEventNodeData(data) ? data : {};
	const Icon = getNodeIconComponent(nodeData.iconId, "domainEvent");

	return (
		<div className={domainEventNode} data-selected={selected}>
			<Handle type="target" position={Position.Top} id="top" />
			<Handle type="target" position={Position.Left} id="left" />

			<div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
				<div className={domainEventNodeIcon}>
					<Icon size={20} weight="duotone" />
				</div>
				<div className={domainEventNodeLabel}>{nodeData.label ?? "Domain Event"}</div>
			</div>

			<div className={nodeContent}>
				{nodeData.description && (
					<div className={domainEventNodeDescription}>{nodeData.description}</div>
				)}
			</div>

			<Handle type="source" position={Position.Right} id="right" />
			<Handle type="source" position={Position.Bottom} id="bottom" />
		</div>
	);
}
