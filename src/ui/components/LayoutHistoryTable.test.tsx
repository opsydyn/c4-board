import type { LayoutHistoryArtifact } from "@/core/effects/layout-history-export";
import type { LayoutApplicationAudit } from "@/core/effects/layout.types";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LayoutHistoryTable } from "./LayoutHistoryTable";

const audit = (
  appliedAt: number,
  selectedVariant: LayoutApplicationAudit["selectedVariant"],
): LayoutApplicationAudit => ({
  version: 1,
  appliedAt,
  preset: "elkLayered",
  strategyId: "elk-layered",
  engine: "elk",
  selectedVariant,
  comparisonMetrics: [{
    key: "routedCrossings",
    original: 8,
    recommended: 3,
    favored: "recommended",
  }],
});

describe("LayoutHistoryTable", () => {
  it("shows the latest audit and lets users inspect an older entry", () => {
    render(<LayoutHistoryTable audits={[audit(200, "recommended"), audit(100, "original")]} />);

    expect(screen.getByRole("heading", { name: "Recommended layout" })).toBeInTheDocument();
    expect(screen.getByText("3", { selector: "td" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Original layout/i }));

    expect(screen.getByRole("heading", { name: "Original layout" })).toBeInTheDocument();
    expect(screen.getByText("8", { selector: "td" })).toBeInTheDocument();
  });

  it("renders an explicit empty state", () => {
    render(<LayoutHistoryTable audits={[]} />);

    expect(screen.getByText("No accepted layouts yet")).toBeInTheDocument();
  });

  it("requires confirmation before deleting the selected audit", () => {
    const onDeleteAudit = vi.fn(async () => {});
    render(
      <LayoutHistoryTable
        audits={[audit(200, "recommended"), audit(100, "original")]}
        onDeleteAudit={onDeleteAudit}
        onClearAudits={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete selected layout audit" }));
    expect(onDeleteAudit).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm delete selected layout audit" }));
    expect(onDeleteAudit).toHaveBeenCalledWith(200);
  });

  it("allows clear-all confirmation to be cancelled", () => {
    const onClearAudits = vi.fn(async () => {});
    render(
      <LayoutHistoryTable
        audits={[audit(200, "recommended")]}
        onDeleteAudit={vi.fn()}
        onClearAudits={onClearAudits}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear layout audit history" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel clear layout audit history" }));

    expect(onClearAudits).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Clear layout audit history" })).toBeInTheDocument();
  });

  it("previews review evidence before allowing download", async () => {
    const preparedArtifact: LayoutHistoryArtifact = {
      schema: "opsydyn.layout-history",
      version: 2,
      exportedAt: 500,
      diagram: { id: "diagram-1", name: "Checkout" },
      retention: { limit: 100, exportedCount: 1 },
      summary: {
        applicationCount: 1,
        firstAppliedAt: 200,
        lastAppliedAt: 200,
        variants: { single: 0, original: 0, recommended: 1 },
        engines: { dagre: 0, elk: 1, custom: 0 },
      },
      audits: [audit(200, "recommended")],
      fingerprint: { algorithm: "SHA-256", value: "a".repeat(64) },
    };
    const onPrepareExport = vi.fn(async () => preparedArtifact);
    const onDownloadExport = vi.fn();
    render(
      <LayoutHistoryTable
        audits={[audit(200, "recommended")]}
        onPrepareExport={onPrepareExport}
        onDownloadExport={onDownloadExport}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Prepare layout audit history export" }));

    expect(onDownloadExport).not.toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: "Export review" })).toBeInTheDocument();
    expect(screen.getByText("a".repeat(64))).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Download layout audit history" }));

    expect(onPrepareExport).toHaveBeenCalledOnce();
    expect(onDownloadExport).toHaveBeenCalledWith(preparedArtifact);
  });
});
