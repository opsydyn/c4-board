/**
 * ContainerNode - C4 Container Element (Resizable Group)
 *
 * Represents a container (application, database, etc.) that can contain components.
 * Styled as a resizable dashed border box that can group child nodes.
 *
 * Features:
 * - Inline editing for label, technology, and description
 * - Double-click to edit
 * - Auto-save on blur, cancel on ESC
 * - Resizable
 */

import type { NodeProps } from "@xyflow/react";
import { NodeResizer } from "@xyflow/react";
import { useCallback, useState } from "react";
import type { NodeIconId } from "../../../core/effects/node-operations";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import { InlineEditor } from "./InlineEditor";
import { NodeHandles } from "./NodeHandles";
import {
  containerNode,
  containerNodeDescription,
  containerNodeHeader,
  containerNodeIcon,
  containerNodeLabel,
  containerNodeTechnology,
  editableField,
} from "./styles.css";

interface ContainerNodeData {
  label?: string;
  technology?: string;
  description?: string;
  iconId?: NodeIconId;
  // Callback for updating node data
  onUpdate?: (updates: Partial<ContainerNodeData>) => void;
}

function isContainerNodeData(value: unknown): value is ContainerNodeData {
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

export function ContainerNode({ data, selected }: NodeProps) {
  const nodeData: ContainerNodeData = isContainerNodeData(data) ? data : {};
  const Icon = getNodeIconComponent(nodeData.iconId, "container");

  // Edit state
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [isEditingTechnology, setIsEditingTechnology] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  // Handlers
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
        minWidth={200}
        minHeight={150}
        isVisible={selected}
        lineClassName="border-blue-400"
      />

      <div className={containerNode} data-selected={selected}>
        <NodeHandles />

        {/* Header with icon and label */}
        <div className={containerNodeHeader}>
          <div className={containerNodeIcon}>
            <Icon size={24} weight="duotone" />
          </div>
          <div>
            {isEditingLabel
              ? (
                <InlineEditor
                  value={nodeData.label ?? ""}
                  mode="plain"
                  maxLength={50}
                  placeholder="Enter label..."
                  onSave={handleSaveLabel}
                  onCancel={() => setIsEditingLabel(false)}
                  autoFocus
                />
              )
              : (
                <div
                  className={`${containerNodeLabel} ${editableField}`}
                  onDoubleClick={() => setIsEditingLabel(true)}
                  title="Double-click to edit"
                >
                  {nodeData.label ?? "Container"}
                </div>
              )}
            {(nodeData.technology || isEditingTechnology) && (
              isEditingTechnology
                ? (
                  <InlineEditor
                    value={nodeData.technology ?? ""}
                    mode="plain"
                    maxLength={100}
                    placeholder="Enter technology..."
                    onSave={handleSaveTechnology}
                    onCancel={() => setIsEditingTechnology(false)}
                    autoFocus
                  />
                )
                : (
                  <div
                    className={`${containerNodeTechnology} ${editableField}`}
                    onDoubleClick={() => setIsEditingTechnology(true)}
                    title="Double-click to edit"
                  >
                    [{nodeData.technology}]
                  </div>
                )
            )}
          </div>
        </div>

        {/* Description */}
        {isEditingDescription
          ? (
            <InlineEditor
              value={nodeData.description ?? ""}
              mode="rich"
              maxLength={200}
              placeholder="Enter description..."
              onSave={handleSaveDescription}
              onCancel={() => setIsEditingDescription(false)}
              autoFocus
            />
          )
          : (
            <div
              className={`${containerNodeDescription} ${editableField}`}
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
