import { ArrowsOutSimpleIcon, CaretDownIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import * as styles from "./OpyDrawer.css";

export interface OpyDrawerProps {
  readonly children: ReactNode;
  readonly diagramName: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly chromeTone: "neutral" | "ready" | "caution" | "critical";
  readonly onCollapse: () => void;
  readonly onSwitchToFloating: () => void;
}

const normalizeDiagramName = (diagramName: string) => {
  const trimmedName = diagramName.trim();

  return trimmedName.length > 0 ? trimmedName.toUpperCase() : "UNTITLED BOARD";
};

export const OpyDrawer = ({
  children,
  diagramName,
  nodeCount,
  edgeCount,
  chromeTone,
  onCollapse,
  onSwitchToFloating,
}: OpyDrawerProps) => (
  <section className={styles.drawerRoot} aria-label="OPY drawer" data-chrome-tone={chromeTone}>
    <header className={styles.drawerHeader}>
      <div className={styles.drawerIdentity}>
        <h2 className={styles.drawerTitle}>{normalizeDiagramName(diagramName)}</h2>
        <p className={styles.drawerMeta}>
          <span>{`NODES::${nodeCount}`}</span>
          <span>{`EDGES::${edgeCount}`}</span>
        </p>
      </div>
      <div className={styles.drawerActions}>
        <button
          type="button"
          className={styles.drawerActionButton}
          aria-label="Collapse OPY drawer"
          onClick={onCollapse}
        >
          <CaretDownIcon size={16} weight="bold" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.drawerActionButton}
          aria-label="Switch OPY to floating mode"
          onClick={onSwitchToFloating}
        >
          <ArrowsOutSimpleIcon size={16} weight="bold" aria-hidden="true" />
        </button>
      </div>
    </header>
    <div className={styles.drawerContent}>{children}</div>
  </section>
);
