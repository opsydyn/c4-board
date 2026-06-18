---
title: "C4 Diagram Editor - MVP Project Plan"
---

# C4 Diagram Editor - MVP Project Plan

## 🎯 MVP Goal
Build a **minimal viable C4 diagram editor** with:
- Canvas for creating System Context diagrams (C4 Level 1)
- 4 node types: Person, Software System, External System, Relationship
- Local persistence (browser storage)
- Basic export to SVG
- Clean separation: Effect for logic, XState for UI flows

**Out of scope for MVP:**
- Licensing system
- Yjs collaboration
- Container/Component/Code diagrams (C4 Levels 2-4)
- PDF export
- Auto-updater

---

## 📋 Phase Breakdown

### Phase 1: Foundation & Canvas (Week 1)
**Goal:** Get a working ReactFlow canvas with basic C4 nodes

#### 1.1 Project Structure Setup
- [ ] Create folder structure:
  ```
  src/
    ui/
      components/     # ReactFlow nodes, toolbar, panels
      machines/       # XState machines
    core/
      effects/        # Effect modules
      schema/         # Zod schemas for C4 types
    pages/
      canvas.astro    # Main canvas page
  ```
- [ ] Set up TypeScript path aliases in `tsconfig.json`

#### 1.2 C4 Schema & Types
- [ ] Define Zod schemas for C4 entities:
  - `Person` (name, description, technology)
  - `SoftwareSystem` (name, description, technology, external: boolean)
  - `Relationship` (from, to, description, technology)
- [ ] Create TypeScript types from schemas
- [ ] Export `C4Model` type (collection of nodes + edges)

#### 1.3 Basic Canvas Component
- [ ] Create `C4Canvas.tsx` React component using `@xyflow/react`
- [ ] Implement custom node components:
  - `PersonNode.tsx` (styled as blue box with icon)
  - `SystemNode.tsx` (styled as gray box)
  - `ExternalSystemNode.tsx` (styled as gray box with dashed border)
- [ ] Add basic edge styling for relationships
- [ ] Wire up to Astro page at `/canvas`

#### 1.4 Toolbar Component
- [ ] Create `Toolbar.tsx` with buttons to add each node type
- [ ] Implement drag-to-canvas or click-to-add functionality
- [ ] Add delete selected node button

**Deliverable:** Working canvas where you can add/remove C4 nodes

---

### Phase 2: State Management (Week 2)
**Goal:** Integrate XState for canvas interactions & Effect for business logic

#### 2.1 Canvas XState Machine
- [ ] Create `canvasMachine.ts` with states:
  ```
  idle → selecting → editing → saving
  ```
- [ ] Context holds: `nodes[]`, `edges[]`, `selectedNode`
- [ ] Events: `ADD_NODE`, `DELETE_NODE`, `SELECT_NODE`, `UPDATE_NODE`, `SAVE`
- [ ] Actions: update context, trigger effects

#### 2.2 Effect Service Layer
- [ ] Create `ProjectService.ts` with Effect operations:
  - `loadProject: Effect<void, Error, C4Model>`
  - `saveProject: (model: C4Model) => Effect<void, Error, void>`
  - `exportSVG: (model: C4Model) => Effect<void, Error, string>`
- [ ] For MVP, use browser `localStorage` (not Tauri commands yet)
- [ ] Wrap localStorage calls in `Effect.tryPromise`

#### 2.3 Connect XState + Effect
- [ ] Integrate `canvasMachine` into `C4Canvas` via `useMachine`
- [ ] On `SAVE` event, invoke Effect's `saveProject`
- [ ] On component mount, invoke Effect's `loadProject`
- [ ] Handle loading/error states in machine

#### 2.4 Properties Panel
- [ ] Create `PropertiesPanel.tsx` to edit selected node
- [ ] Show when `selectedNode` is not null
- [ ] Fields: name, description, technology (text inputs)
- [ ] Send `UPDATE_NODE` event on change

**Deliverable:** Canvas with persistent state, editable properties

---

### Phase 3: Persistence & Auto-Layout (Week 3)
**Goal:** Save/load projects + auto-arrange nodes

#### 3.1 Tauri File Operations
- [ ] Add Rust commands to `lib.rs`:
  ```rust
  read_project(path: String) -> Result<String, String>
  write_project(path: String, data: String) -> Result<(), String>
  ```
- [ ] Update `ProjectService` to use Tauri `invoke` instead of localStorage
- [ ] Add file picker integration (Tauri dialog API)

