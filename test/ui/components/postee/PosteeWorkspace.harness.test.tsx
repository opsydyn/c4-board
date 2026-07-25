import { DatabaseService } from "@/core/effects/database.base";
import { makeHttpClientTestLayer } from "@/core/effects/postee/http-client";
import { PosteeWorkspace } from "@/ui/components/postee/PosteeWorkspace";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Effect, Layer } from "effect";
import { describe, expect, it, vi } from "vitest";

/**
 * ADR-011 Phase 5. Nothing rendered this component, which is how a Load Test
 * button that could never open reached a user: both of its gates keyed off a
 * saved request, and the workspace opens on a scratch.
 *
 * These are deliberately about reachability rather than appearance — jsdom has no
 * layout engine, so the useful question is "can the user get to it", not "where is
 * it on screen".
 */

vi.mock("@monaco-editor/react", () => ({
  default: ({ value }: { value?: string }) => <textarea aria-label="Editor" readOnly value={value ?? ""} />,
  DiffEditor: () => <div />,
  loader: { config: vi.fn() },
}));

vi.mock("@/core/effects/useAppSettings", async () => {
  // The real defaults, so the workspace behaves as it does for a fresh install.
  const { DEFAULT_APP_SETTINGS } = await import("@/core/effects/settings.types");
  return {
    useAppSettings: () => ({
      settings: DEFAULT_APP_SETTINGS,
      isLoading: false,
      error: null,
      reload: vi.fn(),
    }),
  };
});

const layer = Layer.merge(
  Layer.succeed(DatabaseService, {
    // An empty workspace: no collections, no saved requests — exactly the state
    // the load test gates could not cope with.
    query: <T,>() => Effect.succeed([] as T[]),
    execute: () => Effect.void,
    transaction: <A, E, R>(effect: Effect.Effect<A, E, R>) => effect,
  }),
  makeHttpClientTestLayer(() => Effect.die("Unexpected HTTP request")),
);

const renderWorkspace = async () => {
  const view = render(<PosteeWorkspace layer={layer} />);
  // The workspace opens on a scratch once the machine settles.
  await waitFor(() => expect(screen.getByLabelText("Request URL")).toBeInTheDocument());
  return view;
};

describe("PosteeWorkspace", () => {
  it("opens on a usable request without any collections", async () => {
    await renderWorkspace();

    expect(screen.getByText("No collections")).toBeInTheDocument();
    expect(screen.getByLabelText("Request URL")).not.toBeDisabled();
  });

  it("offers the load test panel for a scratch request", async () => {
    await renderWorkspace();

    // The regression: this was disabled because no *saved* request was selected.
    expect(screen.getByRole("button", { name: "Open load test panel" })).not.toBeDisabled();
  });

  it("shows the load chamber once load test is selected", async () => {
    const user = userEvent.setup();
    await renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Open load test panel" }));

    expect(await screen.findByText(/Load Chamber/i)).toBeInTheDocument();
  });

  it("opens execution history as a drawer and closes it again", async () => {
    const user = userEvent.setup();
    await renderWorkspace();

    expect(screen.queryByRole("dialog", { name: "Execution History" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open history panel" }));
    const drawer = await screen.findByRole("dialog", { name: "Execution History" });
    expect(drawer).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /close execution history/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Execution History" })).not.toBeInTheDocument();
    });
  });

  it("keeps the request visible while history is open", async () => {
    const user = userEvent.setup();
    await renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Open history panel" }));
    await screen.findByRole("dialog", { name: "Execution History" });

    // History overlays rather than replacing the response, which is what the old
    // third-tab arrangement did.
    expect(screen.getByLabelText("Request URL")).toBeInTheDocument();
  });

  it("makes the OPY request author reachable from the brand controls", async () => {
    const user = userEvent.setup();
    await renderWorkspace();

    expect(screen.queryByRole("dialog", { name: /opy/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show opy net assistant/i }));

    const drawer = await screen.findByRole("dialog", { name: /opy/i });
    expect(drawer).toBeInTheDocument();
    expect(screen.getByLabelText(/describe the request/i)).toBeInTheDocument();
    // Egress consent is visible at the point of use, not buried in settings.
    expect(screen.getByRole("checkbox", { name: /response bodies/i })).not.toBeChecked();
  });

  it("keeps the request visible while the agent drawer is open", async () => {
    const user = userEvent.setup();
    await renderWorkspace();

    await user.click(screen.getByRole("button", { name: /show opy net assistant/i }));
    await screen.findByRole("dialog", { name: /opy/i });

    expect(screen.getByLabelText("Request URL")).toBeInTheDocument();
  });

  it("exposes the pane divider as a keyboard-operable separator", async () => {
    await renderWorkspace();

    const divider = screen.getByRole("separator", { name: /resize request and response/i });
    expect(divider).toHaveAttribute("aria-valuenow", "50");
    expect(divider).toHaveAttribute("tabindex", "0");
  });
});
