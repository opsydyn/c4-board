/**
 * FactoryNode - DDD Tactical Element
 *
 * Represents a factory in Domain-Driven Design.
 * Factories encapsulate complex object creation logic.
 */

import type { NodeProps } from "@xyflow/react";
import { useCallback, useState } from "react";
import type { NodeIconId } from "../../../core/effects/node-operations";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import { InlineEditor } from "./InlineEditor";
import { NodeHandles } from "./NodeHandles";
import {
  editableField,
  factoryNode,
  factoryNodeDescription,
  factoryNodeIcon,
  factoryNodeLabel,
  nodeContent,
} from "./styles.css";

interface FactoryNodeData {
  label?: string;
  description?: string;
  iconId?: NodeIconId;
  onUpdate?: (updates: Partial<FactoryNodeData>) => void;
}

function isFactoryNodeData(value: unknown): value is FactoryNodeData {
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

export function FactoryNode({ data, selected }: NodeProps) {
  const nodeData: FactoryNodeData = isFactoryNodeData(data) ? data : {};
  const Icon = getNodeIconComponent(nodeData.iconId, "factory");

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
    <div className={factoryNode} data-selected={selected}>
      <NodeHandles />

      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
        <div className={factoryNodeIcon}>
          <Icon size={24} weight="duotone" />
        </div>
        {isEditingLabel
          ? (
            <InlineEditor
              value={nodeData.label ?? ""}
              mode="plain"
              maxLength={50}
              placeholder="Enter factory name..."
              onSave={handleSaveLabel}
              onCancel={() => setIsEditingLabel(false)}
              autoFocus
            />
          )
          : (
            <div
              className={`${factoryNodeLabel} ${editableField}`}
              onDoubleClick={() => setIsEditingLabel(true)}
              title="Double-click to edit"
            >
              {nodeData.label ?? "Factory"}
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
              className={`${factoryNodeDescription} ${editableField}`}
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
