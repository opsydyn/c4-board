import { useMachine } from "@xstate/react";
import { Effect } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";
import {
  detectRigExecutionPolicyViolation,
  summarizeRigExecutionPolicySettings,
  summarizeRigMutationPolicySettings,
} from "../../../core/effects/agent-policy";
import {
  clearRigOpenAiApiKey,
  getRigSecretStatus,
  type RigSecretSource,
  runRigHello,
  storeRigOpenAiApiKey,
} from "../../../core/effects/ai-agent.runtime";
import {
  getRigAgentV1Flag,
  getSettingsV1Flag,
  resolveEffectiveRigAgentV1Rollout,
} from "../../../core/effects/feature-flags";
import type {
  AiActionMode,
  AiProvider,
  AppSettingsPatch,
  RedactionMode,
  RigAgentV1RolloutPreference,
  TransitionIntensity,
} from "../../../core/effects/settings.types";
import { useDatabase } from "../../../core/effects/useDatabase";
import * as styles from "../../../styles/pages/settings.css";
import { useDatabaseRuntimeStatus } from "../../hooks/useDatabaseRuntimeStatus";
import { createSettingsMachine } from "../../machines/settings.machine";
import { TacticalSelect } from "../TacticalSelect";
import { AgentAuditPanel } from "./AgentAuditPanel";

type SaveState = "disabled" | "loading" | "saving" | "saved" | "error";
type AgentHelloState = "idle" | "running" | "success" | "error";
type AgentSecretStatus = "idle" | "loading" | "ready" | "error";
type AgentSecretCommandState = "idle" | "saving" | "clearing";
type RuntimeConfigMismatch = {
  key: string;
  expected: string;
  actual: string;
};
type AudioContextStatus = "running" | "suspended" | "closed" | "unavailable" | "unknown";

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const toErrorMessage = (error: unknown): string => error instanceof Error ? error.message : String(error);
const toSaveSynthVolumeDb = (masterVolume: number): number =>
  masterVolume <= 0
    ? -60
    : -24 + Math.max(0, Math.min(1, masterVolume)) * 20;

const isTransitionIntensity = (value: string): value is TransitionIntensity =>
  value === "low" || value === "normal" || value === "high";

const isRedactionMode = (value: string): value is RedactionMode =>
  value === "off" || value === "standard" || value === "strict";

const isAiProvider = (value: string): value is AiProvider =>
  value === "openai" || value === "anthropic" || value === "openrouter";

const isAiActionMode = (value: string): value is AiActionMode =>
  value === "disabled"
  || value === "read-only"
  || value === "propose"
  || value === "apply-with-confirmation";

const isRigAgentV1RolloutPreference = (
  value: string,
): value is RigAgentV1RolloutPreference => value === "inherit" || value === "canary";

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

const rigModelOptions = [
  { value: "gpt-4o-mini", label: "GPT-4O-MINI" },
  { value: "gpt-4.1-mini", label: "GPT-4.1-MINI" },
] as const;

const aiProviderOptions = [
  { value: "openai", label: "OPENAI" },
  { value: "anthropic", label: "ANTHROPIC" },
  { value: "openrouter", label: "OPENROUTER" },
] as const;

const aiActionModeOptions = [
  { value: "disabled", label: "DISABLED" },
  { value: "read-only", label: "READ-ONLY" },
  { value: "propose", label: "PROPOSE" },
  { value: "apply-with-confirmation", label: "APPLY W/ CONFIRM" },
] as const;

const rigAgentRolloutPreferenceOptions = [
  { value: "inherit", label: "INHERIT" },
  { value: "canary", label: "CANARY OPT-IN" },
] as const;

const settingsMutationLockOptions = [
  { value: "locked", label: "LOCKED" },
  { value: "unlocked", label: "UNLOCKED" },
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

const BYTES_PER_MEGABYTE = 1024 * 1024;

const normalizeByteCount = (value: number | null): number | null => {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.round(value));
};

const resolveMegabytes = (megabytes: number | null, bytes: number | null): number | null => {
  if (megabytes !== null && Number.isFinite(megabytes)) {
    return Math.max(0, megabytes);
  }

  if (bytes !== null && Number.isFinite(bytes)) {
    return Math.max(0, bytes / BYTES_PER_MEGABYTE);
  }

  return null;
};

