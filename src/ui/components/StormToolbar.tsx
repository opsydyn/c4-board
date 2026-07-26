/**
 * The Big Picture Event Storming palette.
 *
 * ADR-016 Phase 4. Driven off `EVENT_STORMING_STICKIES` rather than a button per
 * sticky, so the vocabulary lives in one place and adding one needs no JSX and no
 * machine event. The C4 and DDD toolbars each hard-code theirs, which is why
 * nineteen `ADD_*` events exist.
 */

import { LightningIcon, PlusIcon } from "@phosphor-icons/react";
import { EVENT_STORMING_STICKIES } from "../../core/effects/event-storming";
import type { LayoutPresetName } from "../../core/effects/layout";
import type { NodeType } from "../../core/effects/node-operations";
import { LayoutMenu } from "./LayoutMenu";
import { stormStickyButton, stormStickySwatch, toolbarButton } from "./styles.css";

interface StormToolbarProps {
  readonly onAddSticky: (nodeType: NodeType) => void;
  readonly onAutoLayout: (presetName: LayoutPresetName) => void;
  readonly onAutoLayoutSelected: (presetName: LayoutPresetName) => void;
  readonly currentLayout?: LayoutPresetName;
}

export function StormToolbar({
  onAddSticky,
  onAutoLayout,
  onAutoLayoutSelected,
  currentLayout,
}: StormToolbarProps) {
  return (
    <>
      <LayoutMenu
        onSelectLayout={onAutoLayout}
        variant="all"
        {...(currentLayout && { currentLayout })}
      />

      <LayoutMenu
        onSelectLayout={onAutoLayoutSelected}
        variant="selected"
        {...(currentLayout && { currentLayout })}
      />

      {EVENT_STORMING_STICKIES.map((sticky) => (
        <button
          key={sticky.type}
          type="button"
          className={`${toolbarButton} ${stormStickyButton}`}
          onClick={() => onAddSticky(sticky.type)}
          title={sticky.hint}
        >
          {
            /* The colour is the vocabulary, so the palette shows it rather than
              relying on an icon to carry the meaning. */
          }
          <span className={stormStickySwatch} data-sticky={sticky.type} aria-hidden="true">
            {sticky.type === "domainEvent"
              ? <LightningIcon size={14} weight="fill" />
              : <PlusIcon size={12} weight="bold" />}
          </span>
          {`ADD::${sticky.label}`}
        </button>
      ))}
    </>
  );
}
