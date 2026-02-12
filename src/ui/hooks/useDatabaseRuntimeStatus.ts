import { useEffect, useSyncExternalStore } from "react";
import {
  getDatabaseRuntimeStatusSnapshot,
  refreshDatabaseRuntimeProbe,
  subscribeDatabaseRuntimeStatus,
} from "../../core/effects/db-runtime-status";

const PROBE_REFRESH_INTERVAL_MS = 30_000;

export const useDatabaseRuntimeStatus = () => {
  const snapshot = useSyncExternalStore(
    subscribeDatabaseRuntimeStatus,
    getDatabaseRuntimeStatusSnapshot,
    getDatabaseRuntimeStatusSnapshot,
  );

  useEffect(() => {
    void refreshDatabaseRuntimeProbe();

    const intervalId = window.setInterval(() => {
      void refreshDatabaseRuntimeProbe();
    }, PROBE_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return snapshot;
};
