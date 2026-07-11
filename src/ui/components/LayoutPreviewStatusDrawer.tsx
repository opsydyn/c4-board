import { ArrowClockwiseIcon, CircleNotchIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react";

import * as styles from "./LayoutPreviewDrawer.css";

export interface LayoutPreviewStatusDrawerProps {
  label: string;
  error: string | null;
  onCancel: () => void;
  onRetry?: () => void;
}

export function LayoutPreviewStatusDrawer({
  label,
  error,
  onCancel,
  onRetry,
}: LayoutPreviewStatusDrawerProps) {
  return (
    <section className={styles.drawer} aria-label="Layout preview">
      <header className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.eyebrow}>LAYOUT PREVIEW</span>
          <h2 className={styles.title}>{label}</h2>
          <div className={styles.meta} role="status" aria-live="polite">
            {error
              ? <span>STATUS::FAILED</span>
              : <span>STATUS::COMPUTING</span>}
          </div>
        </div>
        <div className={styles.actions}>
          {error && onRetry && (
            <button type="button" className={styles.retryButton} onClick={onRetry}>
              <ArrowClockwiseIcon size={16} weight="bold" aria-hidden="true" />
              Retry
            </button>
          )}
          <button type="button" className={styles.cancelButton} onClick={onCancel}>
            <XIcon size={16} weight="bold" aria-hidden="true" />
            Cancel
          </button>
        </div>
      </header>
      <div className={styles.statusContent}>
        {error
          ? <WarningCircleIcon size={24} weight="duotone" aria-hidden="true" />
          : <CircleNotchIcon size={24} className={styles.statusSpinner} aria-hidden="true" />}
        <div>
          <h3>{error ? "Layout unavailable" : "Computing layout"}</h3>
          <p>{error ?? "ELK is arranging compound nodes and routing relationships."}</p>
        </div>
      </div>
    </section>
  );
}
