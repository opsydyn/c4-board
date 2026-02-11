import { useCallback, useEffect, useRef, useState } from "react";
import { getSettingsV1Flag } from "./feature-flags";
import { getSettings } from "./settings.runtime";
import { emitSettingsTelemetry } from "./settings.telemetry";
import { type AppSettings, DEFAULT_APP_SETTINGS } from "./settings.types";
import { useDatabase } from "./useDatabase";

const toErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);

export function useAppSettings() {
  const { runEffect } = useDatabase();
  const settingsV1Flag = getSettingsV1Flag();
  const settingsV1Enabled = settingsV1Flag.enabled;
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isLoading, setIsLoading] = useState(settingsV1Enabled);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reload = useCallback(() => {
    if (!settingsV1Enabled) {
      setSettings(DEFAULT_APP_SETTINGS);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    const startedAt = performance.now();

    void runEffect(getSettings())
      .then((loaded) => {
        if (!mountedRef.current) {
          return;
        }
        const durationMs = Math.round(performance.now() - startedAt);
        setSettings(loaded);
        setIsLoading(false);
        emitSettingsTelemetry(
          "settings_load_success",
          {
            operation: "load",
            durationMs,
          },
          loaded,
        );
      })
      .catch((loadError) => {
        if (!mountedRef.current) {
          return;
        }
        const durationMs = Math.round(performance.now() - startedAt);
        const errorMessage = toErrorMessage(loadError);
        setError(toErrorMessage(loadError));
        setSettings(DEFAULT_APP_SETTINGS);
        setIsLoading(false);
        emitSettingsTelemetry(
          "settings_load_failure",
          {
            operation: "load",
            durationMs,
            error: errorMessage,
          },
          null,
        );
      });
  }, [runEffect, settingsV1Enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    settings,
    isLoading,
    error,
    reload,
    settingsV1Enabled,
    settingsV1Flag,
  };
}
