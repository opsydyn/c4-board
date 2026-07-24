import type { PosteeRequestDraft } from "@/core/effects/postee";
import { RequestId } from "@/core/effects/postee/types";
import { HeadersEditor } from "@/ui/components/postee/HeadersEditor";
import {
  deriveRequestEditorPresentation,
  PosteeRequestBuilder,
  type PosteeRequestBuilderProps,
} from "@/ui/components/postee/PosteeRequestBuilder";
import { PosteeWorkspace } from "@/ui/components/postee/PosteeWorkspace";
import type { RequestDraftSaveState } from "@/ui/machines/postee.machine";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { useMachineMock } = vi.hoisted(() => ({
  useMachineMock: vi.fn(),
}));

vi.mock("@xstate/react", () => ({
  useMachine: useMachineMock,
}));

vi.mock("@/core/effects/useAppSettings", () => ({
  useAppSettings: () => ({
    settings: {
      animationsEnabled: false,
      masterAudioEnabled: false,
      masterVolume: 0,
      sirenEnabledDefault: false,
    },
  }),
}));

vi.mock("@/ui/components/postee/PosteeResponsePanel", () => ({
  PosteeResponsePanel: () => null,
}));

vi.mock("@/ui/components/postee/PosteeSidebar", () => ({
  PosteeSidebar: () => null,
}));

vi.mock("@/ui/components/postee/MonacoJsonEditor", () => ({
  MonacoJsonEditor: ({
    value,
    onChange,
    readOnly,
  }: {
    value: string;
    onChange: (value: string) => void;
    readOnly?: boolean;
  }) => (
    <textarea
      aria-label="Request body"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      readOnly={readOnly}
    />
  ),
}));

const firstDraft: PosteeRequestDraft = {
  request: {
    id: "request-1",
    collection_id: "collection-1",
    name: "First request",
    method: "POST",
    url: "https://example.com/first",
    description: null,
    favorite: 0,
    sort_order: 0,
    created_at: 1,
    updated_at: 1,
  },
  headers: [
    {
      id: "header-1",
      key: "Accept",
      value: "application/json",
      enabled: true,
    },
  ],
  body: {
    request_id: "request-1",
    mode: "raw",
    raw: "{\"saved\":true}",
    form_values: null,
  },
  graphql: null,
};

const secondDraft: PosteeRequestDraft = {
  request: {
    id: "request-2",
    collection_id: "collection-1",
    name: "Second request",
    method: "PATCH",
    url: "https://example.com/second",
    description: null,
    favorite: 0,
    sort_order: 1,
    created_at: 2,
    updated_at: 2,
  },
  headers: [
    {
      id: "header-2",
      key: "X-Second",
      value: "yes",
      enabled: false,
    },
  ],
  body: {
    request_id: "request-2",
    mode: "form",
    raw: "{\"second\":true}",
    form_values: "{\"field\":\"value\"}",
  },
  graphql: null,
};

const committedFirstDraft: PosteeRequestDraft = {
  request: {
    ...firstDraft.request,
    url: "https://example.com/committed",
    updated_at: 3,
  },
  headers: [
    {
      id: "header-committed",
      key: "Content-Type",
      value: "application/canonical",
      enabled: true,
    },
  ],
  body: {
    request_id: "request-1",
    mode: "form",
    raw: "committed-body",
    form_values: "{\"field\":\"committed\"}",
  },
  graphql: null,
};

const makeQueryDraft = ({
  mode,
  raw,
  headers,
}: {
  readonly mode: PosteeRequestDraft["body"]["mode"];
  readonly raw: string;
  readonly headers: PosteeRequestDraft["headers"];
}): PosteeRequestDraft => ({
  request: {
    ...firstDraft.request,
    id: "request-query",
    name: "QUERY request",
    method: "QUERY",
  },
  headers,
  body: {
    request_id: "request-query",
    mode,
    raw,
    form_values: null,
  },
  graphql: null,
});

const queryJsonDraft = makeQueryDraft({
  mode: "json",
  raw: "{\"query\":\"systems\"}",
  headers: [],
});

const rawQueryDraft = makeQueryDraft({
  mode: "raw",
  raw: "select * from systems",
  headers: [],
});

