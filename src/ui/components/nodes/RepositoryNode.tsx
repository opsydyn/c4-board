/**
 * RepositoryNode - DDD Tactical Element
 *
 * Represents a repository in Domain-Driven Design.
 * Repositories abstract data access and persistence for aggregates.
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
  repositoryNode,
  repositoryNodeDescription,
  repositoryNodeIcon,
  repositoryNodeLabel,
} from "./styles.css";

interface RepositoryNodeData {
  label?: string;
  description?: string;
  iconId?: NodeIconId;
  onUpdate?: (updates: Partial<RepositoryNodeData>) => void;
}

function isRepositoryNodeData(value: unknown): value is RepositoryNodeData {
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

export function RepositoryNode({ data, selected }: NodeProps) {
  const nodeData: RepositoryNodeData = isRepositoryNodeData(data) ? data : {};
  const Icon = getNodeIconComponent(nodeData.iconId, "repository");

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
    <div className={repositoryNode} data-selected={selected}>
      <NodeHandles />

      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
        <div className={repositoryNodeIcon}>
          <Icon size={24} weight="duotone" />
        </div>
        {isEditingLabel
          ? (
            <InlineEditor
              value={nodeData.label ?? ""}
              mode="plain"
              maxLength={50}
              placeholder="Enter repository name..."
              onSave={handleSaveLabel}
              onCancel={() => setIsEditingLabel(false)}
              autoFocus
            />
          )
          : (
            <div
              className={`${repositoryNodeLabel} ${editableField}`}
              onDoubleClick={() => setIsEditingLabel(true)}
              title="Double-click to edit"
            >
              {nodeData.label ?? "Repository"}
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
              className={`${repositoryNodeDescription} ${editableField}`}
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
