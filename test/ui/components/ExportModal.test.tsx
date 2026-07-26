import { ExportModal } from "@/ui/components/ExportModal";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

/**
 * ADR-014 Phases 2 and 3.
 *
 * The renderer is injected, so this suite never imports the real Mermaid bundle —
 * 79.7 MB unpacked, and loading it here would make every test run pay for a
 * feature only one of them exercises.
 *
 * The behaviour worth protecting is that a rejected diagram *says so*. Mermaid's
 * C4 support is experimental and will refuse input the flowchart dialect accepts;
 * a preview that blanks reads as an empty diagram rather than a failed one.
 */

const setup = (over: Partial<React.ComponentProps<typeof ExportModal>> = {}) => {
  const props = {
    isOpen: true,
    exportedCode: "C4Context\n  Person(operator, \"Operator\")\n",
    exportFormat: "mermaid" as const,
    diagramName: "payments",
    mermaidDialect: "c4" as const,
    onMermaidDialectChange: vi.fn(),
    onClose: vi.fn(),
    renderMermaid: vi.fn().mockResolvedValue("<svg data-testid=\"diagram\"/>"),
    ...over,
  };
  render(<ExportModal {...props} />);
  return props;
};

describe("dialect selection", () => {
  it("offers both dialects and shows which is active", () => {
    setup();

    expect(screen.getByRole("button", { name: /flowchart/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /^c4/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("asks the owner to switch rather than transforming the code itself", () => {
    const props = setup();

    void userEvent.click(screen.getByRole("button", { name: /flowchart/i }));

    return waitFor(() => expect(props.onMermaidDialectChange).toHaveBeenCalledWith("flowchart"));
  });

  it("hides the dialect choice for PlantUML, which has only one form", () => {
    setup({ exportFormat: "plantuml", exportedCode: "@startuml\n@enduml" });

    expect(screen.queryByRole("button", { name: /flowchart/i })).not.toBeInTheDocument();
  });
});

describe("preview", () => {
  it("shows code first and does not render until asked", () => {
    const props = setup();

    expect(screen.getByText(/C4Context/)).toBeInTheDocument();
    // The whole point of lazy loading: no preview, no Mermaid.
    expect(props.renderMermaid).not.toHaveBeenCalled();
  });

  it("renders the diagram when preview is selected", async () => {
    const user = userEvent.setup();
    const props = setup();

    await user.click(screen.getByRole("button", { name: /preview/i }));

    await waitFor(() => expect(props.renderMermaid).toHaveBeenCalled());
    expect(props.renderMermaid).toHaveBeenCalledWith(
      expect.stringContaining("C4Context"),
      expect.any(String),
    );
  });

  it("reports a rejected diagram instead of showing an empty frame", async () => {
    const user = userEvent.setup();
    setup({ renderMermaid: vi.fn().mockRejectedValue(new Error("Parse error on line 2")) });

    await user.click(screen.getByRole("button", { name: /preview/i }));

    expect(await screen.findByText(/Parse error on line 2/)).toBeInTheDocument();
  });

  it("still offers the code when the preview cannot render", async () => {
    const user = userEvent.setup();
    setup({ renderMermaid: vi.fn().mockRejectedValue(new Error("nope")) });

    await user.click(screen.getByRole("button", { name: /preview/i }));
    await screen.findByText(/nope/);
    await user.click(screen.getByRole("button", { name: /code/i }));

    expect(screen.getByText(/C4Context/)).toBeInTheDocument();
  });

  it("re-renders when the code changes underneath it", async () => {
    const user = userEvent.setup();
    const renderMermaid = vi.fn().mockResolvedValue("<svg/>");
    const props = {
      isOpen: true,
      exportedCode: "C4Context",
      exportFormat: "mermaid" as const,
      mermaidDialect: "c4" as const,
      onMermaidDialectChange: vi.fn(),
      onClose: vi.fn(),
      renderMermaid,
    };
    // `rerender`, not a second `render`: mounting a new instance would reset the
    // view to code and prove nothing about a code change reaching the preview.
    const { rerender } = render(<ExportModal {...props} />);

    await user.click(screen.getByRole("button", { name: /preview/i }));
    await waitFor(() => expect(renderMermaid).toHaveBeenCalledTimes(1));

    rerender(<ExportModal {...props} exportedCode="flowchart TB" />);

    await waitFor(() => expect(renderMermaid).toHaveBeenCalledTimes(2));
    expect(renderMermaid.mock.calls[1]?.[0]).toBe("flowchart TB");
  });
});

describe("actions", () => {
  it("names the download after the diagram", () => {
    setup();

    expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
  });

  it("renders nothing without code", () => {
    setup({ exportedCode: null });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