#### 3.2 Project Machine
- [ ] Create `projectMachine.ts` with states:
  ```
  new → open → editing → saving → saved
  ```
- [ ] Events: `NEW_PROJECT`, `OPEN_PROJECT`, `SAVE_PROJECT`, `SAVE_AS`
- [ ] Integrate with file dialogs

#### 3.3 Auto-Layout
- [ ] Create `LayoutService.ts` using `dagre`:
  - `autoLayout: (model: C4Model) => Effect<void, Error, C4Model>`
- [ ] Add "Auto Layout" button to toolbar
- [ ] Trigger layout on button click via machine

#### 3.4 Menu Bar
- [ ] Create `MenuBar.tsx` with:
  - New Project
  - Open Project
  - Save / Save As
  - Export SVG
- [ ] Wire menu actions to `projectMachine` events

**Deliverable:** Full project lifecycle (new/open/save) + auto-layout

---

### Phase 4: Export & Polish (Week 4)
**Goal:** SVG export + UI refinements

#### 4.1 SVG Export
- [ ] Implement `exportSVG` in `ProjectService`:
  - Use ReactFlow's `toSvg()` or custom SVG generation
  - Save via Tauri file dialog
- [ ] Add export button to menu bar
- [ ] Test export with complex diagrams

#### 4.2 Styling & UX
- [ ] Create Vanilla Extract theme for C4 colors:
  - Person: `#08427B` (blue)
  - System: `#1168BD` (lighter blue)
  - External: `#999999` (gray)
  - Relationships: dashed lines with labels
- [ ] Add icons from `@phosphor-icons/react`
- [ ] Improve node styling (shadows, borders)
- [ ] Add keyboard shortcuts (delete, save, undo)

#### 4.3 Validation & Error Handling
- [ ] Validate node data with Zod schemas before save
- [ ] Show error toast on validation failure (use XState context)
- [ ] Prevent duplicate node IDs
- [ ] Handle corrupted project files gracefully

#### 4.4 Documentation
- [ ] Update `CLAUDE.md` with C4-specific architecture
- [ ] Add inline JSDoc to Effect services
- [ ] Create user guide in `docs/USER_GUIDE.md`

**Deliverable:** Production-ready MVP

---

## 🗂️ File Structure (Final)

```
src/
  ui/
    components/
      C4Canvas.tsx              # Main ReactFlow canvas
      nodes/
        PersonNode.tsx
        SystemNode.tsx
        ExternalSystemNode.tsx
      Toolbar.tsx               # Add node buttons
      PropertiesPanel.tsx       # Edit selected node
      MenuBar.tsx               # File operations
    machines/
      canvasMachine.ts          # Canvas interaction state
      projectMachine.ts         # Project lifecycle state
  core/
    effects/
      ProjectService.ts         # Load/save/export effects
      LayoutService.ts          # Dagre auto-layout
    schema/
      c4.ts                     # Zod schemas + types
  pages/
    canvas.astro                # Main app page
  styles/
    theme.css.ts                # C4 color palette
    canvas.css.ts               # Canvas-specific styles

src-tauri/
  src/
    lib.rs                      # File I/O commands
    commands/
      project.rs                # Project file operations
```

---

## 🧪 Testing Strategy

### Phase 1-2 (Manual)
- Click through adding/removing nodes
- Verify localStorage persistence across refreshes

### Phase 3-4 (Semi-Automated)
- [ ] Add Vitest tests for Effect services
- [ ] Mock Tauri `invoke` calls in tests
- [ ] XState test plans for machines
- [ ] Rust unit tests for file operations

---

## 🚀 Launch Checklist

- [ ] Canvas renders and is interactive
- [ ] Can add all 4 C4 element types
- [ ] Properties panel updates node data
- [ ] Save/load works with Tauri file system
- [ ] Auto-layout arranges nodes intelligently
- [ ] SVG export produces valid output
- [ ] No console errors in production build
- [ ] Basic keyboard shortcuts work
- [ ] Error states handled gracefully

---

## 📊 Success Metrics

**MVP is successful if:**
1. User can create a System Context diagram in < 5 minutes
2. Diagram persists across app restarts
3. SVG export can be imported to other tools
4. No crashes during normal usage
5. Code is maintainable (Effect + XState separation)

---

## 🔮 Post-MVP Roadmap

