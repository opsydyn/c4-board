import { useMachine } from "@xstate/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import { getSettingsV1Flag } from "../../../core/effects/feature-flags";
import type { AppSettingsPatch, RedactionMode, TransitionIntensity } from "../../../core/effects/settings.types";
import { useDatabase } from "../../../core/effects/useDatabase";
import * as styles from "../../../pages/settings.css";
import { useDatabaseRuntimeStatus } from "../../hooks/useDatabaseRuntimeStatus";
import { createSettingsMachine } from "../../machines/settings.machine";
import { TacticalSelect } from "../TacticalSelect";

type SaveState = "disabled" | "loading" | "saving" | "saved" | "error";
type RuntimeConfigMismatch = {
  key: string;
  expected: string;
  actual: string;
};
type AudioContextStatus = "running" | "suspended" | "closed" | "unavailable" | "unknown";

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const toSaveSynthVolumeDb = (masterVolume: number): number =>
  masterVolume <= 0
    ? -60
    : -24 + Math.max(0, Math.min(1, masterVolume)) * 20;

const isTransitionIntensity = (value: string): value is TransitionIntensity =>
  value === "low" || value === "normal" || value === "high";

const isRedactionMode = (value: string): value is RedactionMode =>
  value === "off" || value === "standard" || value === "strict";

const transitionIntensityOptions = [
  { value: "low", label: "LOW" },
  { value: "normal", label: "NORMAL" },
  { value: "high", label: "HIGH" },
] as const;

const redactionModeOptions = [
  { value: "off", label: "OFF" },
  { value: "standard", label: "STANDARD" },
  { value: "strict", label: "STRICT" },
] as const;

