import { ResponseViewer } from "@/ui/components/postee/ResponseViewer";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@monaco-editor/react", () => ({
  default: ({ value }: { value: string }) => <textarea aria-label="Response body editor" readOnly value={value} />,
  DiffEditor: () => <div data-testid="diff-editor" />,
  loader: { config: vi.fn() },
}));

/**
 * ADR-010 Phase 3. A body that could not be decoded must say so. Rendering an
 * empty editor is indistinguishable from a genuinely empty response, which is the
 * silent misreporting this ADR exists to remove.
 */

describe("ResponseViewer with an undecodable body", () => {
  it("explains that the body could not be decoded", () => {
    render(
      <ResponseViewer
        body=""
        bodyDecodeError="Response body is not valid utf-8 text"
        status={200}
        statusText="OK"
        size={2048}
        defaultExpanded
      />,
    );

    expect(screen.getByText(/could not be decoded/i)).toBeInTheDocument();
    expect(screen.getByText(/not valid utf-8 text/i)).toBeInTheDocument();
  });

  it("still reports the parts of the response that did arrive", () => {
    render(
      <ResponseViewer
        body=""
        bodyDecodeError="stream closed"
        status={500}
        statusText="Internal Server Error"
        size={2048}
        defaultExpanded
      />,
    );

    // Status renders as split text nodes inside one span.
    const status = screen.getByText(/Status:/).closest("span");
    expect(status?.textContent).toContain("500");
    expect(status?.textContent).toContain("Internal Server Error");
    expect(screen.getByText(/Size:/).closest("span")?.textContent).toContain("2048");
  });

  it("does not present an empty editor as if it were the response", () => {
    render(
      <ResponseViewer body="" bodyDecodeError="stream closed" status={200} defaultExpanded />,
    );

    expect(screen.queryByLabelText("Response body editor")).not.toBeInTheDocument();
  });

  it("renders the body normally when it decoded", () => {
    render(
      <ResponseViewer body={"{\"ok\":true}"} bodyDecodeError={null} status={200} defaultExpanded />,
    );

    expect(screen.queryByText(/could not be decoded/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Response body editor")).toBeInTheDocument();
  });
});