**Phase 5: Advanced Features**
- Container diagrams (C4 Level 2)
- Component diagrams (C4 Level 3)
- Undo/redo with Immer or Effect
- Themes (light/dark mode)

**Phase 6: Collaboration**
- Yjs real-time collaboration
- Conflict resolution

**Phase 7: Monetization**
- License key verification (Lemon Squeezy)
- Premium features (PDF export, cloud sync)

---

## 💡 Key Architectural Principles

### **FUNCTIONAL CORE, IMPERATIVE SHELL** ⭐

This is the **non-negotiable foundation** of our architecture:

**Functional Core (Effect):**
- Pure business logic with **zero side effects in the code**
- All domain operations return `Effect<Env, Error, Result>`
- Contains: validation, transformation, business rules, data modeling
- **NO**: DOM manipulation, HTTP calls, file I/O, `invoke()`, `localStorage`, etc.
- Lives in `src/core/effects/`
- **100% testable without mocks**

**Imperative Shell (XState + Tauri):**
- Orchestrates **when** to execute effects
- Manages user interaction flows and state transitions
- Bridges to native capabilities via Tauri commands
- Contains: state machines, UI event handlers, Rust FFI
- Lives in `src/ui/machines/` and `src-tauri/`

**The Boundary:**
```
┌─────────────────────────────────────────────────────────────┐
│  IMPERATIVE SHELL (React + XState)                          │
│  • User clicks "Save" button                                │
│  • send({ type: 'SAVE' }) to canvasMachine                  │
│  • Machine transitions: editing → saving                    │
│  • Invokes Effect: ProjectService.saveProject(model)        │
├─────────────────────────────────────────────────────────────┤
│  FUNCTIONAL CORE (Effect)                                   │
│                                                              │
│  export const saveProject = (model: C4Model) =>             │
│    Effect.gen(function*(_) {                                │
│      yield* _(validate(model))        // Pure validation    │
│      const json = yield* _(serialize(model)) // Pure fn     │
│      return yield* _(writeToDisk(json))  // Effect wrapper  │
│    })                                                        │
│                                                              │
│  • Contains ZERO: invoke(), fetch(), localStorage, DOM      │
│  • Returns Effect<void, SaveError, void>                    │
├─────────────────────────────────────────────────────────────┤
│  IMPERATIVE SHELL (Tauri Runtime)                           │
│  • Effect.runPromise(saveProject(model))                    │
│  • Executes: invoke('write_project', { path, data })        │
│  • Rust writes bytes to filesystem                          │
│  • Returns Result<(), String> to Effect runtime             │
│  • Effect translates to success/error                       │
│  • XState transitions: saving → saved (or → error)          │
│  • React re-renders UI (show "Saved!" toast)                │
└─────────────────────────────────────────────────────────────┘
```

**Layer Responsibilities:**

1. **Effect for "what"** — pure business logic, composable operations
2. **XState for "when"** — orchestrate user flows, async coordination
3. **Tauri for "how"** — native file I/O, crypto, system integration
4. **React for "view"** — UI is just a function of state

**Benefits:**
- Core logic is **portable** (could swap React for Vue, XState for Zustand)
- Effects are **testable** without mocking Tauri/file system
- Complexity is **isolated** (business rules vs UI flows vs I/O)
- Debugging is **easier** (pure functions + state machines visualized)

**Decision Flow Example:**
```
User clicks "Save"
  → React onClick handler
  → send({ type: 'SAVE' }) to XState machine
  → Machine state: editing → saving
  → Invokes Effect: ProjectService.saveProject(model)
  → Effect pipeline:
      1. Validate model (pure)
      2. Serialize to JSON (pure)
      3. WriteToDisk effect (wraps Tauri invoke)
  → Tauri invoke('write_project', { path, json })
  → Rust std::fs::write(path, json)
  → Returns Ok(()) or Err(e)
  → Effect resolves or rejects
  → Machine transitions: saving → saved (or → error)
  → React re-renders: show toast notification
```

---

## 🛠️ Developer Commands

```bash
# Start dev mode
npm run tauri dev

# Type check only
npm run astro check

# Build for production
npm run tauri build

# Run tests
npx vitest

# Lint
npx eslint .
```

---

## 📚 References

- [C4 Model Specification](https://c4model.com/)
- [ReactFlow Docs](https://reactflow.dev/)
- [Effect Documentation](https://effect.website/)
- [XState Docs](https://stately.ai/docs/xstate)
- [Tauri v2 Guide](https://beta.tauri.app/)
