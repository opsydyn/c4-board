import { CloudIcon, GearSixIcon, RobotIcon, UsersFourIcon } from "@phosphor-icons/react";
import { animated, useTransition } from "@react-spring/web";
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { type Position, Rnd, type RndDragCallback, type RndResizeCallback } from "react-rnd";
import type {
  OpyWidgetLayout,
  OpyWidgetModeLayouts,
  OpyWidgetMode,
  OpyWidgetPresence,
  OpyWidgetSnapTarget,
} from "../../core/effects/settings.types";
import { OpyAvatar } from "./OpyAvatar";
import * as styles from "./OpyFloatingWidget.css";

const DEFAULT_BOUNDS = {
  width: 0,
  height: 0,
};

const EDGE_MARGIN = 24;
const MIN_WIDTH = 360;
const MIN_HEIGHT = 420;
const ORB_SIZE = 56;
const ORB_OFFSET = 18;
const SNAP_DISTANCE = 168;
const DRAG_GRID: [number, number] = [16, 16];

const WIDGET_PRESETS = {
  compact: {
    mode: "field",
    snapTarget: "center",
    width: 460,
    height: 580,
  },
  field: {
    mode: "field",
    snapTarget: "center",
    width: 560,
    height: 720,
  },
  mission: {
    mode: "mission",
    snapTarget: "center",
    width: 860,
    height: 900,
  },
} satisfies Record<string, {
  readonly mode: OpyWidgetMode;
  readonly snapTarget: OpyWidgetSnapTarget;
  readonly width: number;
  readonly height: number;
}>;

type WidgetPresetName = keyof typeof WIDGET_PRESETS;
type WidgetRenderState = "launcher" | "orb" | "surface";

interface OpyFloatingWidgetProps {
  readonly visible: boolean;
  readonly domain: "c4" | "ddd";
  readonly diagramName: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly presence: OpyWidgetPresence;
  readonly layout: OpyWidgetLayout;
  readonly modeLayouts: OpyWidgetModeLayouts;
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly onOpen: () => void;
  readonly onStateCommit: (state: {
    layout: OpyWidgetLayout;
    modeLayouts: OpyWidgetModeLayouts;
    presence: OpyWidgetPresence;
  }) => void;
  readonly onOpenSettings: () => void;
  readonly onOpenSavedDiagrams: () => void;
  readonly onOpenPostee: () => void;
  readonly children: ReactNode;
}

interface OrbMenuAction {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly disabled?: boolean;
}

interface OrbMenuProps {
  readonly ariaLabel: string;
  readonly icon: ReactNode;
  readonly positionClassName: string;
  readonly items: readonly OrbMenuAction[];
  readonly onAction: (id: string) => void;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly panelClassName: string;
}

const clamp = (value: number, min: number, max: number): number => {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(value, min), max);
};

const toNormalizedDiagramName = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "UNTITLED BOARD";
};

const getMaxWidth = (boundsWidth: number): number => Math.max(MIN_WIDTH, boundsWidth - EDGE_MARGIN * 2);

const getMaxHeight = (boundsHeight: number): number => Math.max(MIN_HEIGHT, boundsHeight - EDGE_MARGIN * 2);

const getWidgetSizeWithinBounds = (
  layout: OpyWidgetLayout,
  bounds: typeof DEFAULT_BOUNDS,
): Pick<OpyWidgetLayout, "width" | "height"> => ({
  width: clamp(layout.width, MIN_WIDTH, getMaxWidth(bounds.width)),
  height: clamp(layout.height, MIN_HEIGHT, getMaxHeight(bounds.height)),
});

const getEffectiveSnapTarget = (layout: OpyWidgetLayout): OpyWidgetSnapTarget =>
  layout.snapTarget !== "free"
    ? layout.snapTarget
    : layout.placement === "centered"
      ? "center"
      : "free";

