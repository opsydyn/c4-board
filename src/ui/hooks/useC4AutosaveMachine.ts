import { useMachine } from "@xstate/react";
import type { Edge, Node } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { type C4AutosaveMachineEvent, createC4AutosaveMachine } from "../machines/c4-autosave.machine";

const DEFAULT_AUTO_SAVE_DELAY_MS = 1_500;
const MIN_AUTO_SAVE_DELAY_MS = 250;

interface UseC4AutosaveMachineInput {
  isSettingsLoading: boolean;
  autosaveEnabled: boolean;
  autosaveIntervalMs: number;
  currentDiagramId: string | null;
  diagramName: string;
  diagramDescription: string;
  nodes: Node[];
  edges: Edge[];
  requestAutoSave: () => Promise<boolean>;
}

interface UseC4AutosaveMachineResult {
  cancelAutosave: () => void;
}

export const useC4AutosaveMachine = (
  input: UseC4AutosaveMachineInput,
): UseC4AutosaveMachineResult => {
  const {
    isSettingsLoading,
    autosaveEnabled,
    autosaveIntervalMs,
    currentDiagramId,
    diagramName,
    diagramDescription,
    nodes,
    edges,
    requestAutoSave,
  } = input;

  const requestAutoSaveRef = useRef(requestAutoSave);
  requestAutoSaveRef.current = requestAutoSave;

  const requestAutoSaveStable = useCallback(
    () => requestAutoSaveRef.current(),
    [],
  );

  const autosaveMachine = useMemo(
    () =>
      createC4AutosaveMachine({
        requestAutoSave: requestAutoSaveStable,
      }),
    [requestAutoSaveStable],
  );

  const [, autosaveSend] = useMachine(autosaveMachine);
  const autosaveSendRef = useRef(autosaveSend);
  autosaveSendRef.current = autosaveSend;

  const dispatchAutosave = useCallback((event: C4AutosaveMachineEvent) => {
    autosaveSendRef.current(event);
  }, []);

  const debounceMs = useMemo(
    () =>
      Math.max(
        MIN_AUTO_SAVE_DELAY_MS,
        Number.isFinite(autosaveIntervalMs)
          ? autosaveIntervalMs
          : DEFAULT_AUTO_SAVE_DELAY_MS,
      ),
    [autosaveIntervalMs],
  );

  useEffect(() => {
    dispatchAutosave({
      type: "CONFIGURE",
      enabled: !isSettingsLoading && autosaveEnabled,
      diagramId: currentDiagramId,
      debounceMs,
    });
  }, [
    autosaveEnabled,
    currentDiagramId,
    debounceMs,
    dispatchAutosave,
    isSettingsLoading,
  ]);

  useEffect(() => {
    if (isSettingsLoading || !autosaveEnabled || !currentDiagramId) {
      return;
    }

    dispatchAutosave({ type: "MARK_DIRTY" });
  }, [
    autosaveEnabled,
    currentDiagramId,
    dispatchAutosave,
    diagramDescription,
    diagramName,
    edges,
    isSettingsLoading,
    nodes,
  ]);

  const cancelAutosave = useCallback(() => {
    dispatchAutosave({ type: "CANCEL_PENDING" });
  }, [dispatchAutosave]);

  return {
    cancelAutosave,
  };
};