const formatStorageStatus = (bytes: number | null, megabytes: number | null): string => {
  const normalizedBytes = normalizeByteCount(bytes);
  const resolvedMegabytes = resolveMegabytes(megabytes, normalizedBytes);

  if (normalizedBytes === null && resolvedMegabytes === null) {
    return "N/A";
  }

  if (normalizedBytes === null) {
    return `${resolvedMegabytes?.toFixed(2) ?? "0.00"} MB`;
  }

  if (resolvedMegabytes === null) {
    return `${normalizedBytes.toLocaleString()} B`;
  }

  return `${resolvedMegabytes.toFixed(2)} MB (${normalizedBytes.toLocaleString()} B)`;
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
  const rigAgentRolloutFlag = getRigAgentV1Flag();
  const diagnosticSynthRef = useRef<Tone.PolySynth<Tone.Synth> | null>(null);
  const [audioContextStatus, setAudioContextStatus] = useState<AudioContextStatus>("unknown");
  const [audioDiagnosticMessage, setAudioDiagnosticMessage] = useState<string | null>(null);
  const [agentHelloState, setAgentHelloState] = useState<AgentHelloState>("idle");
  const [agentHelloPrompt, setAgentHelloPrompt] = useState<string>(
    "Say hello to OPSYDYN // PRECISION TOOLS.",
  );
  const [aiTemperatureDraft, setAiTemperatureDraft] = useState<string>("0.2");
  const [aiMaxTokensDraft, setAiMaxTokensDraft] = useState<string>("1024");
  const [maxActionsPerBatchDraft, setMaxActionsPerBatchDraft] = useState<string>("48");
  const [maxNodesCreatedPerRunDraft, setMaxNodesCreatedPerRunDraft] = useState<string>("12");
  const [maxEdgesCreatedPerRunDraft, setMaxEdgesCreatedPerRunDraft] = useState<string>("24");
  const [openAiApiKeyDraft, setOpenAiApiKeyDraft] = useState<string>("");
  const [agentHelloOutput, setAgentHelloOutput] = useState<string | null>(null);
  const [agentHelloError, setAgentHelloError] = useState<string | null>(null);
  const [agentSecretStatus, setAgentSecretStatus] = useState<AgentSecretStatus>("idle");
  const [agentSecretSource, setAgentSecretSource] = useState<RigSecretSource>("none");
  const [agentSecretWarning, setAgentSecretWarning] = useState<string | null>(null);
  const [agentSecretStatusError, setAgentSecretStatusError] = useState<string | null>(null);
  const [agentSecretResolutionOrder, setAgentSecretResolutionOrder] = useState<ReadonlyArray<string>>([]);
  const [agentSecretCommandState, setAgentSecretCommandState] = useState<AgentSecretCommandState>("idle");
  const [agentSecretActionMessage, setAgentSecretActionMessage] = useState<string | null>(null);
  const hasOpenAiRuntimeProvider = settings.aiSettings.provider === "openai";
  const hasPendingProviderSupport = settings.aiSettings.provider !== "openai";
  const runtimeProviderText = hasOpenAiRuntimeProvider
    ? "OPENAI ACTIVE"
    : `LIMITED (OPENAI RUNTIME, CONFIG=${settings.aiSettings.provider.toUpperCase()})`;
  const rigAgentEffectiveRollout = useMemo(
    () =>
      resolveEffectiveRigAgentV1Rollout(
        rigAgentRolloutFlag,
        settings.rigAgentRolloutPreference,
      ),
    [rigAgentRolloutFlag, settings.rigAgentRolloutPreference],
  );
  const rigExecutionPolicySummary = useMemo(
    () => summarizeRigExecutionPolicySettings(settings.rigExecutionPolicy),
    [settings.rigExecutionPolicy],
  );
  const selectedRigExecutionViolation = useMemo(
    () =>
      detectRigExecutionPolicyViolation({
        policy: settings.rigExecutionPolicy,
        provider: settings.aiSettings.provider,
        model: settings.aiSettings.model,
      }),
    [
      settings.aiSettings.model,
      settings.aiSettings.provider,
      settings.rigExecutionPolicy,
    ],
  );
  const agentPolicySummary = useMemo(
    () => summarizeRigMutationPolicySettings(settings.agentPolicy),
    [settings.agentPolicy],
  );
  const agentModelOptions = useMemo(() => {
    const model = settings.aiSettings.model.trim();
    if (model.length === 0 || rigModelOptions.some((option) => option.value === model)) {
      return [...rigModelOptions];
    }

    return [
      {
        value: model,
        label: model.toUpperCase(),
      },
      ...rigModelOptions,
    ];
  }, [settings.aiSettings.model]);
  const rigAgentRolloutBaseText = useMemo(
    () =>
      `${rigAgentRolloutFlag.mode.toUpperCase()} :: ${
        rigAgentRolloutFlag.source === "env" && rigAgentRolloutFlag.envKey
          ? rigAgentRolloutFlag.envKey
          : "DEFAULT"
      }`,
    [rigAgentRolloutFlag],
  );
  const rigAgentRolloutEffectiveText = useMemo(() => {
    if (
      rigAgentEffectiveRollout.baseMode === "canary"
      && rigAgentEffectiveRollout.mode === "disabled"
      && rigAgentEffectiveRollout.preference === "inherit"
    ) {
      return "DISABLED :: OPT-IN REQUIRED";
    }

    return `${rigAgentEffectiveRollout.mode.toUpperCase()} :: ${rigAgentEffectiveRollout.source.toUpperCase()}`;
  }, [rigAgentEffectiveRollout]);
  const rigAgentRolloutNotice = useMemo(() => {
    if (
      rigAgentEffectiveRollout.baseMode === "canary"
      && rigAgentEffectiveRollout.mode === "disabled"
      && rigAgentEffectiveRollout.preference === "inherit"
    ) {
      return "RIG_AGENT_V1 CANARY IS AVAILABLE, BUT THIS WORKSTATION IS NOT ENROLLED. OPY COMMANDS STAY OFFLINE UNTIL CANARY OPT-IN IS ENABLED.";
    }

    if (rigAgentEffectiveRollout.mode === "canary") {
      return "THIS WORKSTATION IS RUNNING THE RIG_AGENT_V1 CANARY. OPY FLOWS FOLLOW THE STORED ACTION MODE, BUT THE ROLLOUT REMAINS STAGED.";
    }

    if (
      rigAgentEffectiveRollout.baseMode === "enabled"
      && rigAgentRolloutFlag.source === "default"
    ) {
      return "RIG_AGENT_V1 IS ENABLED BY THE LOCAL DEVELOPMENT DEFAULT. SET RIG_AGENT_V1 EXPLICITLY TO STAGE OR DISABLE THE RUNTIME.";
    }

    if (rigAgentEffectiveRollout.baseMode === "enabled") {
      return "RIG_AGENT_V1 IS ENABLED BY ENVIRONMENT ROLLOUT.";
    }

    return "RIG_AGENT_V1 IS DISABLED BY DEFAULT ROLLOUT.";
  }, [rigAgentEffectiveRollout, rigAgentRolloutFlag.source]);
  const rigExecutionPolicyStatusText = useMemo(() => {
    if (!selectedRigExecutionViolation) {
      return "ALLOWED";
    }

    return `BLOCKED :: ${selectedRigExecutionViolation.kind.toUpperCase()}`;
  }, [selectedRigExecutionViolation]);
  const rigExecutionPolicyNotice = useMemo(() => {
    if (!selectedRigExecutionViolation) {
      return "SELECTED PROVIDER/MODEL PASSES THE CURRENT RIG EXECUTION POLICY.";
    }

    return `${selectedRigExecutionViolation.message} ${selectedRigExecutionViolation.recommendedAction}`;
  }, [selectedRigExecutionViolation]);
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
  const runtimeDbSizeText = useMemo(
    () =>
      formatStorageStatus(
        dbRuntimeStatus.dbFileSizeBytes,
        dbRuntimeStatus.dbFileSizeMb,
      ),
    [dbRuntimeStatus.dbFileSizeBytes, dbRuntimeStatus.dbFileSizeMb],
  );
  const runtimeWalSizeText = useMemo(
    () =>
      formatStorageStatus(
        dbRuntimeStatus.walFileSizeBytes,
        dbRuntimeStatus.walFileSizeMb,
      ),
    [dbRuntimeStatus.walFileSizeBytes, dbRuntimeStatus.walFileSizeMb],
  );
  const runtimeTotalFootprintText = useMemo(() => {
    const dbBytes = normalizeByteCount(dbRuntimeStatus.dbFileSizeBytes);
    const walBytes = normalizeByteCount(dbRuntimeStatus.walFileSizeBytes);

    if (dbBytes === null && walBytes === null) {
      return "N/A";
    }

    return formatStorageStatus((dbBytes ?? 0) + (walBytes ?? 0), null);
  }, [dbRuntimeStatus.dbFileSizeBytes, dbRuntimeStatus.walFileSizeBytes]);
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
    const volLabel = settings.saveVolEnabled ? "ON" : "OFF";
    return `CTX::${contextLabel} MASTER-VOL::${Math.round(diagnosticMasterVolume * 100)}% SAVE-VOL::${volLabel}`;
  }, [audioContextStatus, diagnosticMasterVolume, settings.saveVolEnabled]);
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
  const handleTestSaveVol = useCallback(async () => {
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
        settings.saveVolEnabled
          ? "AUDIO TEST OK"
          : "AUDIO TEST OK (SAVE VOL TOGGLE IS OFF)",
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
    settings.saveVolEnabled,
  ]);
  const handleRunRigHello = useCallback(() => {
    if (selectedRigExecutionViolation) {
      setAgentHelloState("error");
      setAgentHelloOutput(null);
      setAgentHelloError(
        `${selectedRigExecutionViolation.message} ${selectedRigExecutionViolation.recommendedAction}`,
      );
      return;
    }

    if (!hasOpenAiRuntimeProvider) {
      setAgentHelloState("error");
      setAgentHelloOutput(null);
      setAgentHelloError("RUNTIME CURRENTLY SUPPORTS OPENAI ONLY. SWITCH PROVIDER TO OPENAI.");
      return;
    }

    setAgentHelloState("running");
    setAgentHelloOutput(null);
    setAgentHelloError(null);

    void Effect.runPromise(
      runRigHello({
        model: settings.aiSettings.model,
        prompt: agentHelloPrompt,
        temperature: settings.aiSettings.temperature,
        maxTokens: settings.aiSettings.maxTokens,
      }),
    )
      .then((result) => {
        setAgentHelloState("success");
        setAgentHelloOutput(result.message);
      })
      .catch((error: unknown) => {
        setAgentHelloState("error");
        setAgentHelloError(toErrorMessage(error));
      });
  }, [
    agentHelloPrompt,
    hasOpenAiRuntimeProvider,
    selectedRigExecutionViolation,
    settings.aiSettings.maxTokens,
    settings.aiSettings.model,
    settings.aiSettings.temperature,
  ]);
  const refreshAgentSecretStatus = useCallback(() => {
    setAgentSecretStatus("loading");
    setAgentSecretStatusError(null);

    void Effect.runPromise(getRigSecretStatus())
      .then((status) => {
        setAgentSecretStatus("ready");
        setAgentSecretSource(status.source);
        setAgentSecretWarning(status.warning);
        setAgentSecretResolutionOrder(status.resolutionOrder);
      })
      .catch((error: unknown) => {
        setAgentSecretStatus("error");
        setAgentSecretSource("none");
        setAgentSecretWarning(null);
        setAgentSecretStatusError(toErrorMessage(error));
      });
  }, []);
  const applyPatch = useCallback(
    (patch: AppSettingsPatch) => {
      if (!settingsV1Enabled) {
        return;
      }
      send({ type: "PATCH", patch });
    },
    [send, settingsV1Enabled],
  );
  const toggleAllowedProvider = useCallback(
    (provider: AiProvider) => {
      const currentProviders = settings.rigExecutionPolicy.allowedProviders;
      const nextProviders = currentProviders.includes(provider)
        ? currentProviders.filter((currentProvider) => currentProvider !== provider)
        : [
          ...currentProviders,
          provider,
        ];

      applyPatch({
        rigExecutionPolicy: {
          ...settings.rigExecutionPolicy,
          allowedProviders: nextProviders,
        },
      });
    },
    [applyPatch, settings.rigExecutionPolicy],
  );
  const toggleAllowedModel = useCallback(
    (model: string) => {
      const normalizedModel = model.trim();
      const currentModels = settings.rigExecutionPolicy.allowedModels;
      const nextModels = currentModels.includes(normalizedModel)
        ? currentModels.filter((currentModel) => currentModel !== normalizedModel)
        : [
          ...currentModels,
          normalizedModel,
        ];

      applyPatch({
        rigExecutionPolicy: {
          ...settings.rigExecutionPolicy,
          allowedModels: nextModels,
        },
      });
    },
    [applyPatch, settings.rigExecutionPolicy],
  );
  const clearLegacyOpenAiFallback = useCallback(() => {
    if (settings.openAiApiKey.trim().length === 0) {
      return;
    }

    applyPatch({ openAiApiKey: "" });
  }, [applyPatch, settings.openAiApiKey]);
  const handleStoreOpenAiApiKey = useCallback(() => {
    const normalized = openAiApiKeyDraft.trim();
    if (normalized.length === 0) {
      setAgentSecretActionMessage("OPENAI KEY CANNOT BE EMPTY.");
      return;
    }

    setAgentSecretCommandState("saving");
    setAgentSecretActionMessage(null);
    setAgentSecretStatusError(null);

    void Effect.runPromise(storeRigOpenAiApiKey(normalized))
      .then((status) => {
        setAgentSecretStatus("ready");
        setAgentSecretSource(status.source);
        setAgentSecretWarning(status.warning);
        setAgentSecretResolutionOrder(status.resolutionOrder);
        setOpenAiApiKeyDraft("");
        // Only drop the settings-db copy when the key actually reached the keychain.
        // On macOS debug builds the keychain is disabled by design, so settings-db IS
        // the store — clearing unconditionally wiped the key that had just been saved
        // and left the agent unusable with nothing reported as wrong.
        if (status.source === "keychain") {
          clearLegacyOpenAiFallback();
        }
        setAgentSecretActionMessage(
          status.source === "keychain"
            ? "OPENAI KEY STORED IN KEYCHAIN."
            : status.source === "settings-db"
            ? "OPENAI KEY STORED IN SETTINGS DB FALLBACK."
            : "OPENAI KEY STORED.",
        );
      })
      .catch((error: unknown) => {
        setAgentSecretStatus("error");
        setAgentSecretStatusError(toErrorMessage(error));
        setAgentSecretActionMessage(null);
      })
      .finally(() => {
        setAgentSecretCommandState("idle");
      });
  }, [clearLegacyOpenAiFallback, openAiApiKeyDraft]);
  const canClearManagedAgentSecret = useMemo(
    () => agentSecretSource === "keychain" || agentSecretSource === "settings-db",
    [agentSecretSource],
  );
  const handleClearOpenAiApiKey = useCallback(() => {
    setAgentSecretCommandState("clearing");
    setAgentSecretActionMessage(null);
    setAgentSecretStatusError(null);

    void Effect.runPromise(clearRigOpenAiApiKey())
      .then((status) => {
        setAgentSecretStatus("ready");
        setAgentSecretSource(status.source);
        setAgentSecretWarning(status.warning);
        setAgentSecretResolutionOrder(status.resolutionOrder);
        setOpenAiApiKeyDraft("");
        clearLegacyOpenAiFallback();
        setAgentSecretActionMessage("MANAGED OPENAI KEY CLEARED.");
      })
      .catch((error: unknown) => {
        setAgentSecretStatus("error");
        setAgentSecretStatusError(toErrorMessage(error));
        setAgentSecretActionMessage(null);
      })
      .finally(() => {
        setAgentSecretCommandState("idle");
      });
  }, [clearLegacyOpenAiFallback]);
  const hasConfiguredAgentSecret = useMemo(
    () => agentSecretSource !== "none",
    [agentSecretSource],
  );
  const agentSecretSourceLabel = useMemo(() => {
    switch (agentSecretSource) {
      case "keychain":
        return "KEYCHAIN";
      case "settings-db":
        return "SETTINGS DB (FALLBACK)";
      case "env":
        return "ENV VAR (FALLBACK)";
      case "none":
        return "UNCONFIGURED";
    }
  }, [agentSecretSource]);
  const agentSecretStatusText = useMemo(() => {
    if (agentSecretCommandState === "saving") {
      return "SAVING";
    }

    if (agentSecretCommandState === "clearing") {
      return "CLEARING";
    }

    switch (agentSecretStatus) {
      case "idle":
        return "IDLE";
      case "loading":
        return "CHECKING";
      case "ready":
        return hasConfiguredAgentSecret ? "KEY PRESENT" : "MISSING KEY";
      case "error":
        return "STATUS ERROR";
    }
  }, [agentSecretCommandState, agentSecretStatus, hasConfiguredAgentSecret]);
  const agentHelloStatusText = useMemo(() => {
    switch (agentHelloState) {
      case "idle":
        return "IDLE";
      case "running":
        return "RUNNING";
      case "success":
        return "SUCCESS";
      case "error":
        return "ERROR";
    }
  }, [agentHelloState]);
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
  const commitAiTemperature = useCallback(() => {
    const parsed = Number(aiTemperatureDraft);
    if (!Number.isFinite(parsed)) {
      setAiTemperatureDraft(settings.aiSettings.temperature.toFixed(2));
      return;
    }

    const normalized = Math.round(clamp(parsed, 0, 2) * 100) / 100;
    setAiTemperatureDraft(normalized.toFixed(2));
    if (normalized === settings.aiSettings.temperature) {
      return;
    }

    applyPatch({
      aiSettings: {
        ...settings.aiSettings,
        temperature: normalized,
      },
    });
  }, [aiTemperatureDraft, applyPatch, settings.aiSettings]);

  const commitAiMaxTokens = useCallback(() => {
    const parsed = Number(aiMaxTokensDraft);
    if (!Number.isFinite(parsed)) {
      setAiMaxTokensDraft(String(settings.aiSettings.maxTokens));
      return;
    }

    const normalized = clamp(Math.round(parsed), 64, 32_768);
    setAiMaxTokensDraft(String(normalized));
    if (normalized === settings.aiSettings.maxTokens) {
      return;
    }

    applyPatch({
      aiSettings: {
        ...settings.aiSettings,
        maxTokens: normalized,
      },
    });
  }, [aiMaxTokensDraft, applyPatch, settings.aiSettings]);

  const commitMaxActionsPerBatch = useCallback(() => {
    const parsed = Number(maxActionsPerBatchDraft);
    if (!Number.isFinite(parsed)) {
      setMaxActionsPerBatchDraft(String(settings.agentPolicy.maxActionsPerBatch));
      return;
    }

    const normalized = clamp(Math.round(parsed), 0, 256);
    setMaxActionsPerBatchDraft(String(normalized));
    if (normalized === settings.agentPolicy.maxActionsPerBatch) {
      return;
    }

    applyPatch({
      agentPolicy: {
        ...settings.agentPolicy,
        maxActionsPerBatch: normalized,
      },
    });
  }, [applyPatch, maxActionsPerBatchDraft, settings.agentPolicy]);

  const commitMaxNodesCreatedPerRun = useCallback(() => {
    const parsed = Number(maxNodesCreatedPerRunDraft);
    if (!Number.isFinite(parsed)) {
      setMaxNodesCreatedPerRunDraft(String(settings.agentPolicy.maxNodesCreatedPerRun));
      return;
    }

    const normalized = clamp(Math.round(parsed), 0, 128);
    setMaxNodesCreatedPerRunDraft(String(normalized));
    if (normalized === settings.agentPolicy.maxNodesCreatedPerRun) {
      return;
    }

    applyPatch({
      agentPolicy: {
        ...settings.agentPolicy,
        maxNodesCreatedPerRun: normalized,
      },
    });
  }, [applyPatch, maxNodesCreatedPerRunDraft, settings.agentPolicy]);

  const commitMaxEdgesCreatedPerRun = useCallback(() => {
    const parsed = Number(maxEdgesCreatedPerRunDraft);
    if (!Number.isFinite(parsed)) {
      setMaxEdgesCreatedPerRunDraft(String(settings.agentPolicy.maxEdgesCreatedPerRun));
      return;
    }

    const normalized = clamp(Math.round(parsed), 0, 256);
    setMaxEdgesCreatedPerRunDraft(String(normalized));
    if (normalized === settings.agentPolicy.maxEdgesCreatedPerRun) {
      return;
    }

    applyPatch({
      agentPolicy: {
        ...settings.agentPolicy,
        maxEdgesCreatedPerRun: normalized,
      },
    });
  }, [applyPatch, maxEdgesCreatedPerRunDraft, settings.agentPolicy]);

  useEffect(() => {
    if (settings.openAiApiKey.trim().length > 0) {
      setOpenAiApiKeyDraft(settings.openAiApiKey);
    }
  }, [settings.openAiApiKey]);
  useEffect(() => {
    setAiTemperatureDraft(settings.aiSettings.temperature.toFixed(2));
  }, [settings.aiSettings.temperature]);
  useEffect(() => {
    setAiMaxTokensDraft(String(settings.aiSettings.maxTokens));
  }, [settings.aiSettings.maxTokens]);
  useEffect(() => {
    setMaxActionsPerBatchDraft(String(settings.agentPolicy.maxActionsPerBatch));
  }, [settings.agentPolicy.maxActionsPerBatch]);
  useEffect(() => {
    setMaxNodesCreatedPerRunDraft(String(settings.agentPolicy.maxNodesCreatedPerRun));
  }, [settings.agentPolicy.maxNodesCreatedPerRun]);
  useEffect(() => {
    setMaxEdgesCreatedPerRunDraft(String(settings.agentPolicy.maxEdgesCreatedPerRun));
  }, [settings.agentPolicy.maxEdgesCreatedPerRun]);
  useEffect(() => {
    refreshAgentSecretStatus();
  }, [refreshAgentSecretStatus]);

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
                Default behavior for save vol cues, sirens, and global master volume.
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
                  <span>Save Vol</span>
                  <span className={styles.settingsRowHint}>Canvas save events</span>
                </div>
                <button
                  type="button"
                  className={styles.settingsToggleControl}
                  data-active={settings.saveVolEnabled ? "true" : "false"}
                  onClick={() => applyPatch({ saveVolEnabled: !settings.saveVolEnabled })}
                >
                  {settings.saveVolEnabled ? "ON" : "OFF"}
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
                  <span>Save Vol Diagnostics</span>
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
                      void handleTestSaveVol();
                    }}
                    disabled={!canRunAudioDiagnostic}
                  >
                    TEST VOL
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

            <article id="workspace-panels" className={styles.settingsCard}>
              <h2 className={styles.settingsCardTitle}>Workspace Panels</h2>
              <p className={styles.settingsCardDescription}>
                Default panel visibility for C4 and DDD workspaces.
              </p>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Azure Sync Panel</span>
                  <span className={styles.settingsRowHint}>Cloud icon panel toggle default</span>
                </div>
                <button
                  type="button"
                  className={styles.settingsToggleControl}
                  data-active={settings.azurePanelVisible ? "true" : "false"}
                  onClick={() =>
                    applyPatch({
                      azurePanelVisible: !settings.azurePanelVisible,
                    })}
                >
                  {settings.azurePanelVisible ? "ON" : "OFF"}
                </button>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Ownership Lens</span>
                  <span className={styles.settingsRowHint}>Users icon panel toggle default</span>
                </div>
                <button
                  type="button"
                  className={styles.settingsToggleControl}
                  data-active={settings.ownershipLensVisible ? "true" : "false"}
                  onClick={() =>
                    applyPatch({
                      ownershipLensVisible: !settings.ownershipLensVisible,
                    })}
                >
                  {settings.ownershipLensVisible ? "ON" : "OFF"}
                </button>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Coupling Explainability</span>
                  <span className={styles.settingsRowHint}>Graph icon panel toggle default</span>
                </div>
                <button
                  type="button"
                  className={styles.settingsToggleControl}
                  data-active={settings.couplingExplainabilityVisible ? "true" : "false"}
                  onClick={() =>
                    applyPatch({
                      couplingExplainabilityVisible: !settings.couplingExplainabilityVisible,
                    })}
                >
                  {settings.couplingExplainabilityVisible ? "ON" : "OFF"}
                </button>
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

            <article id="ai-agent" className={styles.settingsCard}>
              <h2 className={styles.settingsCardTitle}>AI Agent (Rig)</h2>
              <p className={styles.settingsCardDescription}>
                Hello-world agent path wired through Rust + Tauri command boundary.
              </p>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>OpenAI API Key</span>
                  <span className={styles.settingsRowHint}>
                    Keychain-first resolver with secure fallbacks
                  </span>
                </div>
                <div className={styles.settingsControlGroup}>
                  <input
                    type="password"
                    className={styles.settingsNumberControl}
                    value={openAiApiKeyDraft}
                    onChange={(event) => setOpenAiApiKeyDraft(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleStoreOpenAiApiKey();
                      }
                    }}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={hasConfiguredAgentSecret && openAiApiKeyDraft.trim().length === 0
                      ? "stored in secure resolver"
                      : "sk-..."}
                    aria-label="OpenAI API key"
                  />
                  <button
                    type="button"
                    className={styles.settingsActionButton}
                    onClick={handleStoreOpenAiApiKey}
                    disabled={agentSecretCommandState !== "idle" || openAiApiKeyDraft.trim().length === 0}
                  >
                    Save Key
                  </button>
                  <button
                    type="button"
                    className={`${styles.settingsActionButton} ${styles.settingsActionButtonDanger}`}
                    onClick={handleClearOpenAiApiKey}
                    disabled={agentSecretCommandState !== "idle" || !canClearManagedAgentSecret}
                  >
                    Clear Managed Key
                  </button>
                </div>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Secret Source</span>
                  <span className={styles.settingsRowHint}>Resolution priority: keychain to settings-db to env</span>
                </div>
                <span className={styles.settingsRowValue}>{agentSecretSourceLabel}</span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Runtime</span>
                  <span className={styles.settingsRowHint}>rig-core + OpenAI provider</span>
                </div>
                <span className={styles.settingsRowValue}>
                  {agentSecretStatusText}
                </span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Rollout Base</span>
                  <span className={styles.settingsRowHint}>Env/default rig_agent_v1 state</span>
                </div>
                <span className={styles.settingsRowValue}>{rigAgentRolloutBaseText}</span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Canary Enrollment</span>
                  <span className={styles.settingsRowHint}>Local workstation opt-in</span>
                </div>
                <div className={styles.settingsControlGroup}>
                  <TacticalSelect
                    ariaLabel="Rig rollout canary enrollment"
                    value={settings.rigAgentRolloutPreference}
                    options={rigAgentRolloutPreferenceOptions}
                    onChange={(nextValue) => {
                      if (!isRigAgentV1RolloutPreference(nextValue)) {
                        return;
                      }
                      applyPatch({
                        rigAgentRolloutPreference: nextValue,
                      });
                    }}
                  />
                </div>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Rollout Effective</span>
                  <span className={styles.settingsRowHint}>Resolved runtime boundary for OPY</span>
                </div>
                <span className={styles.settingsRowValue}>{rigAgentRolloutEffectiveText}</span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Kill Switch</span>
                  <span className={styles.settingsRowHint}>Hard stop for all Rig execution paths</span>
                </div>
                <button
                  type="button"
                  className={styles.settingsToggleControl}
                  data-active={settings.rigExecutionPolicy.killSwitchEnabled ? "true" : "false"}
                  onClick={() =>
                    applyPatch({
                      rigExecutionPolicy: {
                        ...settings.rigExecutionPolicy,
                        killSwitchEnabled: !settings.rigExecutionPolicy.killSwitchEnabled,
                      },
                    })}
                >
                  {settings.rigExecutionPolicy.killSwitchEnabled ? "ON" : "OFF"}
                </button>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Execution Policy</span>
                  <span className={styles.settingsRowHint}>Selected provider/model execution gate</span>
                </div>
                <span className={styles.settingsRowValue}>{rigExecutionPolicyStatusText}</span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Governance Snapshot</span>
                  <span className={styles.settingsRowHint}>Kill switch + allow-list state</span>
                </div>
                <span className={styles.settingsRowValue}>{rigExecutionPolicySummary}</span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Provider Allow-List</span>
                  <span className={styles.settingsRowHint}>Runtime can execute only allowed providers</span>
                </div>
                <div className={styles.settingsInlineActions}>
                  {aiProviderOptions.map((option) => {
                    const active = settings.rigExecutionPolicy.allowedProviders.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={styles.settingsToggleControl}
                        data-active={active ? "true" : "false"}
                        onClick={() => {
                          toggleAllowedProvider(option.value);
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Model Allow-List</span>
                  <span className={styles.settingsRowHint}>Selected model must stay on this allow-list</span>
                </div>
                <div className={styles.settingsInlineActions}>
                  {agentModelOptions.map((option) => {
                    const active = settings.rigExecutionPolicy.allowedModels.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={styles.settingsToggleControl}
                        data-active={active ? "true" : "false"}
                        onClick={() => {
                          toggleAllowedModel(option.value);
                        }}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {agentSecretActionMessage && <p className={styles.settingsNotice}>{agentSecretActionMessage}</p>}
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Provider</span>
                  <span className={styles.settingsRowHint}>Configured provider target</span>
                </div>
                <div className={styles.settingsControlGroup}>
                  <TacticalSelect
                    ariaLabel="AI provider"
                    value={settings.aiSettings.provider}
                    options={aiProviderOptions}
                    onChange={(nextValue) => {
                      if (!isAiProvider(nextValue)) {
                        return;
                      }
                      applyPatch({
                        aiSettings: {
                          ...settings.aiSettings,
                          provider: nextValue,
                        },
                      });
                    }}
                  />
                </div>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Model</span>
                  <span className={styles.settingsRowHint}>Default model target</span>
                </div>
                <div className={styles.settingsControlGroup}>
                  <TacticalSelect
                    ariaLabel="Rig hello model"
                    value={settings.aiSettings.model}
                    options={agentModelOptions}
                    onChange={(nextValue) => {
                      if (nextValue.trim().length === 0) {
                        return;
                      }
                      applyPatch({
                        aiSettings: {
                          ...settings.aiSettings,
                          model: nextValue,
                        },
                      });
                    }}
                  />
                </div>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Temperature</span>
                  <span className={styles.settingsRowHint}>Sampling (0.00 to 2.00)</span>
                </div>
                <div className={styles.settingsControlGroup}>
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.01}
                    className={styles.settingsNumberControl}
                    value={aiTemperatureDraft}
                    onChange={(event) => setAiTemperatureDraft(event.currentTarget.value)}
                    onBlur={commitAiTemperature}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        commitAiTemperature();
                      }
                    }}
                    aria-label="AI temperature"
                  />
                </div>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Max Tokens</span>
                  <span className={styles.settingsRowHint}>Response ceiling (64 to 32768)</span>
                </div>
                <div className={styles.settingsControlGroup}>
                  <input
                    type="number"
                    min={64}
                    max={32768}
                    step={1}
                    className={styles.settingsNumberControl}
                    value={aiMaxTokensDraft}
                    onChange={(event) => setAiMaxTokensDraft(event.currentTarget.value)}
                    onBlur={commitAiMaxTokens}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        commitAiMaxTokens();
                      }
                    }}
                    aria-label="AI max tokens"
                  />
                </div>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Action Mode</span>
                  <span className={styles.settingsRowHint}>Safety profile for OPY mutations</span>
                </div>
                <div className={styles.settingsControlGroup}>
                  <TacticalSelect
                    ariaLabel="AI action mode"
                    value={settings.aiSettings.actionMode}
                    options={aiActionModeOptions}
                    onChange={(nextValue) => {
                      if (!isAiActionMode(nextValue)) {
                        return;
                      }
                      applyPatch({
                        aiSettings: {
                          ...settings.aiSettings,
                          actionMode: nextValue,
                        },
                      });
                    }}
                  />
                </div>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Policy Snapshot</span>
                  <span className={styles.settingsRowHint}>Live runtime mutation budget</span>
                </div>
                <span className={styles.settingsRowValue}>{agentPolicySummary}</span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Max Actions Per Batch</span>
                  <span className={styles.settingsRowHint}>0 to 256</span>
                </div>
                <div className={styles.settingsControlGroup}>
                  <input
                    type="number"
                    min={0}
                    max={256}
                    step={1}
                    className={styles.settingsNumberControl}
                    value={maxActionsPerBatchDraft}
                    onChange={(event) => setMaxActionsPerBatchDraft(event.currentTarget.value)}
                    onBlur={commitMaxActionsPerBatch}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        commitMaxActionsPerBatch();
                      }
                    }}
                    aria-label="Agent policy max actions per batch"
                  />
                </div>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Max Nodes Created</span>
                  <span className={styles.settingsRowHint}>Per OPY run, 0 to 128</span>
                </div>
                <div className={styles.settingsControlGroup}>
                  <input
                    type="number"
                    min={0}
                    max={128}
                    step={1}
                    className={styles.settingsNumberControl}
                    value={maxNodesCreatedPerRunDraft}
                    onChange={(event) => setMaxNodesCreatedPerRunDraft(event.currentTarget.value)}
                    onBlur={commitMaxNodesCreatedPerRun}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        commitMaxNodesCreatedPerRun();
                      }
                    }}
                    aria-label="Agent policy max nodes created per run"
                  />
                </div>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Max Edges Created</span>
                  <span className={styles.settingsRowHint}>Per OPY run, 0 to 256</span>
                </div>
                <div className={styles.settingsControlGroup}>
                  <input
                    type="number"
                    min={0}
                    max={256}
                    step={1}
                    className={styles.settingsNumberControl}
                    value={maxEdgesCreatedPerRunDraft}
                    onChange={(event) => setMaxEdgesCreatedPerRunDraft(event.currentTarget.value)}
                    onBlur={commitMaxEdgesCreatedPerRun}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        commitMaxEdgesCreatedPerRun();
                      }
                    }}
                    aria-label="Agent policy max edges created per run"
                  />
                </div>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Settings Mutation Lock</span>
                  <span className={styles.settingsRowHint}>Protect settings scope from agent writes</span>
                </div>
                <div className={styles.settingsControlGroup}>
                  <TacticalSelect
                    ariaLabel="Agent policy settings mutation lock"
                    value={settings.agentPolicy.allowSettingsMutation ? "unlocked" : "locked"}
                    options={settingsMutationLockOptions}
                    onChange={(nextValue) => {
                      if (nextValue !== "locked" && nextValue !== "unlocked") {
                        return;
                      }
                      applyPatch({
                        agentPolicy: {
                          ...settings.agentPolicy,
                          allowSettingsMutation: nextValue === "unlocked",
                        },
                      });
                    }}
                  />
                </div>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Prompt</span>
                  <span className={styles.settingsRowHint}>Single hello-world request</span>
                </div>
                <div className={styles.settingsControlGroup}>
                  <input
                    type="text"
                    className={styles.settingsNumberControl}
                    value={agentHelloPrompt}
                    onChange={(event) => setAgentHelloPrompt(event.currentTarget.value)}
                    aria-label="Rig hello prompt"
                  />
                </div>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Status</span>
                  <span className={styles.settingsRowHint}>Rust command execution state + provider runtime</span>
                </div>
                <div className={styles.settingsInlineActions}>
                  <span className={styles.settingsRowValue}>{`${agentHelloStatusText} :: ${runtimeProviderText}`}</span>
                  <button
                    type="button"
                    className={styles.settingsActionButton}
                    onClick={handleRunRigHello}
                    disabled={agentHelloState === "running"
                      || !hasOpenAiRuntimeProvider
                      || selectedRigExecutionViolation !== null}
                  >
                    RUN HELLO AGENT
                  </button>
                </div>
              </div>
              {hasPendingProviderSupport && (
                <p className={styles.settingsNotice}>
                  SELECTED PROVIDER IS CONFIGURED FOR FUTURE PHASES. CURRENT RUNTIME EXECUTION IS OPENAI ONLY.
                </p>
              )}
              <p className={styles.settingsNotice}>{rigExecutionPolicyNotice}</p>
              {agentSecretWarning && <p className={styles.settingsNotice}>{agentSecretWarning}</p>}
              <p className={styles.settingsNotice}>{rigAgentRolloutNotice}</p>
              {agentSecretStatusError && <p className={styles.settingsErrorText}>{agentSecretStatusError}</p>}
              {agentSecretResolutionOrder.length > 0 && (
                <p className={styles.settingsRowHint}>
                  {`RESOLUTION ORDER :: ${agentSecretResolutionOrder.join(" -> ").toUpperCase()}`}
                </p>
              )}
              {agentHelloOutput && <p className={styles.settingsNotice}>{agentHelloOutput}</p>}
              {agentHelloError && <p className={styles.settingsErrorText}>{agentHelloError}</p>}
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
                  <span>Database Size</span>
                  <span className={styles.settingsRowHint}>
                    Main SQLite file footprint
                  </span>
                </div>
                <span className={styles.settingsRowValue}>{runtimeDbSizeText}</span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>WAL Size</span>
                  <span className={styles.settingsRowHint}>
                    Write-ahead log file footprint
                  </span>
                </div>
                <span className={styles.settingsRowValue}>{runtimeWalSizeText}</span>
              </div>
              <div className={styles.settingsRow}>
                <div className={styles.settingsRowLabel}>
                  <span>Local Footprint</span>
                  <span className={styles.settingsRowHint}>
                    Database + WAL combined
                  </span>
                </div>
                <span className={styles.settingsRowValue}>{runtimeTotalFootprintText}</span>
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

            <AgentAuditPanel />

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
