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

  it("exports retained history through an explicit command", () => {
    const onExportAudits = vi.fn();
    render(
      <LayoutHistoryTable
        audits={[audit(200, "recommended")]}
        onExportAudits={onExportAudits}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Export layout audit history" }));

    expect(onExportAudits).toHaveBeenCalledOnce();
  });
});
