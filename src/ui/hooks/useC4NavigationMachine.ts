import { useMachine } from "@xstate/react";
import { type MouseEvent, useCallback, useMemo, useRef } from "react";
import { createC4NavigationMachine } from "../machines/c4-navigation.machine";

interface UseC4NavigationMachineInput {
  saveOnNavigate: boolean;
  flushPendingInlineEdits: () => Promise<void>;
  requestManualSave: () => Promise<boolean>;
  navigateTo?: (href: string) => void;
  beforeNavigate?: (didSave: boolean) => void;
}

interface UseC4NavigationMachineResult {
  navigationTarget: string | null;
  pageHideSaveCompleted: boolean;
  navigateWithSave: (href: string) => void;
  handleNavigateWithSave: (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) => void;
}

const navigateWithWindowLocation = (href: string): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.location.assign(href);
};

export const useC4NavigationMachine = (
  input: UseC4NavigationMachineInput,
): UseC4NavigationMachineResult => {
  const {
    saveOnNavigate,
    flushPendingInlineEdits,
    requestManualSave,
    navigateTo,
    beforeNavigate,
  } = input;

  const flushPendingInlineEditsRef = useRef(flushPendingInlineEdits);
  const requestManualSaveRef = useRef(requestManualSave);
  const navigateToRef = useRef(navigateTo ?? navigateWithWindowLocation);
  const beforeNavigateRef = useRef(beforeNavigate);

  flushPendingInlineEditsRef.current = flushPendingInlineEdits;
  requestManualSaveRef.current = requestManualSave;
  navigateToRef.current = navigateTo ?? navigateWithWindowLocation;
  beforeNavigateRef.current = beforeNavigate;

  const flushPendingInlineEditsStable = useCallback(
    () => flushPendingInlineEditsRef.current(),
    [],
  );
  const requestManualSaveStable = useCallback(
    () => requestManualSaveRef.current(),
    [],
  );
  const navigateToStable = useCallback(
    (href: string) => navigateToRef.current(href),
    [],
  );
  const beforeNavigateStable = useCallback(
    (didSave: boolean) => beforeNavigateRef.current?.(didSave),
    [],
  );

  const navigationMachine = useMemo(
    () =>
      createC4NavigationMachine({
        flushPendingInlineEdits: flushPendingInlineEditsStable,
        requestManualSave: requestManualSaveStable,
        navigateTo: navigateToStable,
        beforeNavigate: beforeNavigateStable,
      }),
    [
      beforeNavigateStable,
      flushPendingInlineEditsStable,
      navigateToStable,
      requestManualSaveStable,
    ],
  );

  const [navigationSnapshot, navigationSend] = useMachine(navigationMachine);

  const navigateWithSave = useCallback(
    (href: string) => {
      if (navigationSnapshot.matches("navigating")) {
        return;
      }

      navigationSend({
        type: "NAVIGATE",
        href,
        saveOnNavigate,
      });
    },
    [navigationSend, navigationSnapshot, saveOnNavigate],
  );

  const handleNavigateWithSave = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, href: string) => {
      event.preventDefault();
      navigateWithSave(href);
    },
    [navigateWithSave],
  );

  return {
    navigationTarget: navigationSnapshot.context.targetHref,
    pageHideSaveCompleted: navigationSnapshot.context.lastSaveCompleted,
    navigateWithSave,
    handleNavigateWithSave,
  };
};
