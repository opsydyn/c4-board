/**
 * Workspace layout state — ADR-011.
 *
 * These were four `useState` booleans in PosteeWorkspace. CLAUDE.md rejects that
 * for good reason: `isResponsePanelOpen && activeTab === "LoadTest"` is a state
 * described as flags, which admits combinations that should not exist and leaves
 * the rules connecting them scattered through click handlers.
 *
 * As parallel regions each concern is independent — history knows nothing about
 * which response tab is showing — while genuine couplings become transitions.
 * "Selecting the load chamber also opens the response pane" is declared here rather
 * than remembered by every caller.
 *
 * The sidebar is deliberately absent: it is already a state in the workspace
 * machine, and a second home for it would be two sources of truth for one thing.
 */

import { clampPaneRatio, DEFAULT_PANE_RATIO } from "@/core/effects/postee/workspace-panes";
import { assign, setup } from "xstate";

export type ResponseTab = "execution" | "loadTest";

export interface PosteeUiContext {
  /** Share of the split given to the request pane. Always clamped. */
  readonly paneRatio: number;
}

export type PosteeUiEvent =
  | { type: "TOGGLE_RESPONSE" }
  | { type: "SELECT_RESPONSE_TAB"; tab: ResponseTab }
  | { type: "OPEN_HISTORY" }
  | { type: "CLOSE_HISTORY" }
  | { type: "SET_PANE_RATIO"; ratio: number };

export const posteeUiMachine = setup({
  types: {} as {
    context: PosteeUiContext;
    events: PosteeUiEvent;
    input: { paneRatio?: number };
  },
  guards: {
    selectingLoadTest: ({ event }) => event.type === "SELECT_RESPONSE_TAB" && event.tab === "loadTest",
    selectingExecution: ({ event }) => event.type === "SELECT_RESPONSE_TAB" && event.tab === "execution",
  },
}).createMachine({
  id: "posteeUi",
  type: "parallel",
  context: ({ input }) => ({ paneRatio: clampPaneRatio(input.paneRatio ?? DEFAULT_PANE_RATIO) }),
  states: {
    responsePane: {
      initial: "open",
      states: {
        open: { on: { TOGGLE_RESPONSE: "closed" } },
        closed: {
          on: {
            TOGGLE_RESPONSE: "open",
            // Choosing something to look at implies wanting to see it.
            SELECT_RESPONSE_TAB: "open",
          },
        },
      },
    },
    responseTab: {
      initial: "execution",
      states: {
        execution: { on: { SELECT_RESPONSE_TAB: { target: "loadTest", guard: "selectingLoadTest" } } },
        loadTest: { on: { SELECT_RESPONSE_TAB: { target: "execution", guard: "selectingExecution" } } },
      },
    },
    historyDrawer: {
      initial: "closed",
      states: {
        // History overlays, so it never has to negotiate with the response pane.
        closed: { on: { OPEN_HISTORY: "open" } },
        open: { on: { CLOSE_HISTORY: "closed" } },
      },
    },
  },
  on: {
    SET_PANE_RATIO: {
      actions: assign({ paneRatio: ({ event }) => clampPaneRatio(event.ratio) }),
    },
  },
});
