import type { PosteeRequestProposal } from "@/core/effects/postee/agent-proposal";
import { PosteeAgentDrawer } from "@/ui/components/postee/PosteeAgentDrawer";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * ADR-012 Phase 5. The surface that makes the agent reachable.
 *
 * The behaviour that matters is not the chat — it is that a proposal is presented
 * for review and only becomes a draft when the operator says so, and that the
 * consent controlling data egress is visible rather than buried.
 */

const proposal: PosteeRequestProposal = {
  summary: "Fetch systems from the GraphQL API",
  rationale: "The cached schema exposes a systems root field",
  warnings: ["Assumed a page size of 20"],
  name: "Fetch systems",
  method: "POST",
  url: "https://api.example.test/graphql",
  headers: [{ key: "Authorization", value: "Bearer {{API_TOKEN}}" }],
  bodyMode: "graphql",
  body: null,
  graphqlDocument: "query Systems { systems { id } }",
  graphqlVariablesJson: "{}",
  graphqlOperationName: "Systems",
};

const setup = (over: Partial<React.ComponentProps<typeof PosteeAgentDrawer>> = {}) => {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    onPropose: vi.fn().mockResolvedValue(proposal),
    onAcceptProposal: vi.fn(),
    ...over,
  };
  render(<PosteeAgentDrawer {...props} />);
  return props;
};

describe("PosteeAgentDrawer", () => {
  it("asks what the operator wants before doing anything", () => {
    setup();

    expect(screen.getByRole("dialog", { name: /opy/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/describe the request/i)).toBeInTheDocument();
  });

  it("will not propose from an empty description", async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.click(screen.getByRole("button", { name: /propose/i }));

    expect(props.onPropose).not.toHaveBeenCalled();
  });

  it("shows the proposal for review rather than applying it", async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.type(screen.getByLabelText(/describe the request/i), "fetch all systems");
    await user.click(screen.getByRole("button", { name: /propose/i }));

    expect(await screen.findByText(/Fetch systems from the GraphQL API/)).toBeInTheDocument();
    expect(screen.getByText("POST")).toBeInTheDocument();
    expect(screen.getByText("https://api.example.test/graphql")).toBeInTheDocument();
    // Nothing is applied until the operator asks.
    expect(props.onAcceptProposal).not.toHaveBeenCalled();
  });

  it("surfaces the warnings the model recorded", async () => {
    const user = userEvent.setup();
    setup();

    await user.type(screen.getByLabelText(/describe the request/i), "fetch all systems");
    await user.click(screen.getByRole("button", { name: /propose/i }));

    expect(await screen.findByText(/Assumed a page size of 20/)).toBeInTheDocument();
  });

  it("hands the proposal over only when the operator accepts it", async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.type(screen.getByLabelText(/describe the request/i), "fetch all systems");
    await user.click(screen.getByRole("button", { name: /propose/i }));
    await user.click(await screen.findByRole("button", { name: /open as draft/i }));

    expect(props.onAcceptProposal).toHaveBeenCalledWith(proposal);
  });

  it("keeps response-body consent off by default and visible", async () => {
    const user = userEvent.setup();
    const props = setup();

    const consent = screen.getByRole("checkbox", { name: /response bodies/i });
    expect(consent).not.toBeChecked();

    await user.type(screen.getByLabelText(/describe the request/i), "why did this fail");
    await user.click(screen.getByRole("button", { name: /propose/i }));

    await waitFor(() => expect(props.onPropose).toHaveBeenCalled());
    expect(props.onPropose).toHaveBeenCalledWith(
      expect.objectContaining({ description: "why did this fail", includeBodies: false }),
    );
  });

  it("passes consent through when the operator grants it", async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.click(screen.getByRole("checkbox", { name: /response bodies/i }));
    await user.type(screen.getByLabelText(/describe the request/i), "why did this fail");
    await user.click(screen.getByRole("button", { name: /propose/i }));

    await waitFor(() =>
      expect(props.onPropose).toHaveBeenCalledWith(expect.objectContaining({ includeBodies: true }))
    );
  });

  it("reports a failure instead of leaving the operator waiting", async () => {
    const user = userEvent.setup();
    setup({ onPropose: vi.fn().mockRejectedValue(new Error("No OpenAI key configured")) });

    await user.type(screen.getByLabelText(/describe the request/i), "fetch all systems");
    await user.click(screen.getByRole("button", { name: /propose/i }));

    expect(await screen.findByText(/No OpenAI key configured/)).toBeInTheDocument();
  });

  it("renders nothing while closed", () => {
    setup({ isOpen: false });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
