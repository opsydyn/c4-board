/**
 * The Event Storming stickies that have no equivalent elsewhere.
 *
 * ADR-016 Phase 4. One component parameterised by type rather than one per
 * sticky: the twenty existing node components are each ~130 lines of the same
 * icon-label-description boilerplate, and copying it twice more to add two
 * stickies would be the wrong direction of travel.
 *
 * Colour comes from the sticky's own token, because in this format the colour is
 * the vocabulary — a wall is read by colour before it is read by word.
 */

import type { NodeProps } from "@xyflow/react";
import { useCallback, useState } from "react";
import { eventStormingStickyFor } from "../../../core/effects/event-storming";
import { InlineEditor } from "./InlineEditor";
import { NodeHandles } from "./NodeHandles";
import { editableField, nodeContent, stickyNode, stickyNodeLabel, stickyNodeMarker } from "./styles.css";

interface StickyNodeData {
  readonly label?: string;
  readonly description?: string;
  readonly onUpdate?: (updates: { label?: string; description?: string }) => void;
}

const asStickyData = (value: unknown): StickyNodeData =>
  typeof value === "object" && value !== null ? value as StickyNodeData : {};

export function StickyNode({ data, type, selected }: NodeProps) {
  const nodeData = asStickyData(data);
  const sticky = eventStormingStickyFor(type ?? "");

  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);

  const save = useCallback(
    (updates: { label?: string; description?: string }) => {
      nodeData.onUpdate?.(updates);
    },
    [nodeData],
  );

  return (
    <div className={stickyNode} data-sticky={type} data-selected={selected}>
      <NodeHandles />

      {
        /* A hotspot is a rotated note on a wall; the marker carries that rather
          than rotating the node, which would rotate its handles and hit area. */
      }
      <span className={stickyNodeMarker} data-sticky={type} aria-hidden="true" />

      {isEditingLabel
        ? (
          <InlineEditor
            value={nodeData.label ?? ""}
            mode="plain"
            maxLength={80}
            placeholder={sticky?.hint ?? "Enter a label..."}
            onSave={(label) => {
              save({ label });
              setIsEditingLabel(false);
            }}
            onCancel={() => setIsEditingLabel(false)}
            autoFocus
          />
        )
        : (
          <div
            className={`${stickyNodeLabel} ${editableField}`}
            onDoubleClick={() => setIsEditingLabel(true)}
            title={sticky?.hint ?? "Double-click to edit"}
          >
            {nodeData.label ?? sticky?.label ?? "Sticky"}
          </div>
        )}

      <div className={nodeContent}>
        {isEditingDescription
          ? (
            <InlineEditor
              value={nodeData.description ?? ""}
              mode="rich"
              maxLength={500}
              placeholder="Add detail..."
              onSave={(description) => {
                save({ description });
                setIsEditingDescription(false);
              }}
              onCancel={() => setIsEditingDescription(false)}
              autoFocus
            />
          )
          : (
            <div
              className={`${nodeContent} ${editableField}`}
              onDoubleClick={() => setIsEditingDescription(true)}
              title="Double-click to edit"
            >
              {nodeData.description ?? ""}
            </div>
          )}
      </div>
    </div>
  );
}
