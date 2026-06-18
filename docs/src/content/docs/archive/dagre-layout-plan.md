---
title: "🎯 DAGRE AUTO-LAYOUT FOR TACTICAL C4 BOARDS"
---

# 🎯 DAGRE AUTO-LAYOUT FOR TACTICAL C4 BOARDS

## Why Dagre?
**Dagre** = Directed Acyclic Graph Rendering Engine

Perfect for C4 diagrams because it:
- ✅ Auto-arranges nodes in hierarchical layers
- ✅ Minimizes edge crossings
- ✅ Creates military-style flowchart layouts
- ✅ Supports **top-to-bottom** or **left-to-right** flows
- ✅ Orthogonal routing (90° angles only - military style!)

---

## 🎛️ TACTICAL UX IMPROVEMENTS WITH DAGRE

### **1. Auto-Arrange Command** (⌘L)
**Feature**: Press ⌘L to automatically organize the entire diagram

**Use Cases**:
- Messy diagram after adding many nodes
- Quick cleanup before presentation
- Standard operating procedure for documentation

**Layout**:
```
BEFORE (Manual mess):
Person ─→ System
    ↓      ↓
External ← Container

AFTER (Dagre auto-arrange):
┌─ Layer 1 ─┐
│  Person   │
└───────────┘
      ↓
┌─ Layer 2 ─┐
│  System   │
└───────────┘
      ↓
┌─ Layer 3 ─┐
│ Container │
└───────────┘
```

### **2. Hierarchical Flow Modes**
**Tactical Layouts**:
- `TB` = Top-to-Bottom (Command chain)
- `LR` = Left-to-Right (Timeline view)
- `BT` = Bottom-to-Top (Dependency tree)
- `RL` = Right-to-Left (Data flow)

### **3. Smart Node Spacing**
**Military Grid Alignment**:
- Snap to 20px tactical grid
- Consistent spacing between layers
- Uniform node separation
- Clean, readable layouts

### **4. Orthogonal Edge Routing**
**90° Angles Only** (No curves):
```
System
   │
   ├─→ Container
   │
   └─→ External
```

Perfect for:
- Circuit diagrams
- Flowcharts
- Military command structures
- Technical documentation

---

## 🚀 IMPLEMENTATION PLAN

### **Step 1: Layout Service** (Functional Core)
Create pure layout logic using Dagre:

```typescript
// src/core/effects/layout.ts

import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";

export interface LayoutOptions {
  direction: "TB" | "LR" | "BT" | "RL";
  nodeSpacing: number;
  rankSpacing: number;
  edgeSpacing: number;
  snapToGrid?: boolean;
  gridSize?: number;
}

const DEFAULT_OPTIONS: LayoutOptions = {
  direction: "TB",        // Top-to-bottom
  nodeSpacing: 50,        // Horizontal spacing
  rankSpacing: 100,       // Vertical layer spacing
  edgeSpacing: 10,        // Edge separation
  snapToGrid: true,       // Snap to tactical grid
  gridSize: 20,           // 20px grid
};

export function autoLayout(
  nodes: Node[],
  edges: Edge[],
  options: Partial<LayoutOptions> = {}
): Node[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Create Dagre graph
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));

  // Configure layout
  graph.setGraph({
    rankdir: opts.direction,
    nodesep: opts.nodeSpacing,
    ranksep: opts.rankSpacing,
    edgesep: opts.edgeSpacing,
  });

  // Add nodes to graph
  nodes.forEach((node) => {
    graph.setNode(node.id, {
      width: node.measured?.width || 220,
      height: node.measured?.height || 150,
    });
  });

  // Add edges
  edges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  // Run layout algorithm
  dagre.layout(graph);

  // Apply positions to nodes
  return nodes.map((node) => {
    const position = graph.node(node.id);

    let x = position.x - (node.measured?.width || 220) / 2;
    let y = position.y - (node.measured?.height || 150) / 2;

    // Snap to grid
    if (opts.snapToGrid && opts.gridSize) {
      x = Math.round(x / opts.gridSize) * opts.gridSize;
      y = Math.round(y / opts.gridSize) * opts.gridSize;
    }

    return {
      ...node,
      position: { x, y },
    };
  });
}

// Preset layouts for different use cases
export const TACTICAL_PRESETS = {
  // Command chain (top-down hierarchy)
  command: { direction: "TB" as const, rankSpacing: 120 },

  // Data flow (left-to-right)
  dataFlow: { direction: "LR" as const, nodeSpacing: 100 },

  // Dependency tree (bottom-up)
  dependencies: { direction: "BT" as const },

  // Compact (minimal spacing)
  compact: { nodeSpacing: 30, rankSpacing: 60 },

  // Presentation (spacious)
  presentation: { nodeSpacing: 80, rankSpacing: 150 },
};
```

### **Step 2: Add to Canvas Machine**
Add layout event to XState machine:

```typescript
// src/ui/machines/canvas.machine.ts

// Add to events:
{ type: "AUTO_LAYOUT"; options?: Partial<LayoutOptions> }

// Add to actions:
actions: {
  applyLayout: assign({
    nodes: ({ context, event }) => {
      if (event.type !== "AUTO_LAYOUT") return context.nodes;
      return autoLayout(context.nodes, context.edges, event.options);
    },
  }),
}

// Add to state:
on: {
  AUTO_LAYOUT: {
    actions: ["applyLayout"],
  },
}
```

### **Step 3: Toolbar Button**
Add auto-layout button:

```tsx
// Add to Toolbar.tsx
<button
  type="button"
  className={toolbarButton}
  onClick={onAutoLayout}
  title="Auto-arrange (⌘L)"
>
  <GridIcon size={20} weight="duotone" />
  AUTO-LAYOUT
</button>
```

