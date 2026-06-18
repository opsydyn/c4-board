---
title: "Editable Edge Labels - Implementation Plan"
---

# Editable Edge Labels - Implementation Plan

## Current State

**Problem**: Edge labels are hardcoded to `"uses"` in the canvas machine

**Location**:
- [canvas.machine.ts:257](src/ui/machines/canvas.machine.ts#L257): `"uses"` hardcoded in CONNECT_NODES action
- [edge-operations.ts:85,167,188](src/core/effects/edge-operations.ts): Functions accept `label` parameter but always default to `"uses"`

**Current Flow**:
```
User connects nodes visually
  ↓
ReactFlow onConnect event
  ↓
Machine sends CONNECT_NODES event
  ↓
EdgeOps.addValidatedEdge(edges, source, target, "uses") ← Hardcoded!
  ↓
Edge created with label="uses"
```

## Goal

Allow users to:
1. **Create edges with custom labels** when connecting nodes
2. **Edit existing edge labels** by clicking/selecting them
3. **Persist labels** to database with diagram
4. **Default to "uses"** when no label is specified (current behavior)

## Architecture: Functional Core, Imperative Shell

Following the codebase pattern:

### **Functional Core** (Effect Services)
- ✅ Already supports custom labels via `label` parameter
- `createEdge(source, target, label)` - Pure function
- `createValidatedEdge(edges, source, target, label)` - Pure function
- `addValidatedEdge(edges, source, target, label)` - Pure function
- **New function needed**: `updateEdgeLabel(edges, edgeId, label)` - Pure function

### **Imperative Shell** (XState Machine)
- **New events**:
  - `UPDATE_EDGE_LABEL` - Update an existing edge's label
- **Modified events**:
  - `CONNECT_NODES` - Add optional `label` parameter
- **New actions**:
  - `updateEdgeLabel` - Call EdgeOps.updateEdgeLabel and update context

### **UI Layer** (React Components)
- **EdgeLabelEditor** - New component for editing labels
- **C4Canvas** - Handle edge selection and edit mode

## Implementation Plan

### Phase 1: Functional Core (30 min)

**File**: `src/core/effects/edge-operations.ts`

```typescript
/**
 * Update the label of an existing edge
 */
export const updateEdgeLabel = (
  edges: Edge[],
  edgeId: string,
  label: string,
): Effect.Effect<Edge[], EdgeValidationError> => {
  return Effect.gen(function* () {
    const edge = yield* findEdgeById(edges, edgeId);

    if (!edge) {
      return yield* Effect.fail(
        new EdgeValidationError({
          message: `Edge with ID ${edgeId} not found`
        }),
      );
    }

    // Validate label (non-empty, max length, etc.)
    if (!label || label.trim().length === 0) {
      return yield* Effect.fail(
        new EdgeValidationError({
          message: "Edge label cannot be empty"
        }),
      );
    }

    if (label.length > 100) {
      return yield* Effect.fail(
        new EdgeValidationError({
          message: "Edge label too long (max 100 characters)"
        }),
      );
    }

    // Update the edge
    const updatedEdges = edges.map((e) =>
      e.id === edgeId ? { ...e, label } : e
    );

    return Effect.succeed(updatedEdges);
  });
};
```

**Tests**: `src/core/effects/edge-operations.test.ts`
- Test label validation
- Test updating existing edge
- Test edge not found error
- Test empty label error
- Test label too long error

### Phase 2: XState Machine (30 min)

**File**: `src/ui/machines/canvas.machine.ts`

**1. Add new event type**:
```typescript
export type CanvasEvent =
  | ... // existing events
  | {
      type: "CONNECT_NODES";
      source: string;
      target: string;
      label?: string; // Optional custom label
    }
  | {
      type: "UPDATE_EDGE_LABEL";
      edgeId: string;
      label: string;
    }
```

**2. Update connectNodes action**:
```typescript
connectNodes: assign({
  edges: ({ context, event }) => {
    if (event.type !== "CONNECT_NODES") return context.edges;

    // Use custom label or default to "uses"
    const label = event.label ?? "uses";

    const result = Effect.runSync(
      Effect.gen(function* () {
        return yield* EdgeOps.addValidatedEdge(
          context.edges,
          event.source,
          event.target,
          label, // Pass label from event
        ).pipe(
          Effect.catchAll(() => Effect.succeed(context.edges)),
        );
      }),
    );

    return result;
  },
}),
```

**3. Add new updateEdgeLabel action**:
```typescript
updateEdgeLabel: assign({
  edges: ({ context, event }) => {
    if (event.type !== "UPDATE_EDGE_LABEL") return context.edges;

    const result = Effect.runSync(
      Effect.gen(function* () {
        return yield* EdgeOps.updateEdgeLabel(
          context.edges,
          event.edgeId,
          event.label,
        ).pipe(
          Effect.catchAll(() => Effect.succeed(context.edges)),
        );
      }),
    );

    return result;
  },
}),
```

**4. Add handler in ready state**:
```typescript
ready: {
  on: {
    // ... existing handlers
    UPDATE_EDGE_LABEL: {
      actions: "updateEdgeLabel",
    },
  },
},
```

**Tests**: `src/ui/machines/canvas.machine.test.ts`
- Test CONNECT_NODES with custom label
- Test CONNECT_NODES with default label
- Test UPDATE_EDGE_LABEL success
- Test UPDATE_EDGE_LABEL validation failure

### Phase 3: UI Component - Edge Label Editor (1 hour)

**File**: `src/ui/components/EdgeLabelEditor.tsx`

```typescript
import { useState, useCallback } from "react";
import { Button, TextField, Input, Label, Dialog } from "react-aria-components";
import { edgeEditor, edgeEditorInput, edgeEditorButtons } from "./EdgeLabelEditor.css";

interface EdgeLabelEditorProps {
  readonly edgeId: string;
  readonly currentLabel: string;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (edgeId: string, label: string) => void;
}

export function EdgeLabelEditor({
  edgeId,
  currentLabel,
  isOpen,
  onClose,
  onSave,
}: EdgeLabelEditorProps) {
  const [label, setLabel] = useState(currentLabel);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(() => {
    const trimmed = label.trim();

    if (!trimmed) {
      setError("Label cannot be empty");
      return;
    }

    if (trimmed.length > 100) {
      setError("Label too long (max 100 characters)");
      return;
    }

    onSave(edgeId, trimmed);
    onClose();
  }, [edgeId, label, onSave, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      onClose();
    }
  }, [handleSave, onClose]);

  if (!isOpen) return null;

  return (
    <Dialog isOpen={isOpen} onOpenChange={onClose} className={edgeEditor}>
      <h3>Edit Relationship Label</h3>
      <TextField isRequired>
        <Label>Relationship Type</Label>
        <Input
          className={edgeEditorInput}
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder="uses, calls, reads from, writes to..."
          autoFocus
        />
      </TextField>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <div className={edgeEditorButtons}>
        <Button onPress={onClose}>Cancel</Button>
        <Button onPress={handleSave}>Save</Button>
      </div>
    </Dialog>
  );
}
```

**File**: `src/ui/components/EdgeLabelEditor.css.ts`

```typescript
import { style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";

export const edgeEditor = style({
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  backgroundColor: theme.color.background.base,
  border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
  borderRadius: theme.border.radius.lg,
  padding: theme.spacing["6"],
  boxShadow: theme.effect.glow.lg,
  zIndex: 1000,
  minWidth: "400px",
});

export const edgeEditorInput = style({
  width: "100%",
  height: "40px",
  borderRadius: theme.border.radius.base,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: theme.color.background.input,
  color: theme.color.foreground.primary,
  padding: `0 ${theme.spacing["3"]}`,
  fontFamily: theme.typography.family.sans,
  fontSize: theme.typography.size.base,
});

export const edgeEditorButtons = style({
  display: "flex",
  gap: theme.spacing["2"],
  justifyContent: "flex-end",
  marginTop: theme.spacing["4"],
});
```

### Phase 4: Integrate with C4Canvas (45 min)

**File**: `src/ui/components/C4Canvas.tsx`

**1. Add edge selection state**:
```typescript
const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
const [isEdgeLabelEditorOpen, setIsEdgeLabelEditorOpen] = useState(false);
```

**2. Add edge click handler**:
```typescript
const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
  setSelectedEdgeId(edge.id);
  setIsEdgeLabelEditorOpen(true);
}, []);
```

**3. Add save handler**:
```typescript
const handleSaveEdgeLabel = useCallback((edgeId: string, label: string) => {
  // Send event to machine
  send({ type: "UPDATE_EDGE_LABEL", edgeId, label });
}, [send]);
```

**4. Add to ReactFlow props**:
```typescript
<ReactFlow
  // ... existing props
  onEdgeClick={handleEdgeClick}
>
```

**5. Render EdgeLabelEditor**:
```typescript
{selectedEdgeId && (
  <EdgeLabelEditor
    edgeId={selectedEdgeId}
    currentLabel={edges.find(e => e.id === selectedEdgeId)?.label ?? "uses"}
    isOpen={isEdgeLabelEditorOpen}
    onClose={() => {
      setIsEdgeLabelEditorOpen(false);
      setSelectedEdgeId(null);
    }}
    onSave={handleSaveEdgeLabel}
  />
)}
```

### Phase 5: Testing & Polish (30 min)

1. **Manual Testing**:
   - Create connection → Default "uses" label
   - Click edge → Editor opens with current label
   - Edit label → Save → Label updates on canvas
   - Try empty label → Error shown
   - Try very long label → Error shown
   - Save diagram → Reload → Labels persist

2. **Unit Tests**:
   - Run existing test suite (should pass)
   - Add new tests for updateEdgeLabel
   - Add machine tests for UPDATE_EDGE_LABEL event

3. **Polish**:
   - Add common relationship suggestions (dropdown?)
   - Add keyboard shortcut (e.g., "E" to edit selected edge)
   - Add inline editing on double-click
   - Style edge labels to match design system

## Future Enhancements (Phase 6+)

- **Relationship Templates**: Predefined relationships (uses, calls, contains, etc.)
- **Inline Editing**: Double-click edge label to edit in place
- **Bulk Edit**: Edit multiple edge labels at once
- **Edge Styling**: Different colors/styles per relationship type
- **Validation Rules**: Enforce specific relationships between node types
- **Import/Export**: Include edge labels in diagram export

## Files Modified

### Functional Core
- ✅ `src/core/effects/edge-operations.ts` - Add updateEdgeLabel function
- ✅ `src/core/effects/edge-operations.test.ts` - Add tests

### Imperative Shell
- ✅ `src/ui/machines/canvas.machine.ts` - Add UPDATE_EDGE_LABEL event and action
- ✅ `src/ui/machines/canvas.machine.test.ts` - Add tests

### UI Layer
- ✅ `src/ui/components/EdgeLabelEditor.tsx` - New component
- ✅ `src/ui/components/EdgeLabelEditor.css.ts` - New styles
- ✅ `src/ui/components/C4Canvas.tsx` - Integrate editor

## Estimated Time

- **Phase 1**: 30 min (Functional Core)
- **Phase 2**: 30 min (XState Machine)
- **Phase 3**: 1 hour (UI Component)
- **Phase 4**: 45 min (Integration)
- **Phase 5**: 30 min (Testing & Polish)

**Total**: ~3 hours 15 minutes

## Success Criteria

✅ Users can click an edge to edit its label
✅ Labels validate (non-empty, max length)
✅ Labels persist when diagram is saved/loaded
✅ Default to "uses" when no label specified
✅ All existing tests pass
✅ New tests cover edge label functionality
✅ Follows Functional Core, Imperative Shell pattern
✅ Uses React Aria for accessibility
✅ Matches existing design system

---

**Ready to implement!** Let me know if you want to proceed or if you'd like to adjust the plan.
