/**
 * DomainEventNode - DDD Strategic Element
 *
 * Represents a domain event in Domain-Driven Design.
 * Domain events are notifications of something that has happened in the domain.
 */

import type { NodeProps } from "@xyflow/react";
import { useCallback, useState } from "react";
import type { NodeIconId } from "../../../core/effects/node-operations";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import { InlineEditor } from "./InlineEditor";
import { NodeHandles } from "./NodeHandles";
import {
  domainEventNode,
  domainEventNodeDescription,
  domainEventNodeIcon,
  domainEventNodeLabel,
  editableField,
  nodeContent,
} from "./styles.css";

interface DomainEventNodeData {
  label?: string;
  description?: string;
  iconId?: NodeIconId;
  onUpdate?: (updates: Partial<DomainEventNodeData>) => void;
}

function isDomainEventNodeData(value: unknown): value is DomainEventNodeData {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const { label, description, iconId } = record;

  return (
    (label === undefined || typeof label === "string")
    && (description === undefined || typeof description === "string")
    && (iconId === undefined || typeof iconId === "string")
  );
}

export function DomainEventNode({ data, selected }: NodeProps) {
  const nodeData: DomainEventNodeData = isDomainEventNodeData(data) ? data : {};
  const Icon = getNodeIconComponent(nodeData.iconId, "domainEvent");

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
    <div className={domainEventNode} data-selected={selected}>
      <NodeHandles />

      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
        <div className={domainEventNodeIcon}>
          <Icon size={20} weight="duotone" />
        </div>
        {isEditingLabel
          ? (
            <InlineEditor
              value={nodeData.label ?? ""}
              mode="plain"
              maxLength={50}
              placeholder="Enter event name..."
              onSave={handleSaveLabel}
              onCancel={() => setIsEditingLabel(false)}
              autoFocus
            />
          )
          : (
            <div
              className={`${domainEventNodeLabel} ${editableField}`}
              onDoubleClick={() => setIsEditingLabel(true)}
              title="Double-click to edit"
            >
              {nodeData.label ?? "Domain Event"}
            </div>
          )}
      </div>

      <div className={nodeContent}>
        {isEditingDescription
          ? (
            <InlineEditor
              value={nodeData.description ?? ""}
              mode="rich"
              maxLength={500}
              placeholder="Enter description..."
              onSave={handleSaveDescription}
              onCancel={() => setIsEditingDescription(false)}
              autoFocus
            />
          )
          : (
            <div
              className={`${domainEventNodeDescription} ${editableField}`}
              onDoubleClick={() => setIsEditingDescription(true)}
              title="Double-click to edit"
            >
              {nodeData.description ?? "Add description..."}
            </div>
          )}
      </div>
    </div>
  );
}