const getAnchoredPosition = (
  snapTarget: Exclude<OpyWidgetSnapTarget, "free">,
  size: Pick<OpyWidgetLayout, "width" | "height">,
  bounds: typeof DEFAULT_BOUNDS,
): Pick<OpyWidgetLayout, "x" | "y"> => {
  const centerX = clamp((bounds.width - size.width) / 2, EDGE_MARGIN, bounds.width - size.width - EDGE_MARGIN);
  const centerY = clamp((bounds.height - size.height) / 2, EDGE_MARGIN, bounds.height - size.height - EDGE_MARGIN);

  switch (snapTarget) {
    case "left-rail":
      return {
        x: EDGE_MARGIN,
        y: Math.round(centerY),
      };
    case "right-rail":
      return {
        x: Math.round(bounds.width - size.width - EDGE_MARGIN),
        y: Math.round(centerY),
      };
    case "bottom-dock":
      return {
        x: Math.round(centerX),
        y: Math.round(bounds.height - size.height - EDGE_MARGIN),
      };
    case "center":
    default:
      return {
        x: Math.round(centerX),
        y: Math.round(centerY),
      };
  }
};

const getNearestSnapTarget = (
  position: Pick<OpyWidgetLayout, "x" | "y">,
  size: Pick<OpyWidgetLayout, "width" | "height">,
  bounds: typeof DEFAULT_BOUNDS,
): OpyWidgetSnapTarget => {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return "free";
  }

  const candidates: ReadonlyArray<Exclude<OpyWidgetSnapTarget, "free">> = [
    "center",
    "left-rail",
    "right-rail",
    "bottom-dock",
  ];

  const closest = candidates.reduce<{
    readonly target: OpyWidgetSnapTarget;
    readonly distance: number;
  }>(
    (best, target) => {
      const anchor = getAnchoredPosition(target, size, bounds);
      const distance = Math.hypot(position.x - anchor.x, position.y - anchor.y);
      return distance < best.distance ? { target, distance } : best;
    },
    {
      target: "free",
      distance: Number.POSITIVE_INFINITY,
    },
  );

  return closest.distance <= SNAP_DISTANCE ? closest.target : "free";
};

const resolveLayout = (
  layout: OpyWidgetLayout,
  bounds: typeof DEFAULT_BOUNDS,
): OpyWidgetLayout => {
  const size = getWidgetSizeWithinBounds(layout, bounds);
  const snapTarget = getEffectiveSnapTarget(layout);

  if (bounds.width <= 0 || bounds.height <= 0) {
    return {
      ...layout,
      ...size,
      snapTarget,
    };
  }

  if (snapTarget !== "free") {
    return {
      ...layout,
      ...size,
      placement: snapTarget === "center" ? "centered" : "custom",
      snapTarget,
      ...getAnchoredPosition(snapTarget, size, bounds),
    };
  }

  return {
    ...layout,
    ...size,
    placement: "custom",
    snapTarget: "free",
    x: Math.round(clamp(layout.x, EDGE_MARGIN, bounds.width - size.width - EDGE_MARGIN)),
    y: Math.round(clamp(layout.y, EDGE_MARGIN, bounds.height - size.height - EDGE_MARGIN)),
  };
};

const areLayoutsEqual = (left: OpyWidgetLayout, right: OpyWidgetLayout): boolean =>
  left.placement === right.placement
  && left.mode === right.mode
  && left.snapTarget === right.snapTarget
  && left.x === right.x
  && left.y === right.y
  && left.width === right.width
  && left.height === right.height;

const normalizeModeLayouts = (
  modeLayouts: OpyWidgetModeLayouts,
  bounds: typeof DEFAULT_BOUNDS,
): OpyWidgetModeLayouts => ({
  field: resolveLayout(
    {
      ...modeLayouts.field,
      mode: "field",
    },
    bounds,
  ),
  mission: resolveLayout(
    {
      ...modeLayouts.mission,
      mode: "mission",
    },
    bounds,
  ),
});

const areModeLayoutsEqual = (
  left: OpyWidgetModeLayouts,
  right: OpyWidgetModeLayouts,
): boolean => areLayoutsEqual(left.field, right.field) && areLayoutsEqual(left.mission, right.mission);

const getLayoutForMode = (
  modeLayouts: OpyWidgetModeLayouts,
  mode: OpyWidgetMode,
): OpyWidgetLayout => mode === "mission"
  ? {
      ...modeLayouts.mission,
      mode: "mission",
    }
  : {
      ...modeLayouts.field,
      mode: "field",
    };

