/**
 * The draggable boundary between the request and response panes (ADR-011).
 *
 * Implemented as a `separator` rather than with a drag library: a split handle has
 * to be operable from the keyboard, and the whole interaction is a pointer
 * position mapped to a ratio, which `paneRatioFromDrag` already owns.
 */

import { clampPaneRatio, DEFAULT_PANE_RATIO, paneRatioFromDrag } from "@/core/effects/postee/workspace-panes";
import { useCallback, useEffect, useRef } from "react";
import { paneDivider } from "./PaneDivider.css";

/** How far one arrow press moves the split. */
const KEYBOARD_STEP = 0.02;

export interface PaneDividerProps {
  readonly ratio: number;
  readonly onRatioChange: (ratio: number) => void;
  /** Bounds of the area the two panes share, used to map a pointer to a ratio. */
  readonly splitAreaRef: React.RefObject<HTMLElement | null>;
}

export function PaneDivider({ ratio, onRatioChange, splitAreaRef }: PaneDividerProps) {
  const draggingRef = useRef(false);

  const ratioFromPointer = useCallback((clientX: number) => {
    const bounds = splitAreaRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return paneRatioFromDrag({ pointerX: clientX, splitLeft: bounds.left, splitWidth: bounds.width });
  }, [splitAreaRef]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMove = (event: PointerEvent) => {
      if (!draggingRef.current) return;
      // Without this the drag selects text across both panes.
      event.preventDefault();
      const next = ratioFromPointer(event.clientX);
      if (next !== null) onRatioChange(next);
    };
    const stop = () => {
      draggingRef.current = false;
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      stop();
    };
  }, [onRatioChange, ratioFromPointer]);

  const handlePointerDown = useCallback(() => {
    draggingRef.current = true;
    // Held for the duration of the drag so the cursor does not flicker as the
    // pointer crosses the panes either side of the handle.
    document.body.style.setProperty("cursor", "col-resize");
    document.body.style.setProperty("user-select", "none");
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onRatioChange(clampPaneRatio(ratio - KEYBOARD_STEP));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onRatioChange(clampPaneRatio(ratio + KEYBOARD_STEP));
    } else if (event.key === "Home" || event.key === "Enter") {
      event.preventDefault();
      onRatioChange(DEFAULT_PANE_RATIO);
    }
  }, [onRatioChange, ratio]);

  return (
    <div
      className={paneDivider}
      role="separator"
      tabIndex={0}
      aria-label="Resize request and response panes"
      aria-orientation="vertical"
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={20}
      aria-valuemax={80}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onDoubleClick={() => onRatioChange(DEFAULT_PANE_RATIO)}
    />
  );
}