### **Step 4: Keyboard Shortcut**
Add ⌘L shortcut:

```typescript
// In C4CanvasContainer.tsx
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "l") {
      e.preventDefault();
      send({ type: "AUTO_LAYOUT" });
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [send]);
```

---

## 🎯 TACTICAL UX FEATURES

### **Feature 1: Layout Presets Menu**
```
┌─ LAYOUT ─────────────────┐
│ ⌘L AUTO-ARRANGE          │
│ ──────────────────────── │
│ □ COMMAND (TB)           │
│ □ DATA FLOW (LR)         │
│ □ DEPENDENCIES (BT)      │
│ □ COMPACT                │
│ □ PRESENTATION           │
└──────────────────────────┘
```

### **Feature 2: Smart Spacing**
```typescript
// Detect node type and adjust spacing
function getNodeSpacing(node: Node): number {
  switch (node.type) {
    case "person":
      return 80;  // More space for actors
    case "container":
      return 120; // Containers need room
    case "component":
      return 40;  // Components can be compact
    default:
      return 60;
  }
}
```

### **Feature 3: Layer Indicators**
Show which layer each node is on:

```
┌─ LAYER 1 ────────────────┐
│  ▸ PERSON (3 nodes)      │
└──────────────────────────┘
┌─ LAYER 2 ────────────────┐
│  ▸ SYSTEM (5 nodes)      │
└──────────────────────────┘
┌─ LAYER 3 ────────────────┐
│  ▸ CONTAINER (2 nodes)   │
└──────────────────────────┘
```

### **Feature 4: Undo Layout**
```typescript
// Store previous layout in context
context: {
  nodes: Node[],
  previousLayout: Node[] | null,
}

// Undo button (⌘Z after layout)
on: {
  UNDO_LAYOUT: {
    actions: assign({
      nodes: ({ context }) => context.previousLayout || context.nodes,
      previousLayout: null,
    }),
  },
}
```

### **Feature 5: Incremental Layout**
Only re-layout new nodes:

```typescript
export function incrementalLayout(
  existingNodes: Node[],
  newNodes: Node[],
  edges: Edge[]
): Node[] {
  // Keep positions of existing nodes
  // Only layout new nodes relative to existing

  const graph = new dagre.graphlib.Graph();

  // Lock existing positions
  existingNodes.forEach(node => {
    graph.setNode(node.id, {
      ...node.position,
      fixed: true,
    });
  });

  // Layout new nodes
  newNodes.forEach(node => {
    graph.setNode(node.id, { width: 220, height: 150 });
  });

  edges.forEach(edge => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  return [...existingNodes, ...newNodes.map(applyPosition)];
}
```

---

## 🎨 TACTICAL UI ADDITIONS

### **Layout Mode Indicator**
Show current layout mode in toolbar:

```
┌─ STATUS ─────────────────┐
│ MODE: COMMAND (TB)       │
│ GRID: 20px               │
│ SNAP: ●ON                │
└──────────────────────────┘
```

### **Layout Preview**
Show ghost preview before applying:

```typescript
const [previewNodes, setPreviewNodes] = useState<Node[] | null>(null);

function showLayoutPreview(options: LayoutOptions) {
  const preview = autoLayout(nodes, edges, options);
  setPreviewNodes(preview);

  // Show with opacity 0.5
  // Confirm or cancel
}
```

### **Compact Mode Toggle**
Quick switch between spacious and compact:

```
[ COMPACT ]  [ NORMAL ]  [ SPACIOUS ]
   60px        100px       150px
```

---

## 📋 IMPLEMENTATION CHECKLIST

### **Phase 1: Basic Auto-Layout** (1-2 hours)
- [ ] Create `layout.ts` service with Dagre
- [ ] Add `AUTO_LAYOUT` event to canvas machine
- [ ] Add toolbar button
- [ ] Add ⌘L keyboard shortcut
- [ ] Test with existing diagrams

### **Phase 2: Layout Presets** (1 hour)
- [ ] Create preset configurations
- [ ] Add preset selector dropdown
- [ ] Save last used preset to localStorage
- [ ] Add preset icons

### **Phase 3: Smart Features** (2 hours)
- [ ] Snap to grid (20px tactical grid)
- [ ] Undo layout (⌘Z)
- [ ] Layout preview mode
- [ ] Layer indicators
- [ ] Incremental layout for new nodes

### **Phase 4: Polish** (1 hour)
- [ ] Smooth animation during layout
- [ ] Layout mode indicator
- [ ] Compact/Spacious toggle
- [ ] Layout stats (layers, crossings)

---

## 🎯 EXPECTED RESULTS

### **Before Dagre**:
```
Nodes scattered randomly
Manual positioning required
Inconsistent spacing
Edge crossings everywhere
```

### **After Dagre**:
```
Clean hierarchical layers
Consistent grid alignment
Minimal edge crossings
Professional flowchart aesthetic
One-click organization
```

### **Tactical Benefits**:
- ✅ Faster diagram creation
- ✅ Consistent layouts
- ✅ Military-style flowcharts
- ✅ Professional documentation
- ✅ Grid-aligned precision
- ✅ Orthogonal routing

---

## 🚀 QUICK START

Want me to implement **Phase 1: Basic Auto-Layout** right now?

It will add:
1. Layout service with Dagre
2. ⌘L auto-arrange command
3. Toolbar button
4. Grid snapping

**Estimated time**: 30-45 minutes
**Impact**: 🔥🔥🔥 Immediate tactical improvement

Ready to execute?
