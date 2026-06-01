import {
  CloudIcon,
  GearSixIcon,
  RobotIcon,
  UsersFourIcon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState, type ReactNode, type RefObject } from "react";
import { Button, Menu, MenuItem, MenuTrigger, Popover } from "react-aria-components";
import { Rnd, type Position, type RndDragCallback, type RndResizeCallback } from "react-rnd";
import type { OpyWidgetLayout } from "../../core/effects/settings.types";
import { OpyAvatar } from "./OpyAvatar";
import * as styles from "./OpyFloatingWidget.css";

const DEFAULT_BOUNDS = {
  width: 0,
  height: 0,
};

const EDGE_MARGIN = 24;
const MIN_WIDTH = 360;
const MIN_HEIGHT = 420;

const WIDGET_PRESETS = {
  compact: {
    width: 460,
    height: 580,
  },
  standard: {
    width: 560,
    height: 720,
  },
  theater: {
    width: 680,
    height: 820,
  },
} as const;

type WidgetPresetName = keyof typeof WIDGET_PRESETS;

interface OpyFloatingWidgetProps {
  readonly visible: boolean;
  readonly domain: "c4" | "ddd";
  readonly diagramName: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly layout: OpyWidgetLayout;
  readonly containerRef: RefObject<HTMLElement | null>;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onLayoutCommit: (layout: OpyWidgetLayout) => void;
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
  readonly placement: "top" | "bottom" | "left" | "right";
  readonly items: readonly OrbMenuAction[];
  readonly onAction: (id: string) => void;
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

const getMaxWidth = (boundsWidth: number): number =>
  Math.max(MIN_WIDTH, boundsWidth - EDGE_MARGIN * 2);

const getMaxHeight = (boundsHeight: number): number =>
  Math.max(MIN_HEIGHT, boundsHeight - EDGE_MARGIN * 2);

const getWidgetSizeWithinBounds = (
  layout: OpyWidgetLayout,
  bounds: typeof DEFAULT_BOUNDS,
): Pick<OpyWidgetLayout, "width" | "height"> => ({
  width: clamp(layout.width, MIN_WIDTH, getMaxWidth(bounds.width)),
  height: clamp(layout.height, MIN_HEIGHT, getMaxHeight(bounds.height)),
});

const resolveLayout = (
  layout: OpyWidgetLayout,
  bounds: typeof DEFAULT_BOUNDS,
): OpyWidgetLayout => {
  const size = getWidgetSizeWithinBounds(layout, bounds);

  if (bounds.width <= 0 || bounds.height <= 0) {
    return {
      ...layout,
      ...size,
    };
  }

  if (layout.placement === "centered") {
    return {
      ...layout,
      ...size,
      x: Math.round(clamp((bounds.width - size.width) / 2, EDGE_MARGIN, bounds.width - size.width - EDGE_MARGIN)),
      y: Math.round(clamp((bounds.height - size.height) / 2, EDGE_MARGIN, bounds.height - size.height - EDGE_MARGIN)),
    };
  }

  return {
    ...layout,
    ...size,
    x: Math.round(clamp(layout.x, EDGE_MARGIN, bounds.width - size.width - EDGE_MARGIN)),
    y: Math.round(clamp(layout.y, EDGE_MARGIN, bounds.height - size.height - EDGE_MARGIN)),
  };
};

const areLayoutsEqual = (left: OpyWidgetLayout, right: OpyWidgetLayout): boolean =>
  left.placement === right.placement
  && left.x === right.x
  && left.y === right.y
  && left.width === right.width
  && left.height === right.height;

function OrbMenu({
  ariaLabel,
  icon,
  positionClassName,
  placement,
  items,
  onAction,
}: OrbMenuProps) {
  return (
    <MenuTrigger>
      <Button
        className={`${styles.widgetOrb} ${positionClassName}`}
        aria-label={ariaLabel}
        data-opy-stop-drag="true"
      >
        {icon}
      </Button>
      <Popover className={styles.widgetOrbPopover} placement={placement}>
        <Menu
          className={styles.widgetOrbMenu}
          onAction={(key) => {
            onAction(String(key));
          }}
        >
          {items.map((item) => (
            <MenuItem
              key={item.id}
              id={item.id}
              className={styles.widgetOrbMenuItem}
              textValue={item.label}
              isDisabled={item.disabled ?? false}
            >
              <span className={styles.widgetOrbMenuLabel}>{item.label}</span>
              <span className={styles.widgetOrbMenuHint}>{item.hint}</span>
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
}

export function OpyFloatingWidget({
  visible,
  domain,
  diagramName,
  nodeCount,
  edgeCount,
  layout,
  containerRef,
  onOpen,
  onClose,
  onLayoutCommit,
  onOpenSettings,
  onOpenSavedDiagrams,
  onOpenPostee,
  children,
}: OpyFloatingWidgetProps) {
  const [bounds, setBounds] = useState(DEFAULT_BOUNDS);
  const [liveLayout, setLiveLayout] = useState(layout);

  useEffect(() => {
    setLiveLayout(layout);
  }, [layout]);

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

  const resolvedLayout = useMemo(
    () => resolveLayout(liveLayout, bounds),
    [bounds, liveLayout],
  );

  const focusActions = useMemo<ReadonlyArray<OrbMenuAction>>(
    () => [
      {
        id: "focus:compact",
        label: "Compact Focus",
        hint: "Compress OPY into a tighter command field.",
      },
      {
        id: "focus:standard",
        label: "Standard Focus",
        hint: "Restore the default presence field dimensions.",
      },
      {
        id: "focus:theater",
        label: "Situation Room",
        hint: "Expand the console for deeper architecture sessions.",
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
        id: "context:board",
        label: `${domain.toUpperCase()} Board`,
        hint: normalizedDiagramName,
        disabled: true,
      },
      {
        id: "context:nodes",
        label: `Nodes :: ${nodeCount}`,
        hint: "Current board node footprint.",
        disabled: true,
      },
      {
        id: "context:edges",
        label: `Edges :: ${edgeCount}`,
        hint: "Current board connection footprint.",
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
        id: "system:close",
        label: "Collapse OPY",
        hint: "Hide the presence field and fall back to the launcher orb.",
      },
    ],
    [],
  );

  const commitLayout = (nextLayout: OpyWidgetLayout) => {
    setLiveLayout(nextLayout);
    if (!areLayoutsEqual(layout, nextLayout)) {
      onLayoutCommit(nextLayout);
    }
  };

  const handleApplyPreset = (presetName: WidgetPresetName) => {
    const preset = WIDGET_PRESETS[presetName];
    commitLayout({
      placement: "centered",
      x: 0,
      y: 0,
      width: preset.width,
      height: preset.height,
    });
  };

  const handleFocusAction = (id: string) => {
    switch (id) {
      case "focus:compact":
        handleApplyPreset("compact");
        return;
      case "focus:standard":
        handleApplyPreset("standard");
        return;
      case "focus:theater":
        handleApplyPreset("theater");
        return;
      case "focus:center":
        commitLayout({
          ...resolvedLayout,
          placement: "centered",
          x: 0,
          y: 0,
        });
        return;
      default:
        return;
    }
  };

  const handleRouteAction = (id: string) => {
    switch (id) {
      case "route:saved":
        onOpenSavedDiagrams();
        return;
      case "route:postee":
        onOpenPostee();
        return;
      default:
        return;
    }
  };

  const handleSystemAction = (id: string) => {
    switch (id) {
      case "system:settings":
        onOpenSettings();
        return;
      case "system:close":
        onClose();
        return;
      default:
        return;
    }
  };

  const handleDrag: RndDragCallback = (_event, data) => {
    setLiveLayout((current) => ({
      ...current,
      placement: "custom",
      x: data.x,
      y: data.y,
    }));
  };

  const handleDragStop: RndDragCallback = (_event, data) => {
    commitLayout({
      ...resolvedLayout,
      placement: "custom",
      x: Math.round(data.x),
      y: Math.round(data.y),
    });
  };

  const handleResize: RndResizeCallback = (_event, _direction, elementRef, _delta, position) => {
    setLiveLayout((current) => ({
      ...current,
      placement: "custom",
      width: elementRef.offsetWidth,
      height: elementRef.offsetHeight,
      x: position.x,
      y: position.y,
    }));
  };

  const handleResizeStop: RndResizeCallback = (_event, _direction, elementRef, _delta, position) => {
    commitLayout({
      placement: "custom",
      width: elementRef.offsetWidth,
      height: elementRef.offsetHeight,
      x: Math.round(position.x),
      y: Math.round(position.y),
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

  if (!visible) {
    return (
      <button
        type="button"
        className={styles.widgetLauncher}
        onClick={onOpen}
        aria-label="Open OPY presence field"
      >
        <RobotIcon size={18} weight="duotone" />
      </button>
    );
  }

  return (
    <div className={styles.widgetRoot}>
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
        cancel={'button, input, textarea, select, [role="button"], [data-opy-stop-drag="true"]'}
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
          placement="bottom"
          items={focusActions}
          onAction={handleFocusAction}
        />
        <OrbMenu
          ariaLabel="Open OPY context menu"
          icon={<CloudIcon size={16} weight="duotone" />}
          positionClassName={styles.widgetOrbEast}
          placement="left"
          items={contextActions}
          onAction={() => {}}
        />
        <OrbMenu
          ariaLabel="Open OPY route menu"
          icon={<RobotIcon size={16} weight="duotone" />}
          positionClassName={styles.widgetOrbSouth}
          placement="top"
          items={routeActions}
          onAction={handleRouteAction}
        />
        <OrbMenu
          ariaLabel="Open OPY system menu"
          icon={<GearSixIcon size={16} weight="duotone" />}
          positionClassName={styles.widgetOrbWest}
          placement="right"
          items={systemActions}
          onAction={handleSystemAction}
        />
        <section className={styles.widgetFrame} role="dialog" aria-label="OPY presence field">
          <header className={styles.widgetHandle}>
            <div className={styles.widgetTitleBlock}>
              <p className={styles.widgetEyebrow}>Engineering Presence Standby</p>
              <h3 className={styles.widgetTitle}>
                <OpyAvatar />
                <span>OPY PRESENCE FIELD</span>
              </h3>
              <p className={styles.widgetMeta}>{`${domain.toUpperCase()} BOARD · ${normalizedDiagramName}`}</p>
            </div>
            <div className={styles.widgetTelemetry}>
              <span className={styles.widgetTelemetryPill}>{`NODES::${nodeCount}`}</span>
              <span className={styles.widgetTelemetryPill}>{`EDGES::${edgeCount}`}</span>
              <span className={styles.widgetTelemetryPill}>{`SIZE::${Math.round(resolvedLayout.width)}×${Math.round(resolvedLayout.height)}`}</span>
            </div>
          </header>
          <div className={styles.widgetBody}>
            {children}
          </div>
        </section>
      </Rnd>
    </div>
  );
}
