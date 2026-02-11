import { isSettingsV1Enabled } from "./feature-flags";
import type { AppSettings } from "./settings.types";

export type SettingsTelemetryEvent =
  | "settings_load_success"
  | "settings_load_failure"
  | "settings_write_success"
  | "settings_write_failure";

export interface SettingsTelemetryPayload {
  readonly operation: "load" | "patch" | "reset";
  readonly durationMs: number;
  readonly error?: string;
  readonly queueDepth?: number;
}

const SETTINGS_TELEMETRY_EVENT = "opsydyn:settings_v1:metric";

const isSettingsTelemetryEnabled = (
  settings: Pick<AppSettings, "telemetryEnabled"> | null | undefined,
): boolean => Boolean(settings?.telemetryEnabled);

export const emitSettingsTelemetry = (
  event: SettingsTelemetryEvent,
  payload: SettingsTelemetryPayload,
  settings: Pick<AppSettings, "telemetryEnabled"> | null | undefined,
): void => {
  if (!isSettingsV1Enabled()) {
    return;
  }

  if (!isSettingsTelemetryEnabled(settings)) {
    return;
  }

  const detail = {
    event,
    ...payload,
    timestamp: Date.now(),
  };

  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(
      new CustomEvent(SETTINGS_TELEMETRY_EVENT, {
        detail,
      }),
    );
  }

  console.debug("[settings_v1]", detail);
};

export const getSettingsTelemetryEventName = (): string => SETTINGS_TELEMETRY_EVENT;
