import { useMachine } from "@xstate/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  type C4PanelPreferencePatch,
  type C4PanelPreferences,
  type C4PanelPreferencesEmittedEvent,
  createC4PanelPreferencesMachine,
} from "../machines/c4-panel-preferences.machine";

interface UseC4PanelPreferencesMachineInput {
  isSettingsLoading: boolean;
  settings: C4PanelPreferences;
  persistPatch: (patch: C4PanelPreferencePatch) => Promise<void>;
  onPersistFailure?: (
    event: Extract<C4PanelPreferencesEmittedEvent, { type: "panelPreferencePersistFailed" }>,
  ) => void;
}

interface UseC4PanelPreferencesMachineResult extends C4PanelPreferences {
  errorMessage: string | null;
  toggleAzurePanel: () => void;
  toggleOwnershipLens: () => void;
  toggleCouplingExplainability: () => void;
}

export const useC4PanelPreferencesMachine = (
  input: UseC4PanelPreferencesMachineInput,
): UseC4PanelPreferencesMachineResult => {
  const { isSettingsLoading, settings, persistPatch, onPersistFailure } = input;

  const persistPatchRef = useRef(persistPatch);
  persistPatchRef.current = persistPatch;

  const persistPatchStable = useCallback(
    (patch: C4PanelPreferencePatch) => persistPatchRef.current(patch),
    [],
  );

  const panelPreferencesMachine = useMemo(
    () =>
      createC4PanelPreferencesMachine({
        persistPatch: persistPatchStable,
      }),
    [persistPatchStable],
  );

  const [panelPreferencesSnapshot, panelPreferencesSend, panelPreferencesActorRef] = useMachine(
    panelPreferencesMachine,
  );

  useEffect(() => {
    if (isSettingsLoading) {
      return;
    }

    panelPreferencesSend({
      type: "HYDRATE",
      values: {
        azurePanelVisible: settings.azurePanelVisible,
        ownershipLensVisible: settings.ownershipLensVisible,
        couplingExplainabilityVisible: settings.couplingExplainabilityVisible,
      },
    });
  }, [
    isSettingsLoading,
    panelPreferencesSend,
    settings.azurePanelVisible,
    settings.couplingExplainabilityVisible,
    settings.ownershipLensVisible,
  ]);

  useEffect(() => {
    if (!onPersistFailure) {
      return;
    }

    const subscription = panelPreferencesActorRef.on(
      "panelPreferencePersistFailed",
      onPersistFailure,
    );
    return () => {
      subscription.unsubscribe();
    };
  }, [onPersistFailure, panelPreferencesActorRef]);

  const toggleAzurePanel = useCallback(() => {
    panelPreferencesSend({ type: "TOGGLE_AZURE_PANEL" });
  }, [panelPreferencesSend]);

  const toggleOwnershipLens = useCallback(() => {
    panelPreferencesSend({ type: "TOGGLE_OWNERSHIP_LENS" });
  }, [panelPreferencesSend]);

  const toggleCouplingExplainability = useCallback(() => {
    panelPreferencesSend({ type: "TOGGLE_COUPLING_EXPLAINABILITY" });
  }, [panelPreferencesSend]);

  return {
    azurePanelVisible: panelPreferencesSnapshot.context.azurePanelVisible,
    ownershipLensVisible: panelPreferencesSnapshot.context.ownershipLensVisible,
    couplingExplainabilityVisible: panelPreferencesSnapshot.context.couplingExplainabilityVisible,
    errorMessage: panelPreferencesSnapshot.context.errorMessage,
    toggleAzurePanel,
    toggleOwnershipLens,
    toggleCouplingExplainability,
  };
};
