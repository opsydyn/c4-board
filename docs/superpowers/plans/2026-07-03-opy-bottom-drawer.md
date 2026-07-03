# OPY Bottom Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OPY default to a conventional bottom drawer on the C4 board while preserving the current floating widget as a secondary novel mode.

**Architecture:** Add a persisted OPY surface mode setting, then route a single `OpyCopilotPanel` instance through either a new bottom drawer shell or the existing `OpyFloatingWidget` shell. The drawer reuses the existing board bottom-panel visual language so OPY stops covering the canvas by default, and the floating widget remains available without duplicating OPY lifecycle/session state.

**Tech Stack:** Astro 6, React 19, TypeScript, vanilla-extract, Effect Schema settings runtime, XState-adjacent React state, Vitest, Testing Library.

---

## File Structure

- Modify `src/core/effects/settings.types.ts`: add `OpySurfaceModeSchema`, `OpySurfaceMode`, `opySurfaceMode` in `AppSettingsSchema`, and default it to `"drawer"`.
- Modify `src/core/effects/settings.runtime.ts`: normalize legacy or invalid `opySurfaceMode` values back to the current fallback.
- Modify `test/core/effects/settings.types.test.ts`: assert the default mode, key registration, and invalid values.
- Modify `test/core/effects/settings.runtime.test.ts`: assert invalid persisted values normalize back to fallback.
- Create `src/ui/components/OpyDrawer.tsx`: bottom drawer shell that hosts `OpyCopilotPanel` children and exposes collapse, mode switch, and status summary.
- Create `src/ui/components/OpyDrawer.css.ts`: drawer-specific layout classes that compose with the existing bottom-panel styling.
- Create `src/ui/components/OpyDrawer.test.tsx`: render-level tests for drawer controls and shell semantics.
- Modify `src/ui/components/C4CanvasContainer.tsx`: render exactly one OPY host at a time, choose drawer by default, coordinate bottom-row ownership with `DataBar`, and persist mode switches.
- Add `test/components/OpySurfaceMode.test.tsx`: focused component test for the host-selection rule using a small exported pure helper from `C4CanvasContainer` if direct rendering is too heavy.

---

### Task 1: Add Persisted OPY Surface Mode

**Files:**
- Modify: `src/core/effects/settings.types.ts`
- Modify: `src/core/effects/settings.runtime.ts`
- Test: `test/core/effects/settings.types.test.ts`
- Test: `test/core/effects/settings.runtime.test.ts`

- [ ] **Step 1: Write failing settings type tests**

Add these assertions to `test/core/effects/settings.types.test.ts`:

```ts
it("defaults OPY to the drawer surface mode", () => {
  expect(DEFAULT_APP_SETTINGS.opySurfaceMode).toBe("drawer");
});

it("exports OPY surface mode as a stable setting key", () => {
  expect(isAppSettingKey("opySurfaceMode")).toBe(true);
});

it("rejects invalid OPY surface mode values", () => {
  expect(() =>
    Schema.decodeUnknownSync(AppSettingsSchema)({
      ...DEFAULT_APP_SETTINGS,
      opySurfaceMode: "fullscreen",
    })
  ).toThrow();
});
```

- [ ] **Step 2: Write failing settings runtime normalization test**

Add this test to `test/core/effects/settings.runtime.test.ts`:

```ts
it("normalizes invalid OPY surface mode values to the fallback setting", () => {
  const normalized = normalizeAppSettingsCandidate(
    {
      ...DEFAULT_APP_SETTINGS,
      opySurfaceMode: "fullscreen",
    },
    DEFAULT_APP_SETTINGS,
  );

  expect(normalized.opySurfaceMode).toBe("drawer");
});
```

- [ ] **Step 3: Run focused tests and verify red**

Run:

```bash
bun run test:run test/core/effects/settings.types.test.ts test/core/effects/settings.runtime.test.ts
```

Expected: fail because `opySurfaceMode` is not defined on `DEFAULT_APP_SETTINGS` or `AppSettingsSchema`.

- [ ] **Step 4: Add the settings type**

In `src/core/effects/settings.types.ts`, add the schema near the other OPY schemas:

```ts
export const OpySurfaceModeSchema = Schema.Literal("drawer", "floating");
export type OpySurfaceMode = Schema.Schema.Type<typeof OpySurfaceModeSchema>;
```

