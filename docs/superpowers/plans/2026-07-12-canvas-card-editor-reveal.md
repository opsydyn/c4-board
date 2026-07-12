# Canvas Card Editor Reveal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the desktop right-side node editor when a user selects a node card directly on the canvas.

**Architecture:** Keep selection in the existing canvas-machine event and panel visibility in `C4CanvasContainer`. A small pure policy function makes compact-layout and layout-preview suppression explicit; only the canvas card click callback invokes it, so other selection sources remain unchanged.

**Tech Stack:** React 19, TypeScript 6, React Flow, XState 5, Vitest 4, Astro 7

## Global Constraints

- Only direct canvas-card selection reveals the editor.
- Search, Balanced Mud Chart, OPY, and programmatic selections keep their current behavior.
- Suppress reveal when compact layout is active at widths of `1200px` or less.
- Suppress reveal when layout preview is active or still resolving.
- Preserve the existing `SELECT_NODE` event and `PropertiesPanel` edit lifecycle.
- Do not change `C4Canvas` double-click selection, `1.4` zoom, or `400ms` recenter behavior.
- Keep `C4CanvasContainer` hook dependencies stable and compliant with `lint:guards`.

---

### Task 1: Reveal Node Editor From Canvas Card Selection

**Files:**
- Modify: `src/ui/components/C4CanvasContainer.tsx`
- Modify: `src/ui/components/C4CanvasContainer.graph-fit.test.ts`

**Interfaces:**
- Consumes: `isCompactLayout`, `layoutPreview`, `layoutPreviewStatus`, `setDetailsOpen`, and the existing `send({ type: "SELECT_NODE", nodeId })` callback dependencies
- Produces: `shouldRevealNodeDetails(input: NodeDetailsRevealInput): boolean`
- Produces: a memoized canvas `onNodeClick` handler that selects first and reveals details only when the policy returns `true`

- [ ] **Step 1: Write the failing reveal-policy tests**

Update `src/ui/components/C4CanvasContainer.graph-fit.test.ts` to import the new policy beside the existing graph-fit helper:

```ts
import {
  scheduleCanvasGraphFit,
  shouldRevealNodeDetails,
} from "./C4CanvasContainer";
```

Append this suite:

```ts
describe("canvas card node-details reveal policy", () => {
  it("reveals node details for a normal desktop canvas selection", () => {
    expect(shouldRevealNodeDetails({
      isCompactLayout: false,
      hasLayoutPreview: false,
      hasLayoutPreviewStatus: false,
    })).toBe(true);
  });

  it("suppresses node details in compact layout", () => {
    expect(shouldRevealNodeDetails({
      isCompactLayout: true,
      hasLayoutPreview: false,
      hasLayoutPreviewStatus: false,
    })).toBe(false);
  });

  it("suppresses node details while a layout preview is active", () => {
    expect(shouldRevealNodeDetails({
      isCompactLayout: false,
      hasLayoutPreview: true,
      hasLayoutPreviewStatus: false,
    })).toBe(false);
  });

  it("suppresses node details while a layout preview is resolving", () => {
    expect(shouldRevealNodeDetails({
      isCompactLayout: false,
      hasLayoutPreview: false,
      hasLayoutPreviewStatus: true,
    })).toBe(false);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
bun run test:run src/ui/components/C4CanvasContainer.graph-fit.test.ts
```

Expected: FAIL because `C4CanvasContainer` does not export `shouldRevealNodeDetails`.

- [ ] **Step 3: Add the reveal policy**

Add this exported contract near the existing exported `scheduleCanvasGraphFit` helper in `src/ui/components/C4CanvasContainer.tsx`:

```ts
interface NodeDetailsRevealInput {
  readonly isCompactLayout: boolean;
  readonly hasLayoutPreview: boolean;
  readonly hasLayoutPreviewStatus: boolean;
}

export const shouldRevealNodeDetails = ({
  isCompactLayout,
  hasLayoutPreview,
  hasLayoutPreviewStatus,
}: NodeDetailsRevealInput): boolean =>
  !isCompactLayout && !hasLayoutPreview && !hasLayoutPreviewStatus;
```

- [ ] **Step 4: Wire the policy only into canvas card clicks**

Replace the existing `onNodeClick` callback in `src/ui/components/C4CanvasContainer.tsx`:

```ts
const onNodeClick = useCallback(
  (_event: React.MouseEvent, node: Node) => {
    send({ type: "SELECT_NODE", nodeId: node.id });
  },
  [send],
);
```

with:

```ts
const onNodeClick = useCallback(
  (_event: React.MouseEvent, node: Node) => {
    send({ type: "SELECT_NODE", nodeId: node.id });
    if (shouldRevealNodeDetails({
      isCompactLayout,
      hasLayoutPreview: layoutPreview !== null,
      hasLayoutPreviewStatus: layoutPreviewStatus !== null,
    })) {
      setDetailsOpen(true);
    }
  },
  [isCompactLayout, layoutPreview, layoutPreviewStatus, send],
);
```

Do not alter `handleSelectNode`, `C4Canvas.handleNodeDoubleClick`, the `PropertiesPanel` props, or canvas-machine events. This keeps non-card selection sources and double-click camera behavior unchanged.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
bun run test:run src/ui/components/C4CanvasContainer.graph-fit.test.ts src/ui/components/C4Canvas.fit.test.ts src/ui/machines/canvas.machine.test.ts
```

Expected: all tests pass, including the four reveal-policy cases, existing viewport behavior, and existing node selection semantics.

- [ ] **Step 6: Run container hook guards**

Run:

```bash
bun run lint:guards
```

Expected: exit `0`; the expanded callback dependency list satisfies the orchestration guard rules.

- [ ] **Step 7: Run frontend regression gates**

Run:

```bash
bun run test:run
bun run build
bun run knip
```

Expected:

- all Vitest suites pass;
- Astro reports zero errors and zero warnings from the changed files;
- Knip reports no unused export or file findings.

- [ ] **Step 8: Inspect the diff for interaction scope**

Run:

```bash
git diff --check
git diff -- src/ui/components/C4Canvas.tsx src/ui/components/C4CanvasContainer.tsx src/ui/components/C4CanvasContainer.graph-fit.test.ts
```

Expected: `C4Canvas.tsx` has no diff; only the reveal policy, canvas-card callback wiring, and focused policy tests changed.

- [ ] **Step 9: Commit**

```bash
git add src/ui/components/C4CanvasContainer.tsx src/ui/components/C4CanvasContainer.graph-fit.test.ts
git commit -m "feat: reveal node editor on canvas selection"
```

Expected: one focused conventional commit containing the behavior and its tests.
