/**
 * BoundedContextNode - DDD Strategic Element (Resizable Group)
 *
 * Represents a bounded context in Domain-Driven Design.
 * A bounded context is an explicit boundary within which a domain model is defined.
 * Can contain aggregates, entities, value objects, and other tactical DDD elements.
 */

import type { NodeProps } from "@xyflow/react";
import { NodeResizer } from "@xyflow/react";
import { useCallback, useState } from "react";
import type { NodeIconId } from "../../../core/effects/node-operations";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import { InlineEditor } from "./InlineEditor";
import { NodeHandles } from "./NodeHandles";
import {
  boundedContextNode,
  boundedContextNodeDescription,
  boundedContextNodeHeader,
  boundedContextNodeIcon,
  boundedContextNodeLabel,
  boundedContextNodeTechnology,
  editableField,
} from "./styles.css";

interface BoundedContextNodeData {
  label?: string;
  technology?: string;
  description?: string;
  iconId?: NodeIconId;
  onUpdate?: (updates: Partial<BoundedContextNodeData>) => void;
}

function isBoundedContextNodeData(value: unknown): value is BoundedContextNodeData {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  const { label, technology, description, iconId } = record;

  return (
    (label === undefined || typeof label === "string")
    && (technology === undefined || typeof technology === "string")
    && (description === undefined || typeof description === "string")
    && (iconId === undefined || typeof iconId === "string")
  );
}

export function BoundedContextNode({ data, selected }: NodeProps) {
  const nodeData: BoundedContextNodeData = isBoundedContextNodeData(data) ? data : {};
  const Icon = getNodeIconComponent(nodeData.iconId, "boundedContext");

  // Edit state for label, technology, and description
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [isEditingTechnology, setIsEditingTechnology] = useState(false);
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

  const handleSaveTechnology = useCallback(
    (newTechnology: string) => {
      if (nodeData.onUpdate) {
        nodeData.onUpdate({ technology: newTechnology });
      }
      setIsEditingTechnology(false);
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
        <NodeHandles />

        {/* Header with icon, label, and technology */}
        <div className={boundedContextNodeHeader}>
          <div className={boundedContextNodeIcon}>
            <Icon size={24} weight="duotone" />
          </div>
          <div>
            {isEditingLabel
              ? (
                <InlineEditor
                  value={nodeData.label ?? ""}
                  mode="plain"
                  maxLength={50}
                  placeholder="Enter bounded context name..."
                  onSave={handleSaveLabel}
                  onCancel={() => setIsEditingLabel(false)}
                  autoFocus
                />
              )
              : (
                <div
                  className={`${boundedContextNodeLabel} ${editableField}`}
                  onDoubleClick={() => setIsEditingLabel(true)}
                  title="Double-click to edit"
                >
                  {nodeData.label ?? "Bounded Context"}
                </div>
              )}
            {isEditingTechnology
              ? (
                <InlineEditor
                  value={nodeData.technology ?? ""}
                  mode="plain"
                  maxLength={50}
                  placeholder="Enter technology..."
                  onSave={handleSaveTechnology}
                  onCancel={() => setIsEditingTechnology(false)}
                  autoFocus
                />
              )
              : (
                <div
                  className={`${boundedContextNodeTechnology} ${editableField}`}
                  onDoubleClick={() => setIsEditingTechnology(true)}
                  title="Double-click to edit"
                >
                  {nodeData.technology ? `[${nodeData.technology}]` : "[Add technology]"}
                </div>
              )}
          </div>
        </div>

        {/* Description */}
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
              className={`${boundedContextNodeDescription} ${editableField}`}
              onDoubleClick={() => setIsEditingDescription(true)}
              title="Double-click to edit"
            >
              {nodeData.description ?? "Add description..."}
            </div>
          )}

        {/* Output handles */}
      </div>
    </>
  );
}
