import { posteeUiMachine } from "@/ui/machines/postee-ui.machine";
import { describe, expect, it } from "vitest";
import { createActor } from "xstate";

/**
 * ADR-011 Phase 5. The workspace's layout was four `useState` booleans, which is
 * the pattern CLAUDE.md rejects: `isResponsePanelOpen && activeTab === "LoadTest"`
 * describes a state, and describing states with flags admits combinations that
 * should not exist and hides the rules connecting them.
 *
 * As parallel states, "opening the load chamber also opens the response pane" is a
 * transition rather than a line of imperative glue in a click handler.
 */

const start = (input?: { paneRatio?: number }) => {
  const actor = createActor(posteeUiMachine, { input: input ?? {} });
  actor.start();
  return actor;
};

describe("posteeUiMachine", () => {
  it("opens with the response visible, showing execution", () => {
    const actor = start();
    const state = actor.getSnapshot();

    expect(state.matches({ responsePane: "open" })).toBe(true);
    expect(state.matches({ responseTab: "execution" })).toBe(true);
    expect(state.matches({ historyDrawer: "closed" })).toBe(true);
    actor.stop();
  });

  it("opens the response pane when the load chamber is selected", () => {
    const actor = start();
    actor.send({ type: "TOGGLE_RESPONSE" });
    expect(actor.getSnapshot().matches({ responsePane: "closed" })).toBe(true);

    actor.send({ type: "SELECT_RESPONSE_TAB", tab: "loadTest" });

    // Selecting a tab in a closed pane used to require the click handler to
    // remember to reopen it; here it is the transition.
    expect(actor.getSnapshot().matches({ responsePane: "open" })).toBe(true);
    expect(actor.getSnapshot().matches({ responseTab: "loadTest" })).toBe(true);
    actor.stop();
  });

  it("returns to execution when the load chamber is deselected", () => {
    const actor = start();
    actor.send({ type: "SELECT_RESPONSE_TAB", tab: "loadTest" });
    actor.send({ type: "SELECT_RESPONSE_TAB", tab: "execution" });

    expect(actor.getSnapshot().matches({ responseTab: "execution" })).toBe(true);
    actor.stop();
  });

  it("opens and closes history without disturbing the response pane", () => {
    const actor = start();

    actor.send({ type: "OPEN_HISTORY" });
    expect(actor.getSnapshot().matches({ historyDrawer: "open" })).toBe(true);
    // The old arrangement showed history *instead of* the response.
    expect(actor.getSnapshot().matches({ responsePane: "open" })).toBe(true);
    expect(actor.getSnapshot().matches({ responseTab: "execution" })).toBe(true);

    actor.send({ type: "CLOSE_HISTORY" });
    expect(actor.getSnapshot().matches({ historyDrawer: "closed" })).toBe(true);
    actor.stop();
  });

  it("opens the agent without disturbing history or the response", () => {
    const actor = start();
    actor.send({ type: "OPEN_HISTORY" });

    actor.send({ type: "OPEN_AGENT" });

    // Three overlapping surfaces, none of which negotiates with the others.
    expect(actor.getSnapshot().matches({ agentDrawer: "open" })).toBe(true);
    expect(actor.getSnapshot().matches({ historyDrawer: "open" })).toBe(true);
    expect(actor.getSnapshot().matches({ responsePane: "open" })).toBe(true);

    actor.send({ type: "CLOSE_AGENT" });
    expect(actor.getSnapshot().matches({ agentDrawer: "closed" })).toBe(true);
    actor.stop();
  });

  it("carries the pane ratio and clamps whatever it is given", () => {
    const actor = start({ paneRatio: 0.62 });
    expect(actor.getSnapshot().context.paneRatio).toBeCloseTo(0.62);

    actor.send({ type: "SET_PANE_RATIO", ratio: 0.99 });
    expect(actor.getSnapshot().context.paneRatio).toBeLessThan(0.9);

    actor.send({ type: "SET_PANE_RATIO", ratio: Number.NaN });
    expect(Number.isFinite(actor.getSnapshot().context.paneRatio)).toBe(true);
    actor.stop();
  });

  it("clamps a restored ratio that would collapse a pane", () => {
    expect(start({ paneRatio: 0.01 }).getSnapshot().context.paneRatio).toBeGreaterThan(0.1);
  });
});
