/**
 * AggregateNode - DDD Tactical Element (Resizable Group)
 *
 * Represents an aggregate in Domain-Driven Design.
 * An aggregate is a cluster of domain objects treated as a single unit.
 * Can contain entities, value objects, and domain services.
 */

import type { NodeProps } from "@xyflow/react";
import { NodeResizer } from "@xyflow/react";
import { useCallback, useState } from "react";
import type { NodeIconId } from "../../../core/effects/node-operations";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import { InlineEditor } from "./InlineEditor";
import { NodeHandles } from "./NodeHandles";
import {
  aggregateNode,
  aggregateNodeDescription,
  aggregateNodeHeader,
  aggregateNodeIcon,
  aggregateNodeLabel,
  aggregateNodeTechnology,
  editableField,
} from "./styles.css";

interface AggregateNodeData {
  label?: string;
  technology?: string;
  description?: string;
  iconId?: NodeIconId;
  onUpdate?: (updates: Partial<AggregateNodeData>) => void;
}

function isAggregateNodeData(value: unknown): value is AggregateNodeData {
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

export function AggregateNode({ data, selected }: NodeProps) {
  const nodeData: AggregateNodeData = isAggregateNodeData(data) ? data : {};
  const Icon = getNodeIconComponent(nodeData.iconId, "aggregate");

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
        minWidth={240}
        minHeight={160}
        isVisible={selected}
        lineClassName="border-cyan-400"
      />

      <div className={aggregateNode} data-selected={selected}>
        <NodeHandles />

        {/* Header with icon, label, and technology */}
        <div className={aggregateNodeHeader}>
          <div className={aggregateNodeIcon}>
            <Icon size={24} weight="duotone" />
          </div>
          <div>
            {isEditingLabel
              ? (
                <InlineEditor
                  value={nodeData.label ?? ""}
                  mode="plain"
                  maxLength={50}
                  placeholder="Enter aggregate name..."
                  onSave={handleSaveLabel}
                  onCancel={() => setIsEditingLabel(false)}
                  autoFocus
                />
              )
              : (
                <div
                  className={`${aggregateNodeLabel} ${editableField}`}
                  onDoubleClick={() => setIsEditingLabel(true)}
                  title="Double-click to edit"
                >
                  {nodeData.label ?? "Aggregate"}
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
                  className={`${aggregateNodeTechnology} ${editableField}`}
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
              className={`${aggregateNodeDescription} ${editableField}`}
              onDoubleClick={() => setIsEditingDescription(true)}
              title="Double-click to edit"
            >
              {nodeData.description ?? "Add description..."}
            </div>
          )}
      </div>
    </>
  );
}
