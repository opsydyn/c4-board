import type { LayoutApplicationAudit } from "@/core/effects/layout.types";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
