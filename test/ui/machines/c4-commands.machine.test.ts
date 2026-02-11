import { type C4Command, createC4CommandsMachine } from "@/ui/machines/c4-commands.machine";
import { describe, expect, it, vi } from "vitest";
import { createActor, waitFor } from "xstate";

describe("c4-commands.machine", () => {
  it("dispatches mapped query actions and clears query state", async () => {
    const runCommand = vi.fn();
    const clearQueryAction = vi.fn();

    const actor = createActor(
      createC4CommandsMachine({
        runCommand,
        getQueryAction: () => "new-board",
        clearQueryAction,
      }),
    );
    actor.start();

    await waitFor(
      actor,
      (snapshot) => snapshot.context.lastCommand === "new-board",
    );

    expect(runCommand).toHaveBeenCalledWith("new-board");
    expect(clearQueryAction).toHaveBeenCalledTimes(1);
  });

  it("executes explicit command events", async () => {
    const runCommand = vi.fn();
    const actor = createActor(createC4CommandsMachine({ runCommand }));
    actor.start();

    actor.send({
      type: "EXECUTE",
      command: "save",
    });

    await waitFor(actor, (snapshot) => snapshot.context.lastCommand === "save");
    expect(runCommand).toHaveBeenCalledWith("save");
  });

  it("records unknown query actions", async () => {
    const runCommand = vi.fn();
    const clearQueryAction = vi.fn();
    const actor = createActor(
      createC4CommandsMachine({
        runCommand,
        getQueryAction: () => "bogus-command",
        clearQueryAction,
      }),
    );
    actor.start();

    await waitFor(
      actor,
      (snapshot) => snapshot.context.errorMessage === "unknown query action: bogus-command",
    );

    expect(runCommand).toHaveBeenCalledTimes(0);
    expect(clearQueryAction).toHaveBeenCalledTimes(1);
  });

  it("records registration errors from bindings", async () => {
    const runCommand = vi.fn();
    const actor = createActor(
      createC4CommandsMachine({
        runCommand,
        registerKeyboardBindings: () => {
          throw new Error("keyboard unavailable");
        },
        registerMenuBindings: async () => {
          throw new Error("menu unavailable");
        },
      }),
    );
    actor.start();

    await waitFor(
      actor,
      (snapshot) => snapshot.context.errorMessage?.includes("failed") === true,
    );

    expect(runCommand).toHaveBeenCalledTimes(0);
  });

  it("forwards commands emitted by binding registrations", async () => {
    const observedCommands: C4Command[] = [];
    const runCommand = vi.fn((command: C4Command) => {
      observedCommands.push(command);
    });

    const actor = createActor(
      createC4CommandsMachine({
        runCommand,
        registerKeyboardBindings: (onCommand) => {
          onCommand("auto-layout");
        },
        registerMenuBindings: (onCommand) => {
          onCommand("add-person");
        },
      }),
    );
    actor.start();

    await waitFor(actor, () => observedCommands.length >= 2);
    expect(observedCommands).toEqual(["auto-layout", "add-person"]);
  });
});
