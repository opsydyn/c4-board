import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useMachine } from "@xstate/react";
import { useCallback, useMemo, useRef } from "react";
import { type C4Command, createC4CommandsMachine } from "../machines/c4-commands.machine";

interface UseC4CommandsMachineInput {
  onSave: () => void | Promise<void>;
  onNewBoard: () => void | Promise<void>;
  onAddPerson: () => void;
  onAddSystem: () => void;
  onAddExternal: () => void;
  onAddContainer: () => void;
  onAddComponent: () => void;
  onAutoLayout: () => void;
  onAutoLayoutSelected: () => void;
}

const readQueryAction = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  return new URLSearchParams(window.location.search).get("action");
};

const clearQueryAction = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.history.replaceState({}, "", "/");
};

export const useC4CommandsMachine = (
  input: UseC4CommandsMachineInput,
): void => {
  const handlersRef = useRef(input);
  handlersRef.current = input;

  const runCommand = useCallback(
    (command: C4Command) => {
      const {
        onSave,
        onNewBoard,
        onAddPerson,
        onAddSystem,
        onAddExternal,
        onAddContainer,
        onAddComponent,
        onAutoLayout,
        onAutoLayoutSelected,
      } = handlersRef.current;

      switch (command) {
        case "save":
          return onSave();
        case "new-board":
          return onNewBoard();
        case "add-person":
          onAddPerson();
          return;
        case "add-system":
          onAddSystem();
          return;
        case "add-external":
          onAddExternal();
          return;
        case "add-container":
          onAddContainer();
          return;
        case "add-component":
          onAddComponent();
          return;
        case "auto-layout":
          onAutoLayout();
          return;
        case "auto-layout-selected":
          onAutoLayoutSelected();
          return;
      }
    },
    [],
  );

  const registerKeyboardBindings = useCallback(
    (onCommand: (command: C4Command) => void) => {
      if (typeof window === "undefined") {
        return;
      }

      const handleKeyDown = (event: KeyboardEvent) => {
        if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "l") {
          event.preventDefault();
          onCommand("auto-layout-selected");
          return;
        }

        if ((event.metaKey || event.ctrlKey) && event.key === "l") {
          event.preventDefault();
          onCommand("auto-layout");
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    },
    [],
  );

  const registerMenuBindings = useCallback(
    async (onCommand: (command: C4Command) => void) => {
      if (typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window)) {
        return;
      }

      const windowHandle = getCurrentWindow();
      const unlistenFns: UnlistenFn[] = [];
      let disposed = false;

      const register = async (
        channel: string,
        command: C4Command,
      ): Promise<void> => {
        const unlisten = await windowHandle.listen(channel, () => {
          if (disposed) {
            return;
          }
          onCommand(command);
        });
        unlistenFns.push(unlisten);
      };

      await register("menu:save", "save");
      await register("menu:new-board", "new-board");
      await register("menu:add-person", "add-person");
      await register("menu:add-system", "add-system");
      await register("menu:add-external", "add-external");
      await register("menu:add-container", "add-container");
      await register("menu:add-component", "add-component");

      console.log("🎨 Canvas menu event listeners attached");

      return () => {
        disposed = true;
        unlistenFns.forEach((unlisten) => unlisten());
        console.log("🎨 Canvas menu event listeners removed");
      };
    },
    [],
  );

  const commandsMachine = useMemo(
    () =>
      createC4CommandsMachine({
        runCommand,
        registerKeyboardBindings,
        registerMenuBindings,
        getQueryAction: readQueryAction,
        clearQueryAction,
      }),
    [registerKeyboardBindings, registerMenuBindings, runCommand],
  );

  useMachine(commandsMachine);
};