Then add this field to `AppSettingsSchema` next to `opyCopilotVisible`:

```ts
  opySurfaceMode: OpySurfaceModeSchema,
```

Then add this default next to `opyCopilotVisible` in `DEFAULT_APP_SETTINGS`:

```ts
  opySurfaceMode: "drawer",
```

- [ ] **Step 5: Add runtime normalization**

In `src/core/effects/settings.runtime.ts`, add this field inside `normalizeAppSettingsCandidate`:

```ts
  opySurfaceMode: normalizeEnumValue(
    input.opySurfaceMode,
    ["drawer", "floating"],
    fallback.opySurfaceMode,
  ),
```

- [ ] **Step 6: Run focused tests and verify green**

Run:

```bash
bun run test:run test/core/effects/settings.types.test.ts test/core/effects/settings.runtime.test.ts
```

Expected: both files pass.

- [ ] **Step 7: Commit**

```bash
git add src/core/effects/settings.types.ts src/core/effects/settings.runtime.ts test/core/effects/settings.types.test.ts test/core/effects/settings.runtime.test.ts
git commit -m "feat: add opy surface mode setting"
```

---

### Task 2: Create the OPY Drawer Shell

**Files:**
- Create: `src/ui/components/OpyDrawer.tsx`
- Create: `src/ui/components/OpyDrawer.css.ts`
- Test: `src/ui/components/OpyDrawer.test.tsx`

- [ ] **Step 1: Write failing drawer shell tests**

Create `src/ui/components/OpyDrawer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OpyDrawer } from "./OpyDrawer";

describe("OpyDrawer", () => {
  it("renders OPY content inside a bottom drawer shell", () => {
    render(
      <OpyDrawer
        diagramName="Payments Board"
        nodeCount={4}
        edgeCount={3}
        chromeTone="ready"
        onCollapse={() => {}}
        onSwitchToFloating={() => {}}
      >
        <div>OPY panel content</div>
      </OpyDrawer>,
    );

    expect(screen.getByRole("region", { name: "OPY drawer" })).toBeInTheDocument();
    expect(screen.getByText("OPY panel content")).toBeInTheDocument();
    expect(screen.getByText("PAYMENTS BOARD")).toBeInTheDocument();
    expect(screen.getByText("NODES::4")).toBeInTheDocument();
    expect(screen.getByText("EDGES::3")).toBeInTheDocument();
  });

  it("collapses and switches to floating mode through explicit controls", async () => {
    const user = userEvent.setup();
    const onCollapse = vi.fn();
    const onSwitchToFloating = vi.fn();

    render(
      <OpyDrawer
        diagramName="Board"
        nodeCount={0}
        edgeCount={0}
        chromeTone="caution"
        onCollapse={onCollapse}
        onSwitchToFloating={onSwitchToFloating}
      >
        <div>OPY panel content</div>
      </OpyDrawer>,
    );

    await user.click(screen.getByRole("button", { name: "Collapse OPY drawer" }));
    await user.click(screen.getByRole("button", { name: "Switch OPY to floating mode" }));

    expect(onCollapse).toHaveBeenCalledTimes(1);
    expect(onSwitchToFloating).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run drawer tests and verify red**

Run:

```bash
bun run test:run src/ui/components/OpyDrawer.test.tsx
```

Expected: fail because `./OpyDrawer` does not exist.

- [ ] **Step 3: Add drawer styles**

Create `src/ui/components/OpyDrawer.css.ts`:

```ts
import { style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";

export const drawerRoot = style({
  display: "flex",
  flexDirection: "column",
  gridRow: "2 / 3",
  gridColumn: "1 / -1",
  gap: theme.spacing["3"],
  clipPath: theme.clipPath.lg,
  border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
  boxShadow: theme.effect.glow.md,
  backgroundColor: "rgba(8, 14, 11, 0.98)",
  padding: `${theme.spacing["4"]} ${theme.spacing["5"]} ${theme.spacing["5"]}`,
  minHeight: 0,
  maxHeight: "56vh",
  overflow: "hidden",
  selectors: {
    "&[data-chrome-tone=\"ready\"]": {
      borderColor: theme.color.status.ready,
    },
    "&[data-chrome-tone=\"caution\"]": {
      borderColor: theme.color.status.caution,
    },
    "&[data-chrome-tone=\"critical\"]": {
      borderColor: theme.color.status.critical,
    },
  },
});

export const drawerHeader = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing["3"],
});