const syncModeLayoutsWithLayout = (
  modeLayouts: OpyWidgetModeLayouts,
  layout: OpyWidgetLayout,
): OpyWidgetModeLayouts => layout.mode === "mission"
  ? {
      ...modeLayouts,
      mission: {
        ...layout,
        mode: "mission",
      },
    }
  : {
      ...modeLayouts,
      field: {
        ...layout,
        mode: "field",
      },
    };

const getOrbPosition = (
  layout: OpyWidgetLayout,
  bounds: typeof DEFAULT_BOUNDS,
): { readonly x: number; readonly y: number } => {
  if (bounds.width <= 0 || bounds.height <= 0) {
    return {
      x: EDGE_MARGIN,
      y: EDGE_MARGIN,
    };
  }

  return {
    x: Math.round(clamp(
      layout.x + layout.width - ORB_SIZE - ORB_OFFSET,
      EDGE_MARGIN,
      bounds.width - ORB_SIZE - EDGE_MARGIN,
    )),
    y: Math.round(clamp(
      layout.y + ORB_OFFSET,
      EDGE_MARGIN,
      bounds.height - ORB_SIZE - EDGE_MARGIN,
    )),
  };
};

const getModeLabel = (mode: OpyWidgetMode): string => mode === "mission" ? "MISSION" : "FIELD";

const getSnapLabel = (snapTarget: OpyWidgetSnapTarget): string => {
  switch (snapTarget) {
    case "center":
      return "CENTER";
    case "left-rail":
      return "LEFT";
    case "right-rail":
      return "RIGHT";
    case "bottom-dock":
      return "BOTTOM";
    case "free":
    default:
      return "FREE";
  }
};

function OrbMenu({
  ariaLabel,
  icon,
  positionClassName,
  items,
  onAction,
  isOpen,
  onToggle,
  panelClassName,
}: OrbMenuProps) {
  return (
    <div className={`${styles.widgetOrbMount} ${positionClassName}`} data-opy-stop-drag="true">
      <button
        type="button"
        className={styles.widgetOrb}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        data-open={isOpen ? "true" : undefined}
        data-opy-stop-drag="true"
        onClick={onToggle}
      >
        {icon}
      </button>
      {isOpen
        ? (
          <div
            className={`${styles.widgetOrbPanel} ${panelClassName}`}
            role="menu"
            aria-label={ariaLabel}
            data-opy-stop-drag="true"
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={styles.widgetOrbMenuItem}
                disabled={item.disabled ?? false}
                data-opy-stop-drag="true"
                onClick={() => {
                  if (item.disabled) {
                    return;
                  }
                  onAction(item.id);
                }}
              >
                <span className={styles.widgetOrbMenuLabel}>{item.label}</span>
                <span className={styles.widgetOrbMenuHint}>{item.hint}</span>
              </button>
            ))}
          </div>
        )
        : null}
    </div>
  );
}

