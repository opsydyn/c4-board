/**
 * PersonNode - C4 Person Element
 *
 * Represents a human user/actor in the system.
 * Styled as a blue box with an icon.
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
  editableField,
  nodeContent,
  personNode,
  personNodeDescription,
  personNodeIcon,
  personNodeLabel,
  personNodeTechnology,
} from "./styles.css";

interface PersonNodeData {
  label?: string;
  technology?: string;
  description?: string;
  iconId?: NodeIconId;
  // Callback for updating node data
  onUpdate?: (updates: Partial<PersonNodeData>) => void;
}

function isPersonNodeData(value: unknown): value is PersonNodeData {
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

export function PersonNode({ data, selected }: NodeProps) {
  const nodeData: PersonNodeData = isPersonNodeData(data) ? data : {};
  const Icon = getNodeIconComponent(nodeData.iconId, "person");

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
    <div className={personNode} data-selected={selected}>
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
        <div className={personNodeIcon}>
          <Icon size={24} weight="duotone" />
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
              className={`${personNodeLabel} ${editableField}`}
              onDoubleClick={() => setIsEditingLabel(true)}
              title="Double-click to edit"
            >
              {nodeData.label ?? "Unnamed"}
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
                className={`${personNodeTechnology} ${editableField}`}
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
              className={`${personNodeDescription} ${editableField}`}
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