const idleSave: RequestDraftSaveState = {
  status: "idle",
  requestId: null,
  error: null,
  revision: 0,
};

const createProps = (
  overrides: Partial<PosteeRequestBuilderProps> = {},
): PosteeRequestBuilderProps => ({
  activeCollectionId: "collection-1",
  selectedRequest: firstDraft.request,
  selectedRequestDraft: firstDraft,
  requestDraftSave: idleSave,
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
  ...overrides,
});

const renderBuilder = (
  overrides: Partial<PosteeRequestBuilderProps> = {},
) => {
  let props = createProps(overrides);
  const view = render(<PosteeRequestBuilder {...props} />);

  return {
    ...view,
    get props() {
      return props;
    },
    rerenderWith(next: Partial<PosteeRequestBuilderProps>) {
      props = { ...props, ...next };
      view.rerender(<PosteeRequestBuilder {...props} />);
    },
  };
};

describe("PosteeRequestBuilder durable request details", () => {
  it("derives confirmed presentation and blocks commands before editor synchronisation", () => {
    const switching = deriveRequestEditorPresentation({
      selectedRequest: secondDraft.request,
      selectedRequestDraft: secondDraft,
      hydratedRequestId: "request-1",
      pendingSave: null,
      requestDraftSave: idleSave,
      currentEditVersion: 0,
      local: {
        requestUrl: firstDraft.request.url,
        requestMethod: firstDraft.request.method,
        requestHeaders: firstDraft.headers,
        requestBody: firstDraft.body.raw ?? "",
        requestBodyMode: firstDraft.body.mode,
      },
    });
    expect(switching).toMatchObject({
      synchronized: false,
      requestUrl: secondDraft.request.url,
      requestBody: secondDraft.body.raw,
      requestHeaders: secondDraft.headers,
    });

    const awaitingCanonical = deriveRequestEditorPresentation({
      selectedRequest: committedFirstDraft.request,
      selectedRequestDraft: committedFirstDraft,
      hydratedRequestId: "request-1",
      pendingSave: {
        requestId: "request-1",
        serverRevision: 0,
        editVersion: 1,
      },
      requestDraftSave: {
        status: "success",
        requestId: RequestId("request-1"),
        error: null,
        revision: 1,
      },
      currentEditVersion: 1,
      local: {
        requestUrl: firstDraft.request.url,
        requestMethod: firstDraft.request.method,
        requestHeaders: firstDraft.headers,
        requestBody: firstDraft.body.raw ?? "",
        requestBodyMode: firstDraft.body.mode,
      },
    });
    expect(awaitingCanonical).toMatchObject({
      synchronized: false,
      requestUrl: committedFirstDraft.request.url,
      requestBody: committedFirstDraft.body.raw,
      requestHeaders: committedFirstDraft.headers,
    });
  });

  it("hydrates URL, method, body, and headers from the confirmed draft", async () => {
    const user = userEvent.setup();
    renderBuilder();

    expect(screen.getByLabelText("Request URL")).toHaveValue(firstDraft.request.url);
    expect(screen.getByRole("button", { name: "POST" })).toBeInTheDocument();
    expect(screen.getByLabelText("Request body")).toHaveValue("{\"saved\":true}");

    await user.click(screen.getByRole("tab", { name: "Headers" }));
    expect(screen.getByLabelText("Header name")).toHaveValue("Accept");
    expect(screen.getByLabelText("Header value")).toHaveValue("application/json");
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("offers QUERY in the request method selector", async () => {
    const user = userEvent.setup();
    renderBuilder();

    await user.click(screen.getByRole("button", { name: "POST" }));
    expect(screen.getByRole("option", { name: "QUERY" })).toBeInTheDocument();
  });

  it("allows a saved QUERY JSON draft to send", async () => {
    const user = userEvent.setup();
    const onRunRequest = vi.fn();
    renderBuilder({
      selectedRequest: queryJsonDraft.request,
      selectedRequestDraft: queryJsonDraft,
      onRunRequest,
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(onRunRequest).toHaveBeenCalledOnce();
  });

  it("blocks a whitespace-only QUERY JSON draft before Send", () => {
    const whitespaceQueryDraft = makeQueryDraft({
      mode: "json",
      raw: " \n\t ",
      headers: [],
    });
    renderBuilder({
      selectedRequest: whitespaceQueryDraft.request,
      selectedRequestDraft: whitespaceQueryDraft,
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "QUERY requires request content.",
    );
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("blocks a raw QUERY draft until Content-Type is enabled", () => {
    const rawDraft = makeQueryDraft({
      mode: "raw",
      raw: "select * from systems",
      headers: [],
    });
    renderBuilder({
      selectedRequest: rawDraft.request,
      selectedRequestDraft: rawDraft,
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "QUERY requires a Content-Type for its request content.",
    );
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
  });

  it("blocks the keyboard Send shortcut for an invalid QUERY", () => {
    const onRunRequest = vi.fn();
    renderBuilder({
      selectedRequest: rawQueryDraft.request,
      selectedRequestDraft: rawQueryDraft,
      onRunRequest,
    });

    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true, metaKey: true });
    expect(onRunRequest).not.toHaveBeenCalled();
  });

  it("replaces every request field and body mode when selection changes", async () => {
    const user = userEvent.setup();
    const view = renderBuilder();

    fireEvent.change(screen.getByLabelText("Request body"), {
      target: { value: "{\"local\":true}" },
    });
    view.rerenderWith({
      selectedRequest: secondDraft.request,
      selectedRequestDraft: secondDraft,
    });

    expect(screen.getByLabelText("Request URL")).toHaveValue(secondDraft.request.url);
    expect(screen.getByRole("button", { name: "PATCH" })).toBeInTheDocument();
    expect(screen.getByLabelText("Request body")).toHaveValue("{\"second\":true}");

    await user.click(screen.getByRole("tab", { name: "Headers" }));
    expect(screen.getByLabelText("Header name")).toHaveValue("X-Second");
    expect(screen.getByLabelText("Header value")).toHaveValue("yes");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.queryByDisplayValue("Accept")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Header value"));
    await user.keyboard("!");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(view.props.onSaveRequestDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ mode: "form" }),
      }),
    );
  });

  it.each([
    {
      field: "URL",
      edit: async (user: ReturnType<typeof userEvent.setup>) => {
        await user.clear(screen.getByLabelText("Request URL"));
        await user.type(screen.getByLabelText("Request URL"), "https://example.com/changed");
      },
    },
    {
      field: "method",
      edit: async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(screen.getByRole("button", { name: "POST" }));
        await user.click(screen.getByRole("option", { name: "PUT" }));
      },
    },
    {
      field: "body",
      edit: async (user: ReturnType<typeof userEvent.setup>) => {
        await user.type(screen.getByLabelText("Request body"), " ");
      },
    },
    {
      field: "headers",
      edit: async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(screen.getByRole("tab", { name: "Headers" }));
        await user.type(screen.getByLabelText("Header value"), "; charset=utf-8");
      },
    },
  ])("marks the request dirty when $field changes", async ({ edit }) => {
    const user = userEvent.setup();
    renderBuilder();

    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    await edit(user);

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("submits a complete draft and forces JSON mode after a body edit", async () => {
    const user = userEvent.setup();
    const onSaveRequestDraft = vi.fn();
    renderBuilder({ onSaveRequestDraft });

    await user.clear(screen.getByLabelText("Request URL"));
    await user.type(screen.getByLabelText("Request URL"), "  https://example.com/changed  ");
    fireEvent.change(screen.getByLabelText("Request body"), {
      target: { value: "{\"changed\":true}" },
    });
    await user.click(screen.getByRole("tab", { name: "Headers" }));
    await user.clear(screen.getByLabelText("Header value"));
    await user.type(screen.getByLabelText("Header value"), "text/plain");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSaveRequestDraft).toHaveBeenCalledWith({
      request: {
        ...firstDraft.request,
        method: "POST",
        url: "https://example.com/changed",
      },
      headers: [
        {
          id: "header-1",
          key: "Accept",
          value: "text/plain",
          enabled: true,
        },
      ],
      body: {
        ...firstDraft.body,
        mode: "json",
        raw: "{\"changed\":true}",
      },
      graphql: null,
    });
  });

  it("preserves a persisted non-JSON body mode when only metadata changes", async () => {
    const user = userEvent.setup();
    const onSaveRequestDraft = vi.fn();
    renderBuilder({ onSaveRequestDraft });

    await user.type(screen.getByLabelText("Request URL"), "?saved=true");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSaveRequestDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ mode: "raw" }),
      }),
    );
  });

  it("shows a disabled saving command and keeps Send unavailable for the matching save", async () => {
    const user = userEvent.setup();
    const view = renderBuilder();

    await user.type(screen.getByLabelText("Request body"), " ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    view.rerenderWith({
      requestDraftSave: {
        status: "saving",
        requestId: RequestId("request-1"),
        error: null,
        revision: 0,
      },
    });

    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Send" })).not.toBeInTheDocument();
  });

  it("reconciles the same-request editor to the committed normalized draft", async () => {
    const user = userEvent.setup();
    const onSaveRequestDraft = vi.fn();
    const view = renderBuilder({ onSaveRequestDraft });

    await user.click(screen.getByRole("tab", { name: "Headers" }));
    await user.click(screen.getByRole("button", { name: "Add Header" }));
    expect(screen.getAllByLabelText("Header name")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Save" }));

    view.rerenderWith({
      selectedRequest: committedFirstDraft.request,
      selectedRequestDraft: committedFirstDraft,
      requestDraftSave: {
        status: "success",
        requestId: RequestId("request-1"),
        error: null,
        revision: 1,
      },
    });

    expect(screen.getAllByLabelText("Header name")).toHaveLength(1);
    expect(screen.getByLabelText("Header name")).toHaveValue("Content-Type");
    expect(screen.getByLabelText("Header value")).toHaveValue("application/canonical");

    await user.click(screen.getByRole("tab", { name: "Body" }));
    expect(screen.getByLabelText("Request body")).toHaveValue("committed-body");
    expect(screen.getByLabelText("Request URL")).toHaveValue("https://example.com/committed");

    await user.type(screen.getByLabelText("Request URL"), "?next=true");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveRequestDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({
        headers: committedFirstDraft.headers,
        body: committedFirstDraft.body,
      }),
    );
  });

  it("reconciles committed A after switching A to B to A while A saves", async () => {
    const user = userEvent.setup();
    const view = renderBuilder();

    fireEvent.change(screen.getByLabelText("Request body"), {
      target: { value: "{\"submitted\":true}" },
    });
    await user.click(screen.getByRole("button", { name: "Save" }));
    view.rerenderWith({
      requestDraftSave: {
        status: "saving",
        requestId: RequestId("request-1"),
        error: null,
        revision: 0,
      },
    });

    view.rerenderWith({
      selectedRequest: secondDraft.request,
      selectedRequestDraft: secondDraft,
    });
    view.rerenderWith({
      selectedRequest: firstDraft.request,
      selectedRequestDraft: firstDraft,
    });

    expect(screen.getByLabelText("Request body")).toHaveValue("{\"saved\":true}");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();

    view.rerenderWith({
      selectedRequest: committedFirstDraft.request,
      selectedRequestDraft: committedFirstDraft,
      requestDraftSave: {
        status: "success",
        requestId: RequestId("request-1"),
        error: null,
        revision: 1,
      },
    });

    expect(screen.getByLabelText("Request body")).toHaveValue("committed-body");
    expect(screen.getByLabelText("Request URL")).toHaveValue("https://example.com/committed");
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("does not overwrite newer same-request edits when save confirmation arrives", async () => {
    const user = userEvent.setup();
    const view = renderBuilder();

    await user.type(screen.getByLabelText("Request URL"), "?submitted=true");
    await user.click(screen.getByRole("button", { name: "Save" }));
    view.rerenderWith({
      requestDraftSave: {
        status: "saving",
        requestId: RequestId("request-1"),
        error: null,
        revision: 0,
      },
    });

    fireEvent.change(screen.getByLabelText("Request body"), {
      target: { value: "{\"newer\":true}" },
    });
    view.rerenderWith({
      selectedRequest: committedFirstDraft.request,
      selectedRequestDraft: committedFirstDraft,
      requestDraftSave: {
        status: "success",
        requestId: RequestId("request-1"),
        error: null,
        revision: 1,
      },
    });

    expect(screen.getByLabelText("Request body")).toHaveValue("{\"newer\":true}");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("globally disables another request's Save and Send while a save is active", async () => {
    const user = userEvent.setup();
    const onRunRequest = vi.fn();
    const onSaveRequestDraft = vi.fn();
    renderBuilder({
      selectedRequest: secondDraft.request,
      selectedRequestDraft: secondDraft,
      requestDraftSave: {
        status: "saving",
        requestId: RequestId("request-1"),
        error: null,
        revision: 0,
      },
      onRunRequest,
      onSaveRequestDraft,
    });

    const globalSaveStatus = screen.getByRole("status");
    expect(globalSaveStatus).toHaveAttribute("aria-live", "polite");
    expect(globalSaveStatus).toHaveTextContent(
      "Another request is saving. Save and Send are temporarily unavailable.",
    );

    const sendButton = screen.getByRole("button", { name: "Send" });
    expect(sendButton).toBeDisabled();
    expect(sendButton).toHaveAccessibleDescription(
      "Another request is saving. Send is temporarily unavailable.",
    );
    await user.click(sendButton);
    expect(onRunRequest).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Request URL"), "?dirty=true");
    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();
    expect(saveButton).toHaveAccessibleDescription(
      "Another request is saving. Save is temporarily unavailable.",
    );
    await user.click(saveButton);
    expect(onSaveRequestDraft).not.toHaveBeenCalled();
  });

  it("blocks save and send keyboard shortcuts while any request save is active", async () => {
    const user = userEvent.setup();
    const onRunRequest = vi.fn();
    const onSaveRequestDraft = vi.fn();
    renderBuilder({
      selectedRequest: secondDraft.request,
      selectedRequestDraft: secondDraft,
      requestDraftSave: {
        status: "saving",
        requestId: RequestId("request-1"),
        error: null,
        revision: 0,
      },
      onRunRequest,
      onSaveRequestDraft,
    });

    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true, metaKey: true });
    await user.type(screen.getByLabelText("Request URL"), "?dirty=true");
    fireEvent.keyDown(window, { key: "s", ctrlKey: true, metaKey: true });

    expect(onRunRequest).not.toHaveBeenCalled();
    expect(onSaveRequestDraft).not.toHaveBeenCalled();
  });

  it("blocks the keyboard send shortcut while the draft is dirty", async () => {
    const user = userEvent.setup();
    const onRunRequest = vi.fn();
    renderBuilder({ onRunRequest });

    await user.type(screen.getByLabelText("Request body"), " ");
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });

    expect(onRunRequest).not.toHaveBeenCalled();
  });

  it("makes a running request read-only without staging a save and remains cancellable", async () => {
    const user = userEvent.setup();
    const onSaveRequestDraft = vi.fn();
    const onCancelRequest = vi.fn();
    const view = renderBuilder({ onSaveRequestDraft, onCancelRequest });

    await user.type(screen.getByLabelText("Request URL"), "?dirty=true");
    const dirtyUrl = screen.getByLabelText("Request URL").getAttribute("value");
    view.rerenderWith({ isRunning: true });

    expect(screen.getByRole("button", { name: "POST" })).toBeDisabled();
    expect(screen.getByLabelText("Request URL")).toBeDisabled();
    expect(screen.getByLabelText("Request body")).toHaveAttribute("readonly");

    await user.click(screen.getByRole("tab", { name: "Headers" }));
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByLabelText("Header name")).toBeDisabled();
    expect(screen.getByLabelText("Header value")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete header" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add Header" })).toBeDisabled();

    await user.type(screen.getByLabelText("Request URL"), "&ignored=true");
    await user.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.keyDown(window, { key: "s", ctrlKey: true });

    expect(screen.getByLabelText("Request URL")).toHaveValue(dirtyUrl);
    expect(onSaveRequestDraft).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    expect(cancelButton).toBeEnabled();
    await user.click(cancelButton);
    expect(onCancelRequest).toHaveBeenCalledOnce();
  });

  it.each([
    ["missing", null],
    ["mismatched", secondDraft],
  ])("disables header editing when the selected draft is %s", async (_, selectedRequestDraft) => {
    const user = userEvent.setup();
    const onSaveRequestDraft = vi.fn();
    renderBuilder({ selectedRequestDraft, onSaveRequestDraft });

    await user.click(screen.getByRole("tab", { name: "Headers" }));
    const addButton = screen.getByRole("button", { name: "Add Header" });
    expect(addButton).toBeDisabled();
    await user.click(addButton);

    expect(screen.queryByLabelText("Header name")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(onSaveRequestDraft).not.toHaveBeenCalled();
  });

  it("disables every HeadersEditor control and suppresses its callback", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <HeadersEditor
        headers={firstDraft.headers.map((header) => ({ ...header }))}
        onChange={onChange}
        disabled
      />,
    );

    const controls = [
      screen.getByRole("checkbox"),
      screen.getByLabelText("Header name"),
      screen.getByLabelText("Header value"),
      screen.getByRole("button", { name: "Delete header" }),
      screen.getByRole("button", { name: "Add Header" }),
    ];
    for (const control of controls) {
      expect(control).toBeDisabled();
      await user.click(control);
    }
    await user.type(screen.getByLabelText("Header value"), "ignored");

    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears dirty state only after the matching successful revision increases", async () => {
    const user = userEvent.setup();
    const view = renderBuilder();

    await user.type(screen.getByLabelText("Request body"), " ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    view.rerenderWith({
      requestDraftSave: {
        status: "success",
        requestId: RequestId("request-2"),
        error: null,
        revision: 1,
      },
    });
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();

    view.rerenderWith({
      requestDraftSave: {
        status: "success",
        requestId: RequestId("request-1"),
        error: null,
        revision: 0,
      },
    });
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();

    view.rerenderWith({
      requestDraftSave: {
        status: "success",
        requestId: RequestId("request-1"),
        error: null,
        revision: 1,
      },
    });
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("keeps the draft dirty and exposes only the machine's public save error", async () => {
    const user = userEvent.setup();
    const view = renderBuilder();

    await user.type(screen.getByLabelText("Request body"), " ");
    await user.click(screen.getByRole("button", { name: "Save" }));
    view.rerenderWith({
      requestDraftSave: {
        status: "error",
        requestId: RequestId("request-1"),
        error: "Request draft save failed. Try again.",
        revision: 0,
      },
    });

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Request draft save failed. Try again.");
  });

  it("retains request creation through the existing save command", async () => {
    const user = userEvent.setup();
    const onCreateRequest = vi.fn();
    renderBuilder({
      selectedRequest: null,
      selectedRequestDraft: null,
      onCreateRequest,
    });

    await user.type(screen.getByLabelText("Request URL"), "https://example.com/new");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onCreateRequest).toHaveBeenCalledWith(
      "GET",
      "New GET Request",
      "https://example.com/new",
    );
  });

  it("wires the selected confirmed draft and complete save event through the workspace", async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    useMachineMock.mockReturnValue([
      {
        context: {
          collections: [],
          requestsByCollection: { "collection-1": [firstDraft.request] },
          requestDrafts: { "request-1": firstDraft },
          requestDraftSave: idleSave,
          activeCollectionId: "collection-1",
          activeRequestId: "request-1",
          activeEnvironmentId: null,
          environments: [],
          variablesByEnvironment: {},
          runner: {
            status: "idle",
            requestId: null,
            response: null,
            baselineResponse: null,
            error: null,
            startedAt: null,
          },
          history: [],
          uiFlags: {
            isSidebarOpen: false,
            showDiff: false,
          },
          requestStatuses: new Map(),
          workspaceState: {
            statusLabel: "IDLE",
            activeCollectionKey: "collection-1",
            selectedRequest: firstDraft.request,
            canRunRequest: true,
            lastError: null,
          },
        },
        matches: () => false,
      },
      send,
    ]);

    render(<PosteeWorkspace />);

    expect(screen.getByLabelText("Request body")).toHaveValue("{\"saved\":true}");
    await user.type(screen.getByLabelText("Request URL"), "?workspace=true");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(send).toHaveBeenCalledWith({
      type: "SAVE_REQUEST_DRAFT",
      draft: expect.objectContaining({
        request: expect.objectContaining({
          id: "request-1",
          url: "https://example.com/first?workspace=true",
        }),
        headers: firstDraft.headers,
        body: firstDraft.body,
      }),
    });
  });
});
