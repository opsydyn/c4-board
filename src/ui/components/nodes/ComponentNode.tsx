/**
 * ComponentNode - C4 Component Element
 *
 * Represents a component (module, service) within a container.
 * Styled as a smaller blue box with a cube icon.
 *
 * Features:
 * - Inline editing for label, technology, and description
 * - Double-click to edit
 * - Auto-save on blur, cancel on ESC
 */

import type { NodeProps } from "@xyflow/react";
import { useCallback, useState } from "react";
import type { NodeIconId } from "../../../core/effects/node-operations";
import { getNodeIconComponent } from "../../icons/nodeIcons";
import { InlineEditor } from "./InlineEditor";
import { NodeHandles } from "./NodeHandles";
import {
  componentNode,
  componentNodeDescription,
  componentNodeIcon,
  componentNodeLabel,
  componentNodeTechnology,
  editableField,
  nodeContent,
} from "./styles.css";

interface ComponentNodeData {
  label?: string;
  technology?: string;
  description?: string;
  iconId?: NodeIconId;
  // Callback for updating node data
  onUpdate?: (updates: Partial<ComponentNodeData>) => void;
}

function isComponentNodeData(value: unknown): value is ComponentNodeData {
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

export function ComponentNode({ data, selected }: NodeProps) {
  const nodeData: ComponentNodeData = isComponentNodeData(data) ? data : {};
  const Icon = getNodeIconComponent(nodeData.iconId, "component");

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
    <div className={componentNode} data-selected={selected}>
      <NodeHandles />

      {/* Header: Icon + Label inline */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "8px",
        }}
      >
        <div className={componentNodeIcon}>
          <Icon size={20} weight="duotone" />
        </div>
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
              className={`${componentNodeLabel} ${editableField}`}
              onDoubleClick={() => setIsEditingLabel(true)}
              title="Double-click to edit"
            >
              {nodeData.label ?? "Component"}
            </div>
          )}
      </div>

      {/* Content: Technology and Description stacked below */}
      <div className={nodeContent}>
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
                className={`${componentNodeTechnology} ${editableField}`}
                onDoubleClick={() => setIsEditingTechnology(true)}
                title="Double-click to edit"
              >
                [{nodeData.technology}]
              </div>
            )
        )}
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
              className={`${componentNodeDescription} ${editableField}`}
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