export const drawerIdentity = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["1"],
  minWidth: 0,
});

export const drawerTitle = style({
  margin: 0,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
  fontWeight: theme.typography.weight.bold,
});

export const drawerMeta = style({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing["2"],
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const drawerActions = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: theme.spacing["2"],
});

export const drawerActionButton = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing["1"],
  transition: theme.transition.base,
  clipPath: theme.clipPath.base,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(12, 20, 16, 0.92)",
  cursor: "pointer",
  padding: `${theme.spacing["1"]} ${theme.spacing["3"]}`,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
  selectors: {
    "&:hover": {
      borderColor: theme.color.border.primary,
      boxShadow: theme.effect.glow.sm,
      color: theme.color.foreground.primary,
    },
  },
});

export const drawerContent = style({
  display: "flex",
  flex: 1,
  minHeight: "420px",
  overflow: "hidden",
});
```

- [ ] **Step 4: Add drawer component**

Create `src/ui/components/OpyDrawer.tsx`:

```tsx
import { ArrowsOutSimpleIcon, CaretDownIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import * as styles from "./OpyDrawer.css";

export interface OpyDrawerProps {
  readonly diagramName: string;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly chromeTone: "ready" | "caution" | "critical";
  readonly onCollapse: () => void;
  readonly onSwitchToFloating: () => void;
  readonly children: ReactNode;
}

const normalizeDiagramName = (diagramName: string): string => {
  const trimmed = diagramName.trim();
  return trimmed.length > 0 ? trimmed.toUpperCase() : "UNTITLED BOARD";
};

export function OpyDrawer({
  diagramName,
  nodeCount,
  edgeCount,
  chromeTone,
  onCollapse,
  onSwitchToFloating,
  children,
}: OpyDrawerProps) {
  return (
    <section
      className={styles.drawerRoot}
      data-chrome-tone={chromeTone}
      aria-label="OPY drawer"
    >
      <div className={styles.drawerHeader}>
        <div className={styles.drawerIdentity}>
          <h2 className={styles.drawerTitle}>OPY // DRAWER</h2>
          <div className={styles.drawerMeta}>
            <span>{normalizeDiagramName(diagramName)}</span>
            <span>{`NODES::${nodeCount}`}</span>
            <span>{`EDGES::${edgeCount}`}</span>
          </div>
        </div>
        <div className={styles.drawerActions}>
          <button
            type="button"
            className={styles.drawerActionButton}
            onClick={onSwitchToFloating}
            aria-label="Switch OPY to floating mode"
          >
            <ArrowsOutSimpleIcon size={16} weight="bold" />
            Floating
          </button>
          <button
            type="button"
            className={styles.drawerActionButton}
            onClick={onCollapse}
            aria-label="Collapse OPY drawer"
          >
            <CaretDownIcon size={16} weight="bold" />
            ESC
          </button>
        </div>
      </div>
      <div className={styles.drawerContent}>{children}</div>
    </section>
  );
}
```

- [ ] **Step 5: Run drawer tests and verify green**

Run:

```bash
bun run test:run src/ui/components/OpyDrawer.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/OpyDrawer.tsx src/ui/components/OpyDrawer.css.ts src/ui/components/OpyDrawer.test.tsx
git commit -m "feat: add opy drawer shell"
```

---

### Task 3: Route OPY Through One Host At A Time

**Files:**
- Modify: `src/ui/components/C4CanvasContainer.tsx`
- Test: `test/components/OpySurfaceMode.test.tsx`

- [ ] **Step 1: Export a pure host-selection helper**

Before editing the component render path, add a test for the helper that will guard the main behavior. Create `test/components/OpySurfaceMode.test.tsx`:

```ts
import { describe, expect, it } from "vitest";
import { resolveOpyHostMode } from "../../src/ui/components/C4CanvasContainer";

describe("resolveOpyHostMode", () => {
  it("uses no OPY host when OPY is closed", () => {
    expect(resolveOpyHostMode({ isOpen: false, surfaceMode: "drawer" })).toBe("closed");
  });

  it("uses drawer host when OPY is open and drawer mode is selected", () => {
    expect(resolveOpyHostMode({ isOpen: true, surfaceMode: "drawer" })).toBe("drawer");
  });

  it("uses floating host when OPY is open and floating mode is selected", () => {
    expect(resolveOpyHostMode({ isOpen: true, surfaceMode: "floating" })).toBe("floating");
  });
});
```

- [ ] **Step 2: Run host-selection test and verify red**

Run:

```bash
bun run test:run test/components/OpySurfaceMode.test.tsx
```

Expected: fail because `resolveOpyHostMode` is not exported.

- [ ] **Step 3: Add the helper and host constants**

In `src/ui/components/C4CanvasContainer.tsx`, add near the local constants:

```ts
type OpyHostMode = "closed" | "drawer" | "floating";

export const resolveOpyHostMode = (input: {
  readonly isOpen: boolean;
  readonly surfaceMode: "drawer" | "floating";
}): OpyHostMode => {
  if (!input.isOpen) {
    return "closed";
  }
  return input.surfaceMode;
};
```

- [ ] **Step 4: Run host-selection test and verify green**

Run:

```bash
bun run test:run test/components/OpySurfaceMode.test.tsx
```

Expected: pass.

- [ ] **Step 5: Import the drawer and compute host mode**

In `src/ui/components/C4CanvasContainer.tsx`, add:

```ts
import { OpyDrawer } from "./OpyDrawer";
```

Near the existing `opyBoardContext` / `opySettingsSnapshot` derivations, add:

```ts
  const opyHostMode = resolveOpyHostMode({
    isOpen: isOpy9000Open,
    surfaceMode: appSettings.opySurfaceMode,
  });
  const opyChromeTone = opyChromeStatus?.tone ?? "ready";
```

- [ ] **Step 6: Extract the shared OPY panel element**

Replace the inline `OpyCopilotPanel` duplication risk with one local element before the main `return`:

```tsx
  const opyPanel = (
    <OpyCopilotPanel
      domain={state.context.currentDomain}
      diagramId={state.context.currentDiagramId}
      diagramName={state.context.diagramName}
      nodeCount={state.context.nodes.length}
      edgeCount={state.context.edges.length}
      boardSummary={opyBoardSummary}
      boardContext={opyBoardContext}
      aiSettings={appSettings.aiSettings}
      actionMode={opyActionMode}
      redactionMode={appSettings.redactionMode}
      agentPolicy={appSettings.agentPolicy}
      rigExecutionPolicy={appSettings.rigExecutionPolicy}
      rigAgentRollout={rigAgentRollout}
      settingsSnapshot={opySettingsSnapshot}
      azureSyncSnapshot={opyAzureSyncSnapshot}
      explainabilitySnapshot={opyExplainabilitySnapshot}
      viewportSections={appSettings.opyViewportSections}
      onViewportSectionsChange={(nextSections) => {
        void persistOpyViewportSections(nextSections);
      }}
      taskHistoryFiltersBySession={appSettings.opyTaskHistoryFiltersBySession}
      onTaskHistoryFiltersBySessionChange={(nextFiltersBySession) => {
        void persistOpyTaskHistoryFiltersBySession(nextFiltersBySession);
      }}
      onApplyBoardAction={handleApplyOpyBoardAction}
      onOpenAiSettings={() => {
        void navigateWithSave("/settings");
      }}
      onHide={toggleOpyCopilot}
      onChromeStatusChange={(nextStatus) => {
        setOpyChromeStatus((current) =>
          areOpyWidgetChromeStatusesEqual(current, nextStatus) ? current : nextStatus
        );
      }}
      chromeSectionRequest={opyChromeSectionRequest}
    />
  );
```

- [ ] **Step 7: Render floating only in floating host mode**

Inside `canvasRegion`, replace the unconditional `OpyFloatingWidget` block with:

```tsx
        {opyHostMode === "floating" && (
          <OpyFloatingWidget
            visible={isOpy9000Open}
            domain={state.context.currentDomain}
            diagramName={state.context.diagramName}
            nodeCount={state.context.nodes.length}
            edgeCount={state.context.edges.length}
            boardContext={opyBoardContext}
            chromeStatus={opyChromeStatus}
            presence={appSettings.opyWidgetPresence}
            layout={appSettings.opyWidgetLayout}
            modeLayouts={appSettings.opyWidgetModeLayouts}
            containerRef={canvasRegionRef}
            onOpen={toggleOpyCopilot}
            onStateCommit={(nextState) => {
              void persistOpyWidgetState(nextState);
            }}
            onChromeSignalAction={(signal) => {
              setOpyChromeSectionRequest({
                action: "focus-section",
                section: signal.targetSection,
                signalKey: signal.key,
                nonce: Date.now(),
              });
            }}
            onChromeSignalClearAction={(signal) => {
              setOpyChromeSectionRequest({
                action: "clear-focus",
                section: signal.targetSection,
                signalKey: signal.key,
                nonce: Date.now(),
              });
            }}
            onOpenSettings={() => {
              void navigateWithSave("/settings");
            }}
            onOpenSavedDiagrams={() => {
              void navigateWithSave("/saved-diagrams");
            }}
            onOpenPostee={() => {
              void navigateWithSave("/postee");
            }}
          >
            {opyPanel}
          </OpyFloatingWidget>
        )}
```

- [ ] **Step 8: Render drawer only in drawer host mode**

Near the existing `DataBar` bottom-row render, make drawer take precedence over `DataBar`:

```tsx
      {opyHostMode === "drawer" && (
        <OpyDrawer
          diagramName={state.context.diagramName}
          nodeCount={state.context.nodes.length}
          edgeCount={state.context.edges.length}
          chromeTone={opyChromeTone}
          onCollapse={toggleOpyCopilot}
          onSwitchToFloating={() => {
            void runEffect(patchSettings({ opySurfaceMode: "floating" }));
          }}
        >
          {opyPanel}
        </OpyDrawer>
      )}

      {opyHostMode !== "drawer" && isDataBarOpen && (
        <DataBar
          isOpen={isDataBarOpen}
          onToggle={setDataBarOpen}
          onLoadDiagram={handleLoadDiagram}
        />
      )}
```

Also hide the data-bar bottom handle while the OPY drawer is open:

```tsx
        {opyHostMode !== "drawer" && !isDataBarOpen && (
          <ToggleButton
            isSelected={isDataBarOpen}
            onChange={(selected) => setDataBarOpen(selected)}
            className={styles.bottomHandle}
            aria-label="Expand data bar"
          >
            <CaretUpIcon size={16} weight="bold" />
          </ToggleButton>
        )}
```

- [ ] **Step 9: Run focused tests**

Run:

```bash
bun run test:run test/components/OpySurfaceMode.test.tsx src/ui/components/OpyDrawer.test.tsx
```

Expected: pass.

- [ ] **Step 10: Commit**

```bash
git add src/ui/components/C4CanvasContainer.tsx test/components/OpySurfaceMode.test.tsx
git commit -m "feat: route opy through drawer or floating host"
```

---

### Task 4: Add Drawer/Floating Controls To Existing Board UX

**Files:**
- Modify: `src/ui/components/C4CanvasContainer.tsx`
- Modify: `src/ui/components/Toolbar.tsx`
- Test: `test/components/OpySurfaceMode.test.tsx`

- [ ] **Step 1: Write pure behavior tests for switching intent**

Extend `test/components/OpySurfaceMode.test.tsx`:

```ts
import { getNextOpySurfaceMode } from "../../src/ui/components/C4CanvasContainer";

describe("getNextOpySurfaceMode", () => {
  it("switches drawer to floating", () => {
    expect(getNextOpySurfaceMode("drawer")).toBe("floating");
  });

  it("switches floating to drawer", () => {
    expect(getNextOpySurfaceMode("floating")).toBe("drawer");
  });
});
```

- [ ] **Step 2: Run behavior test and verify red**

Run:

```bash
bun run test:run test/components/OpySurfaceMode.test.tsx
```

Expected: fail because `getNextOpySurfaceMode` is not exported.

- [ ] **Step 3: Add toggle helper**

In `src/ui/components/C4CanvasContainer.tsx`, add near `resolveOpyHostMode`:

```ts
export const getNextOpySurfaceMode = (
  currentMode: "drawer" | "floating",
): "drawer" | "floating" => currentMode === "drawer" ? "floating" : "drawer";
```

- [ ] **Step 4: Run behavior test and verify green**

Run:

```bash
bun run test:run test/components/OpySurfaceMode.test.tsx
```

Expected: pass.

- [ ] **Step 5: Add a toolbar affordance without overloading OPY visibility**

In `src/ui/components/Toolbar.tsx`, extend props:

```ts
  opySurfaceMode: "drawer" | "floating";
  onToggleOpySurfaceMode: () => void;
```

Add the destructured props:

```ts
  opySurfaceMode,
  onToggleOpySurfaceMode,
```

Add a button near other workspace controls:

```tsx
      <button
        type="button"
        className={toolbarButton}
        onClick={onToggleOpySurfaceMode}
      >
        <RobotIcon size={20} weight="duotone" />
        {opySurfaceMode === "drawer" ? "OPY::DRAWER" : "OPY::FLOAT"}
      </button>
```

`RobotIcon` is already imported by `C4CanvasContainer`, but `Toolbar.tsx` needs it added to the Phosphor import list.

- [ ] **Step 6: Pass toolbar mode props from container**

In the `Toolbar` usage inside `src/ui/components/C4CanvasContainer.tsx`, add:

```tsx
          opySurfaceMode={appSettings.opySurfaceMode}
          onToggleOpySurfaceMode={() => {
            void runEffect(
              patchSettings({
                opySurfaceMode: getNextOpySurfaceMode(appSettings.opySurfaceMode),
              }),
            );
          }}
```

- [ ] **Step 7: Update drawer switch action to reuse helper**

In the drawer `onSwitchToFloating`, use:

```tsx
          onSwitchToFloating={() => {
            void runEffect(
              patchSettings({
                opySurfaceMode: "floating",
              }),
            );
          }}
```

Keep this explicit because the drawer button is not a toggle; it always moves to floating mode.

- [ ] **Step 8: Run focused tests**

Run:

```bash
bun run test:run test/components/OpySurfaceMode.test.tsx src/ui/components/OpyDrawer.test.tsx
```

Expected: pass.

- [ ] **Step 9: Commit**

```bash
git add src/ui/components/C4CanvasContainer.tsx src/ui/components/Toolbar.tsx test/components/OpySurfaceMode.test.tsx
git commit -m "feat: add opy drawer floating mode controls"
```

---

### Task 5: Verify App-Level Behavior And Build Health

**Files:**
- Modify only if the checks expose an issue directly caused by Tasks 1-4.

- [ ] **Step 1: Run the full Vitest suite**

Run:

```bash
bun run test:run
```

Expected: all test files pass.

- [ ] **Step 2: Run frontend build**

Run:

```bash
bun run build
```

Expected: build exits 0. Existing warnings about deprecated icons, Effect untagged errors, large chunks, browser externalization, or `*.css.ts` route warnings may remain if unchanged by this slice.

- [ ] **Step 3: Manual smoke in dev server**

Run:

```bash
bun run dev
```

Expected: Astro dev server starts. Open the local URL shown by Astro and verify:

1. OPY opens as a bottom drawer by default.
2. OPY drawer does not cover the canvas center.
3. Drawer collapse hides OPY without clearing the current session.
4. Toolbar mode control switches to floating mode.
5. Floating mode still renders the current `OpyFloatingWidget`.
6. Switching back to drawer mode renders only the drawer host.
7. The data bar does not render in the bottom row while OPY drawer is open.

- [ ] **Step 4: Commit any verification-only fixes**

If no code changes were needed after verification, skip this commit. If fixes were needed:

```bash
git add src test
git commit -m "fix: stabilize opy drawer integration"
```

---

## Self-Review Notes

- Spec coverage: The plan keeps the floating widget as a secondary mode, adds a default conventional drawer mode, reuses the bottom-panel language, prevents duplicated OPY panel mounts, and coordinates with the existing data bar.
- Placeholder scan: No deferred implementation markers are present.
- Type consistency: The plan consistently uses `opySurfaceMode`, `"drawer" | "floating"`, `resolveOpyHostMode`, and `getNextOpySurfaceMode`.
- Scope check: The slice intentionally does not redesign the internals of `OpyCopilotPanel`; it rehosts the existing panel first to reduce risk.
