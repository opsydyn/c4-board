import { createLayoutPreview } from "@/core/effects/layout-preview";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { cloneLayoutFixture, layoutGraphFixtures } from "../../../tests/fixtures/layoutGraphs";
import { LayoutPreviewDrawer } from "./LayoutPreviewDrawer";

const createPreview = () => {
  const graph = cloneLayoutFixture(
    layoutGraphFixtures.find((fixture) => fixture.name === "system-context")!,
  );
  return createLayoutPreview({
    ...graph,
    preset: "systemContext",
    scope: "graph",
  });
};

describe("LayoutPreviewDrawer", () => {
  it("renders strategy, scope, quality metrics, diagnostics, and center control", () => {
    render(
      <LayoutPreviewDrawer
        preview={createPreview()}
        onCenterChange={() => {}}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole("region", { name: "Layout preview" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "System Context" })).toBeInTheDocument();
    expect(screen.getByText("STRATEGY::SYSTEM-CONTEXT")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select system of interest" })).toHaveTextContent("core-system");
    expect(screen.getByText(/Inferred system of interest 'core-system'/)).toBeInTheDocument();
  });

  it("applies, cancels, and changes the inferred center through explicit controls", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onCancel = vi.fn();
    const onCenterChange = vi.fn();
    render(
      <LayoutPreviewDrawer
        preview={createPreview()}
        onCenterChange={onCenterChange}
        onApply={onApply}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Apply layout" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Select system of interest" }));
    await user.click(screen.getByRole("option", { name: "payments" }));

    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCenterChange).toHaveBeenCalledWith("payments");
  });

  it("shows a retained preview warning and retries the failed engine", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <LayoutPreviewDrawer
        preview={createPreview()}
        failure={{ attemptedLabel: "ELK Layered", message: "Worker timed out." }}
        onRetry={onRetry}
        onCenterChange={() => {}}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "ELK Layered failed. Showing the last valid preview. Worker timed out.",
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("surfaces assigned ports and congestion in the quality panel", () => {
    const preview = createPreview();
    preview.portSummary = {
      assignedEdges: 12,
      congestedSides: 1,
      busiestSide: {
        nodeId: "hub",
        side: "bottom",
        edgeCount: 12,
        estimatedCapacity: 9,
      },
    };
    render(
      <LayoutPreviewDrawer
        preview={preview}
        onCenterChange={() => {}}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );

    const summary = screen.getByRole("group", { name: "Port routing summary" });
    expect(summary).toHaveTextContent("Assigned edges12");
    expect(summary).toHaveTextContent("Congested sides1");
    expect(summary).toHaveTextContent("Busiest side12/9 BOTTOM");
  });

  it("labels straight baselines and surfaces routed geometry only when available", () => {
    const preview = createPreview();
    preview.routedQuality = { edgeCrossingCount: 2, totalEdgeLength: 1_245.4 };
    render(
      <LayoutPreviewDrawer
        preview={preview}
        onCenterChange={() => {}}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByRole("row", { name: /Straight crossings/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Straight length/ })).toBeInTheDocument();
    const routed = screen.getByRole("group", { name: "Routed geometry quality" });
    expect(routed).toHaveTextContent("Routed crossings2");
    expect(routed).toHaveTextContent("Routed length1,245");
  });

  it("offers a deterministic preview-only recommendation action", async () => {
    const user = userEvent.setup();
    const onTryRecommendation = vi.fn();
    const preview = createPreview();
    preview.recommendation = {
      id: "change-direction",
      label: "Try top-to-bottom routing",
      rationale: "Separate competing route channels.",
      options: { direction: "TB" },
      currentQuality: { edgeCrossingCount: 9, totalEdgeLength: 3_544 },
      recommendedQuality: { edgeCrossingCount: 4, totalEdgeLength: 3_800 },
      crossingDelta: -5,
      lengthDelta: 256,
    };
    render(
      <LayoutPreviewDrawer
        preview={preview}
        onCenterChange={() => {}}
        onApply={() => {}}
        onCancel={() => {}}
        onTryRecommendation={onTryRecommendation}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Try top-to-bottom routing" }));
    expect(onTryRecommendation).toHaveBeenCalledOnce();
    expect(screen.getByText("CROSSINGS 9 → 4 · ROUTED LENGTH 3,544 → 3,800")).toBeInTheDocument();
  });

  it("switches repeatedly between explicitly labeled comparison modes", async () => {
    const user = userEvent.setup();
    const onComparisonModeChange = vi.fn();
    render(
      <LayoutPreviewDrawer
        preview={createPreview()}
        onCenterChange={() => {}}
        onApply={() => {}}
        onCancel={() => {}}
        comparisonMode="recommended"
        onComparisonModeChange={onComparisonModeChange}
      />,
    );

    const original = screen.getByRole("button", { name: "Original" });
    const recommended = screen.getByRole("button", { name: "Recommended" });
    expect(original).toHaveAttribute("aria-pressed", "false");
    expect(recommended).toHaveAttribute("aria-pressed", "true");

    await user.click(original);
    await user.click(recommended);
    await user.click(original);
    expect(onComparisonModeChange.mock.calls).toEqual([
      ["original"],
      ["recommended"],
      ["original"],
    ]);
  });
});