const formatClockTime = (timestamp: number | null): string => {
  if (timestamp === null) {
    return "N/A";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(timestamp);
};

export function SettingsPanel() {
  const { runEffect } = useDatabase();
  const dbRuntimeStatus = useDatabaseRuntimeStatus();
  const settingsMachine = useMemo(
    () =>
      createSettingsMachine({
        runEffect,
        settingsV1Flag: getSettingsV1Flag(),
      }),
    [runEffect],
  );
  const [state, send] = useMachine(settingsMachine);
  const settingsV1Flag = state.context.settingsV1Flag;
  const settingsV1Enabled = settingsV1Flag.enabled;
  const settings = state.context.settings;
  const diagnosticSynthRef = useRef<Tone.PolySynth<Tone.Synth> | null>(null);
  const [audioContextStatus, setAudioContextStatus] = useState<AudioContextStatus>("unknown");
  const [audioDiagnosticMessage, setAudioDiagnosticMessage] = useState<string | null>(null);
  const lastSavedAt = state.context.lastSavedAt;
  const pendingOperations = state.context.pendingOperations;
  const pendingWrites = state.context.pendingWrites;
  const errorMessage = state.context.errorMessage;
  const dataControlNotice = state.context.dataControlNotice;
  const autosaveIntervalDraft = state.context.autosaveIntervalDraft;
  const historyRetentionDraft = state.context.historyRetentionDraft;
  const masterVolumeDraft = state.context.masterVolumeDraft;
  const diagnosticMasterVolume = useMemo(
    () => clamp(masterVolumeDraft, 0, 100) / 100,
    [masterVolumeDraft],
  );
  const mudAlertThresholdDraft = state.context.mudAlertThresholdDraft;
  const isBooting = state.matches("booting");
  const queuedWrites = pendingOperations.length;
  const runtimeQueuedBacklog = Math.max(
    0,
    dbRuntimeStatus.pendingWrites - dbRuntimeStatus.activeWrites,
  );
  const runtimeStatusText = useMemo(() => {
    switch (dbRuntimeStatus.status) {
      case "booting":
        return "BOOTING";
      case "online":
        return "ONLINE";
      case "degraded":
        return "DEGRADED";
      case "offline":
        return "OFFLINE";
    }
  }, [dbRuntimeStatus.status]);
  const runtimeLastSuccessText = useMemo(
    () => formatClockTime(dbRuntimeStatus.lastSuccessAt),
    [dbRuntimeStatus.lastSuccessAt],
  );
  const runtimeLastFailureText = useMemo(
    () => formatClockTime(dbRuntimeStatus.lastFailureAt),
    [dbRuntimeStatus.lastFailureAt],
  );
  const runtimeProbeUpdatedText = useMemo(
    () => formatClockTime(dbRuntimeStatus.probeLastUpdatedAt),
    [dbRuntimeStatus.probeLastUpdatedAt],
  );
  const runtimeJournalModeText = useMemo(
    () => dbRuntimeStatus.journalMode.toUpperCase(),
    [dbRuntimeStatus.journalMode],
  );
  const runtimeForeignKeysText = useMemo(() => {
    if (dbRuntimeStatus.foreignKeysEnabled === null) {
      return "N/A";
    }
    return dbRuntimeStatus.foreignKeysEnabled ? "ON" : "OFF";
  }, [dbRuntimeStatus.foreignKeysEnabled]);
  const runtimeBusyTimeoutText = useMemo(() => {
    if (dbRuntimeStatus.busyTimeoutMs === null) {
      return "N/A";
    }
    return `${dbRuntimeStatus.busyTimeoutMs}MS`;
  }, [dbRuntimeStatus.busyTimeoutMs]);
  const runtimeSynchronousModeText = useMemo(() => {
    if (dbRuntimeStatus.synchronousMode === null) {
      return "N/A";
    }
    return dbRuntimeStatus.synchronousMode.toUpperCase();
  }, [dbRuntimeStatus.synchronousMode]);
  const refreshAudioContextStatus = useCallback(() => {
    try {
      const currentState = Tone.getContext().state;
      setAudioContextStatus(currentState as AudioContextStatus);
    } catch {
      setAudioContextStatus("unavailable");
    }
  }, []);
  const audioRuntimeText = useMemo(() => {
    const contextLabel = audioContextStatus.toUpperCase();
    const chimeLabel = settings.saveChimeEnabled ? "ON" : "OFF";
    return `CTX::${contextLabel} VOL::${Math.round(diagnosticMasterVolume * 100)}% CHIME::${chimeLabel}`;
  }, [audioContextStatus, diagnosticMasterVolume, settings.saveChimeEnabled]);
  const canRunAudioDiagnostic = useMemo(
    () => settings.masterAudioEnabled && diagnosticMasterVolume > 0,
    [diagnosticMasterVolume, settings.masterAudioEnabled],
  );
  const getDiagnosticSaveSynth = useCallback((): Tone.PolySynth<Tone.Synth> => {
    if (!diagnosticSynthRef.current) {
      diagnosticSynthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle8" },
        envelope: {
          attack: 0.006,
          decay: 0.2,
          sustain: 0.12,
          release: 0.3,
        },
      }).toDestination();
    }
    return diagnosticSynthRef.current;
  }, []);
  const handleTestSaveChime = useCallback(async () => {
    if (!settings.masterAudioEnabled) {
      setAudioDiagnosticMessage("AUDIO TEST BLOCKED: MASTER AUDIO IS OFF");
      return;
    }
    if (diagnosticMasterVolume <= 0) {
      setAudioDiagnosticMessage("AUDIO TEST BLOCKED: MASTER VOLUME IS 0%");
      return;
    }

    try {
      const context = Tone.getContext();
      if (context.state !== "running") {
        await Tone.start();
      }

      const synth = getDiagnosticSaveSynth();
      synth.volume.value = toSaveSynthVolumeDb(diagnosticMasterVolume);
      const now = Tone.now();
      synth.triggerAttackRelease("C4", "16n", now);
      synth.triggerAttackRelease("E4", "16n", now + 0.08);
      synth.triggerAttackRelease("G4", "8n", now + 0.16);
      setAudioDiagnosticMessage(
        settings.saveChimeEnabled
          ? "AUDIO TEST OK"
          : "AUDIO TEST OK (SAVE CHIME TOGGLE IS OFF)",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAudioDiagnosticMessage(`AUDIO TEST FAILED: ${message}`);
    } finally {
      refreshAudioContextStatus();
    }
  }, [
    diagnosticMasterVolume,
    getDiagnosticSaveSynth,
    refreshAudioContextStatus,
    settings.masterAudioEnabled,
    settings.saveChimeEnabled,
  ]);
  const runtimeConfigMismatches = useMemo<RuntimeConfigMismatch[]>(() => {
    const mismatches: RuntimeConfigMismatch[] = [];

    if (dbRuntimeStatus.journalMode.trim().toLowerCase() !== "wal") {
      mismatches.push({
        key: "journal_mode",
        expected: "wal",
        actual: dbRuntimeStatus.journalMode,
      });
    }

    if (dbRuntimeStatus.maxConnections !== 1) {
      mismatches.push({
        key: "max_connections",
        expected: "1",
        actual: String(dbRuntimeStatus.maxConnections),
      });
    }

    if (dbRuntimeStatus.foreignKeysEnabled !== null && !dbRuntimeStatus.foreignKeysEnabled) {
      mismatches.push({
        key: "foreign_keys",
        expected: "ON",
        actual: "OFF",
      });
    }

    if (
      dbRuntimeStatus.busyTimeoutMs !== null
      && dbRuntimeStatus.busyTimeoutMs < 5_000
    ) {
      mismatches.push({
        key: "busy_timeout",
        expected: ">=5000ms",
        actual: `${dbRuntimeStatus.busyTimeoutMs}ms`,
      });
    }

    if (
      dbRuntimeStatus.synchronousMode !== null
      && dbRuntimeStatus.synchronousMode.trim().toLowerCase() !== "normal"
    ) {
      mismatches.push({
        key: "synchronous",
        expected: "normal",
        actual: dbRuntimeStatus.synchronousMode,
      });
    }

    return mismatches;
  }, [
    dbRuntimeStatus.busyTimeoutMs,
    dbRuntimeStatus.foreignKeysEnabled,
    dbRuntimeStatus.journalMode,
    dbRuntimeStatus.maxConnections,
    dbRuntimeStatus.synchronousMode,
  ]);
  const hasRuntimeConfigDrift = runtimeConfigMismatches.length > 0;
  const runtimeConfigStatusText = useMemo(
    () => hasRuntimeConfigDrift ? `DRIFT (${runtimeConfigMismatches.length})` : "HEALTHY",
    [hasRuntimeConfigDrift, runtimeConfigMismatches.length],
  );
  const runtimeConfigMismatchDetails = useMemo(
    () =>
      runtimeConfigMismatches
        .map((mismatch) => `${mismatch.key}: expected ${mismatch.expected}, got ${mismatch.actual}`)
        .join(" | "),
    [runtimeConfigMismatches],
  );
  const lastSavedAtText = useMemo(
    () => lastSavedAt === null ? null : formatClockTime(lastSavedAt),
    [lastSavedAt],
  );
  const saveState: SaveState = useMemo(() => {
    if (state.matches("disabled")) {
      return "disabled";
    }
    if (state.matches("booting")) {
      return "loading";
    }
    if (state.matches("saving") || state.matches("recovering")) {
      return "saving";
    }
    if (state.matches("error")) {
      return "error";
    }
    return "saved";
  }, [state]);

  const applyPatch = useCallback(
    (patch: AppSettingsPatch) => {
      if (!settingsV1Enabled) {
        return;
      }
      send({ type: "PATCH", patch });
    },
    [send, settingsV1Enabled],
  );

  const handleResetToDefaults = useCallback(() => {
    if (!settingsV1Enabled) {
      return;
    }
    if (!window.confirm("Reset all global settings to defaults?")) {
      return;
    }
    send({ type: "RESET" });
  }, [send, settingsV1Enabled]);

  const handlePlannedAction = useCallback((label: string, confirmation: string) => {
    if (!window.confirm(confirmation)) {
      return;
    }
    send({
      type: "SET_NOTICE",
      value: `${label} is queued for implementation in Phase 4.`,
    });
  }, [send]);

  const statusText = useMemo(() => {
    switch (saveState) {
      case "disabled":
        return "STATE::DISABLED";
      case "loading":
        return "STATE::LOADING";
      case "saving":
        return queuedWrites > 0
          ? `STATE::SAVING (${queuedWrites} QUEUED)`
          : "STATE::SAVING";
      case "error":
        return "STATE::ERROR";
      case "saved":
        if (hasRuntimeConfigDrift) {
          return `STATE::CONFIG::DRIFT (${runtimeConfigMismatches.length})`;
        }
        if (lastSavedAt === null) {
          return "STATE::SYNCED";
        }
        return `STATE::SYNCED ${formatClockTime(lastSavedAt)}`;
    }
  }, [hasRuntimeConfigDrift, lastSavedAt, queuedWrites, runtimeConfigMismatches.length, saveState]);

  const statusClassName = useMemo(() => {
    switch (saveState) {
      case "disabled":
        return `${styles.settingsStatusBadge} ${styles.settingsStatusLoading}`;
      case "loading":
        return `${styles.settingsStatusBadge} ${styles.settingsStatusLoading}`;
      case "saving":
        return `${styles.settingsStatusBadge} ${styles.settingsStatusSaving}`;
      case "saved":
        if (hasRuntimeConfigDrift) {
          return `${styles.settingsStatusBadge} ${styles.settingsStatusDrift}`;
        }
        return `${styles.settingsStatusBadge} ${styles.settingsStatusSaved}`;
      case "error":
        return `${styles.settingsStatusBadge} ${styles.settingsStatusError}`;
    }
  }, [hasRuntimeConfigDrift, saveState]);

  const commitAutosaveInterval = useCallback(() => {
    const parsed = Number(autosaveIntervalDraft);
    if (!Number.isFinite(parsed)) {
      send({
        type: "SET_AUTOSAVE_DRAFT",
        value: String(settings.autosaveIntervalMs),
      });
      return;
    }
    const normalized = clamp(Math.round(parsed), 250, 60_000);
    send({ type: "SET_AUTOSAVE_DRAFT", value: String(normalized) });
    applyPatch({ autosaveIntervalMs: normalized });
  }, [applyPatch, autosaveIntervalDraft, send, settings.autosaveIntervalMs]);

  const commitHistoryRetentionDays = useCallback(() => {
    const parsed = Number(historyRetentionDraft);
    if (!Number.isFinite(parsed)) {
      send({
        type: "SET_HISTORY_DRAFT",
        value: String(settings.historyRetentionDays),
      });
      return;
    }
    const normalized = clamp(Math.round(parsed), 1, 3_650);
    send({ type: "SET_HISTORY_DRAFT", value: String(normalized) });
    applyPatch({ historyRetentionDays: normalized });
  }, [applyPatch, historyRetentionDraft, send, settings.historyRetentionDays]);

  const commitMasterVolume = useCallback(
    (nextPercent: number) => {
      const normalizedPercent = clamp(Math.round(nextPercent), 0, 100);
      send({ type: "SET_MASTER_VOLUME_DRAFT", value: normalizedPercent });
      applyPatch({ masterVolume: normalizedPercent / 100 });
    },
    [applyPatch, send],
  );

  const commitMudAlertThreshold = useCallback(() => {
    const parsed = Number(mudAlertThresholdDraft);
    if (!Number.isFinite(parsed)) {
      send({
        type: "SET_MUD_THRESHOLD_DRAFT",
        value: settings.bigBallOfMudAlertThreshold.toFixed(1),
      });
      return;
    }

    const normalized = Math.round(clamp(parsed, 5, 9.5) * 10) / 10;
    send({
      type: "SET_MUD_THRESHOLD_DRAFT",
      value: normalized.toFixed(1),
    });
    applyPatch({ bigBallOfMudAlertThreshold: normalized });
  }, [
    applyPatch,
    mudAlertThresholdDraft,
    send,
    settings.bigBallOfMudAlertThreshold,
  ]);

  useEffect(() => {
    refreshAudioContextStatus();
  }, [refreshAudioContextStatus]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handlePointerDown = () => {
      refreshAudioContextStatus();
    };
    const handleVisibilityChange = () => {
      refreshAudioContextStatus();
    };

    window.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshAudioContextStatus]);

  useEffect(() => {
    return () => {
      diagnosticSynthRef.current?.dispose();
      diagnosticSynthRef.current = null;
    };
  }, []);

  return (
    <>
      <header className={styles.mainHeader}>
        <h1 className={styles.mainTitle}>Global Settings</h1>
        <div className={styles.settingsStatusBar}>
          <span className={statusClassName}>{statusText}</span>
          {saveState === "saved" && hasRuntimeConfigDrift && lastSavedAtText !== null && (
            <span className={styles.settingsRowValue}>
              LAST SAVE {lastSavedAtText}
            </span>
          )}
          {pendingWrites > 0 && (
            <span className={styles.settingsRowValue}>
              OUTSTANDING {pendingWrites}
            </span>
          )}
          {queuedWrites > 0 && (
            <span className={styles.settingsRowValue}>
              QUEUED {queuedWrites}
            </span>
          )}
        </div>
        {errorMessage && <p className={styles.settingsErrorText}>{errorMessage}</p>}
        <p className={styles.mainSubtitle}>
          Global controls are now live. Values commit directly to local runtime storage.
        </p>
      </header>

      {isBooting
        ? (
          <div className={styles.settingsLoadingState}>
            INITIALIZING SETTINGS RUNTIME
          </div>
        )
        : !settingsV1Enabled
        ? (
          <div className={styles.settingsGrid}>
            <article className={styles.settingsCard}>
              <h2 className={styles.settingsCardTitle}>Settings V1 Disabled</h2>
              <p className={styles.settingsCardDescription}>
                The `settings_v1` rollout flag is disabled. Runtime is using defaults only.
              </p>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Flag Source</span>
                  <span className={styles.settingsRowHint}>
                    Enable `PUBLIC_SETTINGS_V1=true` to turn this on.
                  </span>
                </div>
                <span className={styles.settingsRowValue}>
                  {settingsV1Flag.source === "env"
                    ? `${settingsV1Flag.envKey ?? "ENV"}=${settingsV1Flag.rawValue ?? ""}`
                    : "DEFAULT"}
                </span>
              </div>
            </article>
          </div>
        )
        : (
          <div className={styles.settingsGrid}>
            <article id="experience" className={styles.settingsCard}>
              <h2 className={styles.settingsCardTitle}>Experience</h2>
              <p className={styles.settingsCardDescription}>
                Visual defaults for transitions, chart motion, and global UI mode.
              </p>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Animations</span>
                  <span className={styles.settingsRowHint}>Global default</span>
                </div>
                <div className={styles.settingsControlGroup}>
                  <button
                    type="button"
                    className={styles.settingsToggleControl}
                    data-active={settings.animationsEnabled ? "true" : "false"}
                    onClick={() =>
                      applyPatch({
                        animationsEnabled: !settings.animationsEnabled,
                      })}
                  >
                    {settings.animationsEnabled ? "ON" : "OFF"}
                  </button>
                </div>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Transition Intensity</span>
                  <span className={styles.settingsRowHint}>Low / Normal / High</span>
                </div>
                <div className={styles.settingsControlGroup}>
                  <TacticalSelect
                    ariaLabel="Transition intensity"
                    value={settings.transitionIntensity}
                    options={transitionIntensityOptions}
                    onChange={(nextValue) => {
                      if (isTransitionIntensity(nextValue)) {
                        applyPatch({ transitionIntensity: nextValue });
                      }
                    }}
                  />
                </div>
              </div>
            </article>

            <article id="audio" className={styles.settingsCard}>
              <h2 className={styles.settingsCardTitle}>Audio</h2>
              <p className={styles.settingsCardDescription}>
                Default behavior for save chimes, sirens, and global master volume.
              </p>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Master Audio</span>
                  <span className={styles.settingsRowHint}>
                    Applies across all workspaces
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.settingsToggleControl}
                  data-active={settings.masterAudioEnabled ? "true" : "false"}
                  onClick={() => applyPatch({ masterAudioEnabled: !settings.masterAudioEnabled })}
                >
                  {settings.masterAudioEnabled ? "ON" : "OFF"}
                </button>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Save Chime</span>
                  <span className={styles.settingsRowHint}>Canvas save events</span>
                </div>
                <button
                  type="button"
                  className={styles.settingsToggleControl}
                  data-active={settings.saveChimeEnabled ? "true" : "false"}
                  onClick={() => applyPatch({ saveChimeEnabled: !settings.saveChimeEnabled })}
                >
                  {settings.saveChimeEnabled ? "ON" : "OFF"}
                </button>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Load Test Siren Default</span>
                  <span className={styles.settingsRowHint}>Postee load chamber</span>
                </div>
                <button
                  type="button"
                  className={styles.settingsToggleControl}
                  data-active={settings.sirenEnabledDefault ? "true" : "false"}
                  onClick={() =>
                    applyPatch({
                      sirenEnabledDefault: !settings.sirenEnabledDefault,
                    })}
                >
                  {settings.sirenEnabledDefault ? "ON" : "OFF"}
                </button>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Master Volume</span>
                  <span className={styles.settingsRowHint}>
                    Commits on release
                  </span>
                </div>
                <div className={styles.settingsControlGroup}>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={masterVolumeDraft}
                    className={styles.settingsRangeControl}
                    onChange={(event) =>
                      send({
                        type: "SET_MASTER_VOLUME_DRAFT",
                        value: clamp(event.currentTarget.valueAsNumber, 0, 100),
                      })}
                    onMouseUp={(event) => commitMasterVolume(clamp(event.currentTarget.valueAsNumber, 0, 100))}
                    onTouchEnd={(event) => commitMasterVolume(clamp(event.currentTarget.valueAsNumber, 0, 100))}
                    onBlur={(event) => commitMasterVolume(clamp(event.currentTarget.valueAsNumber, 0, 100))}
                    onKeyUp={(event) => commitMasterVolume(clamp(event.currentTarget.valueAsNumber, 0, 100))}
                  />
                  <span className={styles.settingsRangeValue}>
                    {masterVolumeDraft}%
                  </span>
                </div>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Save Chime Diagnostics</span>
                  <span className={styles.settingsRowHint}>
                    Manual audio test and runtime context
                  </span>
                </div>
                <div className={styles.settingsInlineActions}>
                  <span className={styles.settingsRowValue}>{audioRuntimeText}</span>
                  <button
                    type="button"
                    className={styles.settingsActionButton}
                    onClick={() => {
                      void handleTestSaveChime();
                    }}
                    disabled={!canRunAudioDiagnostic}
                  >
                    TEST CHIME
                  </button>
                </div>
              </div>
              {audioDiagnosticMessage && <p className={styles.settingsNotice}>{audioDiagnosticMessage}</p>}
            </article>

            <article id="save-sync" className={styles.settingsCard}>
              <h2 className={styles.settingsCardTitle}>Save & Sync</h2>
              <p className={styles.settingsCardDescription}>
                Defaults for autosave cadence, navigation-save behavior, and sync diagnostics.
              </p>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Autosave</span>
                  <span className={styles.settingsRowHint}>C4 board persistence</span>
                </div>
                <button
                  type="button"
                  className={styles.settingsToggleControl}
                  data-active={settings.autosaveEnabled ? "true" : "false"}
                  onClick={() => applyPatch({ autosaveEnabled: !settings.autosaveEnabled })}
                >
                  {settings.autosaveEnabled ? "ON" : "OFF"}
                </button>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Autosave Interval (ms)</span>
                  <span className={styles.settingsRowHint}>250 - 60000</span>
                </div>
                <div className={styles.settingsControlGroup}>
                  <input
                    type="number"
                    min={250}
                    max={60_000}
                    step={250}
                    value={autosaveIntervalDraft}
                    className={styles.settingsNumberControl}
                    onChange={(event) =>
                      send({
                        type: "SET_AUTOSAVE_DRAFT",
                        value: event.currentTarget.value,
                      })}
                    onBlur={commitAutosaveInterval}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        commitAutosaveInterval();
                      }
                    }}
                  />
                </div>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Save On Navigate</span>
                  <span className={styles.settingsRowHint}>Route transitions</span>
                </div>
                <button
                  type="button"
                  className={styles.settingsToggleControl}
                  data-active={settings.saveOnNavigate ? "true" : "false"}
                  onClick={() => applyPatch({ saveOnNavigate: !settings.saveOnNavigate })}
                >
                  {settings.saveOnNavigate ? "ON" : "OFF"}
                </button>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Big Ball Of Mud Alert Threshold</span>
                  <span className={styles.settingsRowHint}>5.0 - 9.5</span>
                </div>
                <div className={styles.settingsControlGroup}>
                  <input
                    type="number"
                    min={5}
                    max={9.5}
                    step={0.1}
                    value={mudAlertThresholdDraft}
                    className={styles.settingsNumberControl}
                    onChange={(event) =>
                      send({
                        type: "SET_MUD_THRESHOLD_DRAFT",
                        value: event.currentTarget.value,
                      })}
                    onBlur={commitMudAlertThreshold}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        commitMudAlertThreshold();
                      }
                    }}
                  />
                </div>
              </div>
            </article>

            <article id="data-control" className={styles.settingsCard}>
              <h2 className={styles.settingsCardTitle}>Data Control</h2>
              <p className={styles.settingsCardDescription}>
                Export/import actions are scaffolded here and intentionally gated.
              </p>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Workspace Backup</span>
                  <span className={styles.settingsRowHint}>C4 + Postee payload</span>
                </div>
                <div className={styles.settingsInlineActions}>
                  <button
                    type="button"
                    className={styles.settingsActionButton}
                    onClick={() =>
                      handlePlannedAction(
                        "Export backup bundle",
                        "Generate a backup export placeholder action?",
                      )}
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    className={styles.settingsActionButton}
                    onClick={() =>
                      handlePlannedAction(
                        "Import backup bundle",
                        "Run import placeholder flow? Existing data is not modified in this phase.",
                      )}
                  >
                    Import
                  </button>
                </div>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>History Retention (days)</span>
                  <span className={styles.settingsRowHint}>1 - 3650</span>
                </div>
                <div className={styles.settingsControlGroup}>
                  <input
                    type="number"
                    min={1}
                    max={3_650}
                    step={1}
                    value={historyRetentionDraft}
                    className={styles.settingsNumberControl}
                    onChange={(event) =>
                      send({
                        type: "SET_HISTORY_DRAFT",
                        value: event.currentTarget.value,
                      })}
                    onBlur={commitHistoryRetentionDays}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        commitHistoryRetentionDays();
                      }
                    }}
                  />
                </div>
              </div>
              {dataControlNotice && <p className={styles.settingsNotice}>{dataControlNotice}</p>}
            </article>

            <article id="privacy-security" className={styles.settingsCard}>
              <h2 className={styles.settingsCardTitle}>Privacy & Security</h2>
              <p className={styles.settingsCardDescription}>
                Telemetry and redaction defaults for runtime diagnostics.
              </p>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Diagnostics Sharing</span>
                  <span className={styles.settingsRowHint}>
                    Error and crash reporting
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.settingsToggleControl}
                  data-active={settings.telemetryEnabled ? "true" : "false"}
                  onClick={() => applyPatch({ telemetryEnabled: !settings.telemetryEnabled })}
                >
                  {settings.telemetryEnabled ? "ON" : "OFF"}
                </button>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Secret Redaction</span>
                  <span className={styles.settingsRowHint}>Request data masking</span>
                </div>
                <TacticalSelect
                  ariaLabel="Secret redaction mode"
                  value={settings.redactionMode}
                  options={redactionModeOptions}
                  onChange={(nextValue) => {
                    if (isRedactionMode(nextValue)) {
                      applyPatch({ redactionMode: nextValue });
                    }
                  }}
                />
              </div>
            </article>

            <article id="system-status" className={styles.settingsCard}>
              <h2 className={styles.settingsCardTitle}>System Status</h2>
              <p className={styles.settingsCardDescription}>
                Runtime diagnostics for write queue and local persistence.
              </p>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Database Runtime</span>
                  <span className={styles.settingsRowHint}>
                    Single connection + WAL
                  </span>
                </div>
                <span className={styles.settingsRowValue}>{runtimeStatusText}</span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Runtime Contract</span>
                  <span className={styles.settingsRowHint}>
                    WAL + FK ON + 1 CONN + NORMAL SYNC + MIN 5000MS
                  </span>
                </div>
                <span className={styles.settingsRowValue}>
                  {runtimeConfigStatusText}
                </span>
              </div>
              {hasRuntimeConfigDrift && (
                <div className={styles.settingsRow}>
                  <div className={styles.settingsRowLabel}>
                    <span>Drift Detail</span>
                    <span className={styles.settingsRowHint}>
                      Expected runtime contract mismatch
                    </span>
                  </div>
                  <span className={styles.settingsRowValue}>
                    {runtimeConfigMismatchDetails}
                  </span>
                </div>
              )}
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Journal Mode</span>
                  <span className={styles.settingsRowHint}>
                    Backend probe
                  </span>
                </div>
                <span className={styles.settingsRowValue}>{runtimeJournalModeText}</span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Max Connections</span>
                  <span className={styles.settingsRowHint}>
                    SQLx pool setting
                  </span>
                </div>
                <span className={styles.settingsRowValue}>{dbRuntimeStatus.maxConnections}</span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Busy Timeout</span>
                  <span className={styles.settingsRowHint}>
                    SQLite lock wait threshold
                  </span>
                </div>
                <span className={styles.settingsRowValue}>{runtimeBusyTimeoutText}</span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Foreign Keys</span>
                  <span className={styles.settingsRowHint}>
                    Constraint enforcement
                  </span>
                </div>
                <span className={styles.settingsRowValue}>{runtimeForeignKeysText}</span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Synchronous Mode</span>
                  <span className={styles.settingsRowHint}>
                    SQLite durability level
                  </span>
                </div>
                <span className={styles.settingsRowValue}>{runtimeSynchronousModeText}</span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Probe Updated</span>
                  <span className={styles.settingsRowHint}>
                    Last backend runtime sample
                  </span>
                </div>
                <span className={styles.settingsRowValue}>{runtimeProbeUpdatedText}</span>
              </div>
              {dbRuntimeStatus.probeError && (
                <div className={styles.settingsRow}>
                  <div className={styles.settingsRowLabel}>
                    <span>Probe Error</span>
                    <span className={styles.settingsRowHint}>
                      db_runtime_probe
                    </span>
                  </div>
                  <span className={styles.settingsRowValue}>
                    {dbRuntimeStatus.probeError}
                  </span>
                </div>
              )}
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Write Queue</span>
                  <span className={styles.settingsRowHint}>
                    Outstanding writes (active + queued)
                  </span>
                </div>
                <span className={styles.settingsRowValue}>
                  {dbRuntimeStatus.pendingWrites}
                </span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Queued Backlog</span>
                  <span className={styles.settingsRowHint}>
                    Writes waiting behind active operation
                  </span>
                </div>
                <span className={styles.settingsRowValue}>
                  {runtimeQueuedBacklog}
                </span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Active Write</span>
                  <span className={styles.settingsRowHint}>
                    Persistence operation currently executing
                  </span>
                </div>
                <span className={styles.settingsRowValue}>
                  {dbRuntimeStatus.activeWrites > 0 ? "YES" : "NO"}
                </span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Lock Retries</span>
                  <span className={styles.settingsRowHint}>
                    SQLite busy/locked retry attempts
                  </span>
                </div>
                <span className={styles.settingsRowValue}>
                  {dbRuntimeStatus.lockRetries}
                </span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Last Success</span>
                  <span className={styles.settingsRowHint}>
                    Most recent runtime operation completion
                  </span>
                </div>
                <span className={styles.settingsRowValue}>
                  {runtimeLastSuccessText}
                </span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Last Failure</span>
                  <span className={styles.settingsRowHint}>
                    Most recent runtime failure timestamp
                  </span>
                </div>
                <span className={styles.settingsRowValue}>
                  {runtimeLastFailureText}
                </span>
              </div>
              {dbRuntimeStatus.lastErrorMessage && (
                <div className={styles.settingsRow}>
                  <div className={styles.settingsRowLabel}>
                    <span>Last Error</span>
                    <span className={styles.settingsRowHint}>
                      {dbRuntimeStatus.lastErrorClass ?? "runtime"}
                    </span>
                  </div>
                  <span className={styles.settingsRowValue}>
                    {dbRuntimeStatus.lastErrorMessage}
                  </span>
                </div>
              )}
            </article>

            <article id="about" className={styles.settingsCard}>
              <h2 className={styles.settingsCardTitle}>About</h2>
              <p className={styles.settingsCardDescription}>
                Product identity and build channel.
              </p>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Software Version</span>
                  <span className={styles.settingsRowHint}>Runtime metadata</span>
                </div>
                <span className={styles.settingsRowValue}>V1.0.0</span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Release Channel</span>
                  <span className={styles.settingsRowHint}>Distribution track</span>
                </div>
                <span className={styles.settingsRowValue}>STABLE</span>
              </div>
            </article>

            <article
              id="danger-zone"
              className={`${styles.settingsCard} ${styles.settingsCardDanger}`}
            >
              <h2 className={styles.settingsCardTitle}>Danger Zone</h2>
              <p className={styles.settingsCardDescription}>
                Destructive operations stay explicit and confirmation-gated.
              </p>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Reset Global Settings</span>
                  <span className={styles.settingsRowHint}>
                    Restores defaults immediately
                  </span>
                </div>
                <button
                  type="button"
                  className={`${styles.settingsActionButton} ${styles.settingsActionButtonDanger}`}
                  onClick={handleResetToDefaults}
                >
                  Reset
                </button>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Delete All Diagrams</span>
                  <span className={styles.settingsRowHint}>
                    Intentionally locked in this phase
                  </span>
                </div>
                <button
                  type="button"
                  className={`${styles.settingsActionButton} ${styles.settingsActionButtonDanger}`}
                  disabled
                >
                  Locked
                </button>
              </div>
            </article>
          </div>
        )}
    </>
  );
}
