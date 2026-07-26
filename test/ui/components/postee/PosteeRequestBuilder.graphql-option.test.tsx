import type { PosteeScratchDraft } from "@/core/effects/postee";
import { PosteeRequestBuilder, type PosteeRequestBuilderProps } from "@/ui/components/postee/PosteeRequestBuilder";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange }: { value: string; onChange?: (v: string | undefined) => void }) => (
    <textarea
      aria-label="Editor"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
  DiffEditor: () => <div />,
  loader: { config: vi.fn() },
}));

/**
 * "I can't see the GraphQL option" — this pins down whether the body-mode
 * dropdown actually offers it, for a scratch draft and for a saved request.
 */

const scratchDraft: PosteeScratchDraft = {
  id: "scratch-1",
  name: "Untitled request",
  method: "GET",
  url: "",
  description: null,
  headers: [],
  body: { mode: "json", raw: "{}", form_values: null },
  graphql: null,
  environmentId: null,
  tabOrder: 0,
  isOpen: true,
  createdAt: 1,
  updatedAt: 1,
};

const props = (overrides: Partial<PosteeRequestBuilderProps> = {}): PosteeRequestBuilderProps => ({
  activeCollectionId: null,
  selectedRequest: null,
  selectedRequestDraft: null,
  requestDraftSave: { status: "idle", requestId: null, revision: 0, error: null } as never,
  graphqlSchemaState: { status: "NoSchema", snapshot: null, error: null },
  isInitialising: false,
  isRunning: false,
  canRunRequest: true,
  environments: [],
  currentEnvironmentId: "",
  currentVariables: [],
  onCreateRequest: vi.fn(),
  onSaveRequestDraft: vi.fn(),
  onRunRequest: vi.fn(),
  onCancelRequest: vi.fn(),
  onCreateEnvironment: vi.fn(),
  onEnvironmentChange: vi.fn(),
  onVariablesChange: vi.fn(),
  onRefreshGraphqlSchema: vi.fn(),
  activeScratchDraft: scratchDraft,
  onScratchDraftChange: vi.fn(),
  onSaveScratch: vi.fn(),
  ...overrides,
});

describe("GraphQL body mode availability", () => {
  it("offers graphql in the body mode dropdown for a scratch request", async () => {
    const user = userEvent.setup();
    render(<PosteeRequestBuilder {...props()} />);

    const selector = screen.getByLabelText("Request body mode");
    expect(selector).not.toBeDisabled();

    await user.click(selector);

    expect(screen.getByRole("option", { name: /graphql/i })).toBeInTheDocument();
  });

  it("switches the editor to GraphQL when that mode is chosen", async () => {
    const user = userEvent.setup();
    const onScratchDraftChange = vi.fn();
    render(<PosteeRequestBuilder {...props({ onScratchDraftChange })} />);

    await user.click(screen.getByLabelText("Request body mode"));
    await user.click(screen.getByRole("option", { name: /graphql/i }));

    expect(onScratchDraftChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ mode: "graphql" }) }),
    );
  });
});