export function OpyFloatingWidget({
  visible,
  domain,
  diagramName,
  nodeCount,
  edgeCount,
  presence,
  layout,
  modeLayouts,
  containerRef,
  onOpen,
  onStateCommit,
  onOpenSettings,
  onOpenSavedDiagrams,
  onOpenPostee,
  children,
}: OpyFloatingWidgetProps) {
  const [bounds, setBounds] = useState(DEFAULT_BOUNDS);
  const [liveLayout, setLiveLayout] = useState(layout);
  const [liveModeLayouts, setLiveModeLayouts] = useState(modeLayouts);
  const [livePresence, setLivePresence] = useState<OpyWidgetPresence>(presence);
  const [openOrb, setOpenOrb] = useState<string | null>(null);
  const widgetRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLiveLayout(layout);
  }, [layout]);

  useEffect(() => {
    setLiveModeLayouts(modeLayouts);
  }, [modeLayouts]);

  useEffect(() => {
    setLivePresence(presence);
  }, [presence]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const measure = () => {
      setBounds({
        width: container.clientWidth,
        height: container.clientHeight,
      });
    };

    measure();

    const resizeObserver = new ResizeObserver(() => {
      measure();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  const normalizedDiagramName = useMemo(
    () => toNormalizedDiagramName(diagramName),
    [diagramName],
  );

  const resolvedModeLayouts = useMemo(
    () => normalizeModeLayouts(liveModeLayouts, bounds),
    [bounds, liveModeLayouts],
  );
  const resolvedLayout = useMemo(
    () => resolveLayout(liveLayout, bounds),
    [bounds, liveLayout],
  );
  const currentMode = resolvedLayout.mode;
  const currentSnapTarget = getEffectiveSnapTarget(resolvedLayout);
  const currentPresence = livePresence === "orb" ? "orb" : currentMode;
  const renderState: WidgetRenderState = !visible
    ? "launcher"
    : currentPresence === "orb"
      ? "orb"
      : "surface";
  const orbPosition = useMemo(
    () => getOrbPosition(resolvedLayout, bounds),
    [bounds, resolvedLayout],
  );

  useEffect(() => {
    if (!visible || currentPresence === "orb") {
      setOpenOrb(null);
    }
  }, [currentPresence, visible]);

  useEffect(() => {
    if (!openOrb || currentPresence === "orb") {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const root = widgetRootRef.current;
      if (!root) {
        return;
      }

      if (event.target instanceof Node && root.contains(event.target)) {
        return;
      }

      setOpenOrb(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpenOrb(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [currentPresence, openOrb]);

  useEffect(() => {
    if (!visible || currentPresence === "orb") {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      setLivePresence("orb");
      if (presence !== "orb") {
        onStateCommit({
          layout: resolvedLayout,
          modeLayouts: resolvedModeLayouts,
          presence: "orb",
        });
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
    window.removeEventListener("keydown", handleEscape);
    };
  }, [currentPresence, onStateCommit, presence, resolvedLayout, resolvedModeLayouts, visible]);

  useEffect(() => {
    if (bounds.width <= 0 || bounds.height <= 0) {
      return;
    }

    const normalizedLayout = resolveLayout(liveLayout, bounds);
    if (!areLayoutsEqual(normalizedLayout, liveLayout)) {
      setLiveLayout(normalizedLayout);
    }

    const normalizedModeLayouts = normalizeModeLayouts(liveModeLayouts, bounds);
    if (!areModeLayoutsEqual(normalizedModeLayouts, liveModeLayouts)) {
      setLiveModeLayouts(normalizedModeLayouts);
    }
  }, [bounds, liveLayout, liveModeLayouts]);

  const focusActions = useMemo<ReadonlyArray<OrbMenuAction>>(
    () => [
      {
        id: "focus:compact",
        label: "Compact Focus",
        hint: "Compress OPY into a tighter command field.",
      },
      {
        id: "focus:field",
        label: "Command Field",
        hint: "Restore the primary floating analysis surface.",
      },
      {
        id: "focus:mission",
        label: "Mission Surface",
        hint: "Escalate OPY into a larger central review surface.",
      },
      {
        id: "focus:center",
        label: "Recenter Widget",
        hint: "Return OPY to the middle of the current board.",
      },
    ],
    [],
  );

  const contextActions = useMemo<ReadonlyArray<OrbMenuAction>>(
    () => [
      {
        id: "snap:center",
        label: "Center Lock",
        hint: "Hold OPY in the middle of the current board.",
      },
      {
        id: "snap:left",
        label: "Left Rail",
        hint: "Pin OPY to the left inspection rail.",
      },
      {
        id: "snap:right",
        label: "Right Rail",
        hint: "Hold OPY on the right analysis rail.",
      },
      {
        id: "snap:bottom",
        label: "Bottom Dock",
        hint: "Anchor OPY to the lower command deck.",
      },
      {
        id: "snap:free",
        label: "Free Drift",
        hint: "Release all anchors and float the widget freely.",
      },
      {
        id: "context:board",
        label: `${domain.toUpperCase()} · ${normalizedDiagramName}`,
        hint: `Board footprint ${nodeCount} nodes / ${edgeCount} edges.`,
        disabled: true,
      },
    ],
    [domain, edgeCount, nodeCount, normalizedDiagramName],
  );

  const routeActions = useMemo<ReadonlyArray<OrbMenuAction>>(
    () => [
      {
        id: "route:saved",
        label: "Saved Diagrams",
        hint: "Jump to the board archive without losing current context.",
      },
      {
        id: "route:postee",
        label: "Use Postee",
        hint: "Route out to the HTTP and response workbench.",
      },
    ],
    [],
  );

  const systemActions = useMemo<ReadonlyArray<OrbMenuAction>>(
    () => [
      {
        id: "system:settings",
        label: "AI Settings",
        hint: "Tune providers, keys, and action modes.",
      },
      {
        id: "system:reset",
        label: "Reset Field",
        hint: "Restore the default size and centered lock for the active mode.",
      },
      {
        id: "system:close",
        label: "Minimize to Orb",
        hint: "Collapse the active surface into a floating recovery orb.",
      },
    ],
    [],
  );

  const buildPresetLayout = (
    presetName: WidgetPresetName,
    baseLayout: OpyWidgetLayout,
  ): OpyWidgetLayout => {
    const preset = WIDGET_PRESETS[presetName];
    return {
      ...baseLayout,
      placement: preset.snapTarget === "center" ? "centered" : "custom",
      mode: preset.mode,
      snapTarget: preset.snapTarget,
      x: 0,
      y: 0,
      width: preset.width,
      height: preset.height,
    };
  };

  const commitWidgetState = (
    nextLayout: OpyWidgetLayout,
    options?: {
      presence?: OpyWidgetPresence;
      persistModeMemory?: boolean;
      modeLayouts?: OpyWidgetModeLayouts;
    },
  ) => {
    const normalizedLayout = resolveLayout(nextLayout, bounds);
    const baseModeLayouts = normalizeModeLayouts(options?.modeLayouts ?? liveModeLayouts, bounds);
    const nextModeLayouts = options?.persistModeMemory === false
      ? baseModeLayouts
      : syncModeLayoutsWithLayout(baseModeLayouts, normalizedLayout);
    const nextPresence = options?.presence ?? normalizedLayout.mode;

    setLiveLayout(normalizedLayout);
    setLiveModeLayouts(nextModeLayouts);
    setLivePresence(nextPresence);

    if (
      !areLayoutsEqual(layout, normalizedLayout)
      || !areModeLayoutsEqual(modeLayouts, nextModeLayouts)
      || presence !== nextPresence
    ) {
      onStateCommit({
        layout: normalizedLayout,
        modeLayouts: nextModeLayouts,
        presence: nextPresence,
      });
    }
  };

  const handleApplyPreset = (
    presetName: WidgetPresetName,
    options?: {
      presence?: OpyWidgetPresence;
      persistModeMemory?: boolean;
      modeLayouts?: OpyWidgetModeLayouts;
    },
  ) => {
    commitWidgetState(
      buildPresetLayout(presetName, resolvedLayout),
      options,
    );
  };

  const restoreSurfacePresence = () => {
    const nextPresence = resolvedLayout.mode;
    setLivePresence(nextPresence);

    if (presence !== nextPresence) {
      onStateCommit({
        layout: resolvedLayout,
        modeLayouts: resolvedModeLayouts,
        presence: nextPresence,
      });
    }
  };

  const handleLauncherOpen = () => {
    restoreSurfacePresence();
    onOpen();
  };

  const handleRestoreFromOrb = () => {
    restoreSurfacePresence();
    setOpenOrb(null);
  };

  const handleFocusAction = (id: string) => {
    switch (id) {
      case "focus:compact":
        handleApplyPreset("compact", {
          persistModeMemory: false,
        });
        setOpenOrb(null);
        return;
      case "focus:field":
        commitWidgetState(getLayoutForMode(resolvedModeLayouts, "field"));
        setOpenOrb(null);
        return;
      case "focus:mission":
        commitWidgetState(getLayoutForMode(resolvedModeLayouts, "mission"));
        setOpenOrb(null);
        return;
      case "focus:center":
        commitWidgetState({
          ...resolvedLayout,
          placement: "centered",
          snapTarget: "center",
          x: 0,
          y: 0,
        });
        setOpenOrb(null);
        return;
      default:
        return;
    }
  };

  const handleContextAction = (id: string) => {
    switch (id) {
      case "snap:center":
        commitWidgetState({
          ...resolvedLayout,
          placement: "centered",
          snapTarget: "center",
          x: 0,
          y: 0,
        });
        setOpenOrb(null);
        return;
      case "snap:left":
        commitWidgetState({
          ...resolvedLayout,
          placement: "custom",
          snapTarget: "left-rail",
          x: 0,
          y: 0,
        });
        setOpenOrb(null);
        return;
      case "snap:right":
        commitWidgetState({
          ...resolvedLayout,
          placement: "custom",
          snapTarget: "right-rail",
          x: 0,
          y: 0,
        });
        setOpenOrb(null);
        return;
      case "snap:bottom":
        commitWidgetState({
          ...resolvedLayout,
          placement: "custom",
          snapTarget: "bottom-dock",
          x: 0,
          y: 0,
        });
        setOpenOrb(null);
        return;
      case "snap:free":
        commitWidgetState({
          ...resolvedLayout,
          placement: "custom",
          snapTarget: "free",
        });
        setOpenOrb(null);
        return;
      default:
        return;
    }
  };

  const handleRouteAction = (id: string) => {
    switch (id) {
      case "route:saved":
        setOpenOrb(null);
        onOpenSavedDiagrams();
        return;
      case "route:postee":
        setOpenOrb(null);
        onOpenPostee();
        return;
      default:
        return;
    }
  };

  const handleSystemAction = (id: string) => {
    switch (id) {
      case "system:settings":
        setOpenOrb(null);
        onOpenSettings();
        return;
      case "system:reset":
        {
          const presetName = currentMode === "mission" ? "mission" : "field";
          const resetLayout = buildPresetLayout(presetName, resolvedLayout);
          const nextModeLayouts = syncModeLayoutsWithLayout(
            resolvedModeLayouts,
            resolveLayout(resetLayout, bounds),
          );
          commitWidgetState(resetLayout, {
            modeLayouts: nextModeLayouts,
          });
        }
        setOpenOrb(null);
        return;
      case "system:close":
        commitWidgetState(resolvedLayout, {
          presence: "orb",
        });
        setOpenOrb(null);
        return;
      default:
        return;
    }
  };

  const handleDrag: RndDragCallback = (_event, data) => {
    setLiveLayout((current) => ({
      ...current,
      placement: "custom",
      snapTarget: "free",
      x: data.x,
      y: data.y,
    }));
  };

  const handleDragStop: RndDragCallback = (_event, data) => {
    const nextSnapTarget = getNearestSnapTarget(
      { x: data.x, y: data.y },
      {
        width: resolvedLayout.width,
        height: resolvedLayout.height,
      },
      bounds,
    );

    if (nextSnapTarget === "free") {
      commitWidgetState({
        ...resolvedLayout,
        placement: "custom",
        snapTarget: "free",
        x: Math.round(data.x),
        y: Math.round(data.y),
      });
      return;
    }

    commitWidgetState({
      ...resolvedLayout,
      placement: nextSnapTarget === "center" ? "centered" : "custom",
      snapTarget: nextSnapTarget,
      x: 0,
      y: 0,
    });
  };

  const handleResize: RndResizeCallback = (_event, _direction, elementRef, _delta, position) => {
    setLiveLayout((current) => ({
      ...current,
      width: elementRef.offsetWidth,
      height: elementRef.offsetHeight,
      x: getEffectiveSnapTarget(current) === "free" ? position.x : current.x,
      y: getEffectiveSnapTarget(current) === "free" ? position.y : current.y,
    }));
  };

  const handleResizeStop: RndResizeCallback = (_event, _direction, elementRef, _delta, position) => {
    commitWidgetState({
      ...resolvedLayout,
      placement: currentSnapTarget === "center" ? "centered" : "custom",
      snapTarget: currentSnapTarget,
      width: elementRef.offsetWidth,
      height: elementRef.offsetHeight,
      x: currentSnapTarget === "free" ? Math.round(position.x) : resolvedLayout.x,
      y: currentSnapTarget === "free" ? Math.round(position.y) : resolvedLayout.y,
    });
  };

  const resizeHandleStyles = useMemo(
    () => ({
      bottomRight: {
        width: "1rem",
        height: "1rem",
        right: "0.375rem",
        bottom: "0.375rem",
        borderRight: "2px solid rgba(140, 224, 188, 0.75)",
        borderBottom: "2px solid rgba(140, 224, 188, 0.75)",
      },
      bottomLeft: {
        width: "1rem",
        height: "1rem",
        left: "0.375rem",
        bottom: "0.375rem",
        borderLeft: "2px solid rgba(140, 224, 188, 0.75)",
        borderBottom: "2px solid rgba(140, 224, 188, 0.75)",
      },
      topRight: {
        width: "1rem",
        height: "1rem",
        right: "0.375rem",
        top: "0.375rem",
        borderRight: "2px solid rgba(140, 224, 188, 0.75)",
        borderTop: "2px solid rgba(140, 224, 188, 0.75)",
      },
      topLeft: {
        width: "1rem",
        height: "1rem",
        left: "0.375rem",
        top: "0.375rem",
        borderLeft: "2px solid rgba(140, 224, 188, 0.75)",
        borderTop: "2px solid rgba(140, 224, 188, 0.75)",
      },
    }),
    [],
  );

  const presenceTransitions = useTransition(renderState, {
    from: {
      opacity: 0,
      scale: 0.92,
    },
    enter: {
      opacity: 1,
      scale: 1,
    },
    leave: {
      opacity: 0,
      scale: 0.96,
    },
    config: {
      tension: 280,
      friction: 24,
    },
  });

  return (
    <>
      {presenceTransitions((transitionStyle, item) => {
        if (item === "launcher") {
          return (
            <animated.div
              className={styles.widgetLauncherTransition}
              style={{
                opacity: transitionStyle.opacity,
                transform: transitionStyle.scale.to((scale) => `scale(${scale})`),
              }}
            >
              <button
                type="button"
                className={styles.widgetLauncher}
                onClick={handleLauncherOpen}
                aria-label="Open OPY presence field"
              >
                <RobotIcon size={18} weight="duotone" />
              </button>
            </animated.div>
          );
        }

        if (item === "orb") {
          return (
            <animated.div
              className={styles.widgetOrbLauncherMount}
              style={{
                left: orbPosition.x,
                top: orbPosition.y,
                opacity: transitionStyle.opacity,
                transform: transitionStyle.scale.to((scale) => `scale(${scale})`),
              }}
            >
              <button
                type="button"
                className={styles.widgetOrbLauncher}
                onClick={handleRestoreFromOrb}
                aria-label={`Restore OPY ${currentMode === "mission" ? "mission surface" : "presence field"}`}
              >
                <RobotIcon size={18} weight="duotone" />
              </button>
            </animated.div>
          );
        }

        return (
          <animated.div
            className={styles.widgetRoot}
            ref={widgetRootRef}
            style={{
              opacity: transitionStyle.opacity,
              transform: transitionStyle.scale.to((scale) => `scale(${scale})`),
            }}
          >
            <Rnd
              bounds="parent"
              className={styles.widgetChrome}
              position={{ x: resolvedLayout.x, y: resolvedLayout.y } as Position}
              size={{
                width: resolvedLayout.width,
                height: resolvedLayout.height,
              }}
              minWidth={MIN_WIDTH}
              minHeight={MIN_HEIGHT}
              maxWidth={getMaxWidth(bounds.width)}
              maxHeight={getMaxHeight(bounds.height)}
              dragHandleClassName={styles.widgetHandle}
              dragGrid={DRAG_GRID}
              cancel={"button, input, textarea, select, [role=\"button\"], [role=\"menu\"], [data-opy-stop-drag=\"true\"], [data-opy-stop-drag=\"true\"] *"}
              onDrag={handleDrag}
              onDragStop={handleDragStop}
              onResize={handleResize}
              onResizeStop={handleResizeStop}
              resizeHandleStyles={resizeHandleStyles}
              enableUserSelectHack={false}
              style={{ overflow: "visible" }}
            >
              <OrbMenu
                ariaLabel="Open OPY focus menu"
                icon={<UsersFourIcon size={16} weight="duotone" />}
                positionClassName={styles.widgetOrbNorth}
                items={focusActions}
                onAction={handleFocusAction}
                isOpen={openOrb === "focus"}
                onToggle={() => {
                  setOpenOrb((current) => current === "focus" ? null : "focus");
                }}
                panelClassName={styles.widgetOrbPanelNorth}
              />
              <OrbMenu
                ariaLabel="Open OPY context menu"
                icon={<CloudIcon size={16} weight="duotone" />}
                positionClassName={styles.widgetOrbEast}
                items={contextActions}
                onAction={handleContextAction}
                isOpen={openOrb === "context"}
                onToggle={() => {
                  setOpenOrb((current) => current === "context" ? null : "context");
                }}
                panelClassName={styles.widgetOrbPanelEast}
              />
              <OrbMenu
                ariaLabel="Open OPY route menu"
                icon={<RobotIcon size={16} weight="duotone" />}
                positionClassName={styles.widgetOrbSouth}
                items={routeActions}
                onAction={handleRouteAction}
                isOpen={openOrb === "route"}
                onToggle={() => {
                  setOpenOrb((current) => current === "route" ? null : "route");
                }}
                panelClassName={styles.widgetOrbPanelSouth}
              />
              <OrbMenu
                ariaLabel="Open OPY system menu"
                icon={<GearSixIcon size={16} weight="duotone" />}
                positionClassName={styles.widgetOrbWest}
                items={systemActions}
                onAction={handleSystemAction}
                isOpen={openOrb === "system"}
                onToggle={() => {
                  setOpenOrb((current) => current === "system" ? null : "system");
                }}
                panelClassName={styles.widgetOrbPanelWest}
              />
              <section
                className={`${styles.widgetFrame} ${currentMode === "mission" ? styles.widgetFrameMission : ""}`}
                role="dialog"
                aria-label="OPY presence field"
              >
                <header
                  className={`${styles.widgetHandle} ${currentMode === "mission" ? styles.widgetHandleMission : ""}`}
                >
                  <div className={styles.widgetTitleBlock}>
                    <p className={`${styles.widgetEyebrow} ${currentMode === "mission" ? styles.widgetEyebrowMission : ""}`}>
                      {currentMode === "mission" ? "Mission Analysis Surface" : "Engineering Presence Standby"}
                    </p>
                    <h3 className={`${styles.widgetTitle} ${currentMode === "mission" ? styles.widgetTitleMission : ""}`}>
                      <OpyAvatar />
                      <span>{currentMode === "mission" ? "OPY MISSION SURFACE" : "OPY PRESENCE FIELD"}</span>
                    </h3>
                    <p className={styles.widgetMeta}>{`${domain.toUpperCase()} BOARD · ${normalizedDiagramName}`}</p>
                  </div>
                  <div className={styles.widgetTelemetry}>
                    <span className={styles.widgetTelemetryPill}>{`MODE::${getModeLabel(currentMode)}`}</span>
                    <span className={styles.widgetTelemetryPill}>{`STATE::${currentPresence === "orb" ? "ORB" : "SURFACE"}`}</span>
                    <span className={styles.widgetTelemetryPill}>{`SNAP::${getSnapLabel(currentSnapTarget)}`}</span>
                    <span className={styles.widgetTelemetryPill}>{`NODES::${nodeCount}`}</span>
                    <span className={styles.widgetTelemetryPill}>{`EDGES::${edgeCount}`}</span>
                    <span className={styles.widgetTelemetryPill}>
                      {`SIZE::${Math.round(resolvedLayout.width)}×${Math.round(resolvedLayout.height)}`}
                    </span>
                  </div>
                </header>
                <div className={`${styles.widgetBody} ${currentMode === "mission" ? styles.widgetBodyMission : ""}`}>
                  {children}
                </div>
              </section>
            </Rnd>
          </animated.div>
        );
      })}
    </>
  );
}
