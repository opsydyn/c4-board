---
title: "Multi-Board + History Feature Plan"
---

# Multi-Board + History Feature Plan

## Current State Analysis

### Database Schema ✅
```
diagrams (current state - live working copy)
├── id, name, description
├── created_at, updated_at
└── nodes[], edges[] (via foreign keys)

history (snapshots - already exists!)
├── id, diagram_id, session_name
├── snapshot_data (JSON: nodes + edges)
└── created_at
```

### Current Issues
1. **All diagrams named "My C4 Diagram"** - no unique names
2. **No way to create new boards** - always loads/updates existing
3. **No way to restore from history** - history table exists but unused
4. **Save updates existing diagram** - doesn't create snapshots

## Architecture Design

### Multi-Board System

**Concept**: Each "board" is a unique diagram entry with unique name

```
Board = Diagram Entity
├── Unique ID (diagram-{timestamp})
├── User-defined Name (editable)
├── Description (optional)
├── Current State (nodes + edges in tables)
└── History (snapshots in history table)
```

### History/Snapshot System

**Concept**: Each save creates a snapshot in history table

```
Snapshot
├── ID (history-{timestamp})
├── diagram_id (FK to parent board)
├── session_name (user-defined or auto-generated)
├── snapshot_data (JSON of nodes + edges at save time)
└── created_at (when snapshot was created)
```

**Key Distinction**:
- `diagrams` table = **current/live state** of a board
- `nodes/edges` tables = **current/live content** of a board
- `history` table = **point-in-time snapshots** for rollback

## User Workflows

### Workflow 1: Create New Board
```
User clicks "New Board" button
  ↓
Modal/Dialog: "Enter board name"
  ↓
User enters: "Payment System Architecture"
  ↓
System creates new diagram entry
  ↓
System navigates to canvas with empty board
  ↓
User adds nodes/edges
  ↓
User clicks "Save" with optional session name
  ↓
System:
  1. Updates diagram.updated_at
  2. Saves nodes/edges to tables
  3. Creates snapshot in history
```

### Workflow 2: Switch Between Boards
```
User on canvas with "Payment System Architecture"
  ↓
User clicks "View Saved" (or "Switch Board")
  ↓
Shows table of all boards:
  | Name | Description | Nodes | Last Updated | Actions |
  |------|-------------|-------|--------------|---------|
  | Payment System | API Gateway | 10 | 2 hrs ago | [Load] |
  | Auth Service | OAuth Flow | 5 | 1 day ago | [Load] |
  ↓
User clicks [Load] on "Auth Service"
  ↓
System loads that diagram's current state
  ↓
Canvas displays Auth Service board
```

### Workflow 3: View/Restore History
```
User on canvas with "Payment System Architecture"
  ↓
User clicks "History" button
  ↓
Shows history for current board:
  | Session Name | Nodes | Edges | Created | Actions |
  |--------------|-------|-------|---------|---------|
  | v2.0 final | 10 | 8 | 1hr ago | [Restore] [View] |
  | v1.5 working | 8 | 6 | 3hr ago | [Restore] [View] |
  ↓
User clicks [Restore] on "v1.5 working"
  ↓
Confirmation: "Replace current state with v1.5 working?"
  ↓
System:
  1. Loads snapshot_data JSON
  2. Replaces current nodes/edges
  3. Updates diagram.updated_at
  4. User continues working from restored state
```

### Workflow 4: Named Snapshots
```
User working on board
  ↓
User enters session name: "v2.0 final"
  ↓
User clicks "Save"
  ↓
System:
  1. Updates current state (nodes/edges tables)
  2. Creates snapshot with name "v2.0 final"
  3. Shows: "Saved as v2.0 final"
```

## Database Schema Evaluation

### ✅ Current Schema Works!

**No changes needed**. The existing schema supports multi-board + history:

```sql
-- Multiple boards: Each diagram = separate board
diagrams (id, name, description, created_at, updated_at)

-- Current state: Nodes/edges for each board
nodes (diagram_id FK)
edges (diagram_id FK)

-- History: Snapshots for each board
history (diagram_id FK, session_name, snapshot_data JSON)
```

**Why it works**:
1. `diagrams.name` = board name (just need to make it editable/unique)
2. Foreign keys already isolate each board's content
3. `history` table already stores snapshots
4. `snapshot_data` JSON = frozen point-in-time state

### Optional Enhancements (Future)

**Add to diagrams table** (optional):
```sql
ALTER TABLE diagrams ADD COLUMN is_template BOOLEAN DEFAULT 0;
ALTER TABLE diagrams ADD COLUMN tags TEXT; -- JSON array
```

**Add to history table** (optional):
```sql
ALTER TABLE history ADD COLUMN description TEXT;
ALTER TABLE history ADD COLUMN snapshot_size INTEGER; -- node + edge count
```

## Implementation Plan

### Phase 1: Multi-Board Core (Priority 1)

**Goal**: User can create/name/switch between multiple boards

**Tasks**:
1. ✅ Fix initialization to load correct board (DONE - loads board with content)
2. Add "New Board" button to UI
3. Add board name input/editor in Toolbar
4. Update save logic to:
   - Update diagram name if changed
   - Save to current board (not create new)
5. Enhance SavedDiagramsTable:
   - Add [Load] button per row
   - Add [Rename] button per row
   - Add [Delete] button per row
6. Implement load board action:
   - Load specific diagram by ID
   - Replace canvas state
   - Update XState machine

**Files to modify**:
- `Toolbar.tsx` - add name editor, "New Board" button
- `SavedDiagramsTable.tsx` - add action buttons
- `canvas.machine.ts` - add SWITCH_BOARD event
- `C4CanvasContainer.tsx` - implement board switching
- `canvas-persistence.ts` - add board management functions

### Phase 2: History/Snapshots (Priority 2)

**Goal**: User can save named snapshots and restore from history

**Tasks**:
1. Update save to create history snapshot:
   - Serialize current nodes/edges to JSON
   - Insert into history table with session_name
2. Create HistoryPanel component:
   - Shows history for current board
   - [Restore] and [Delete] buttons per snapshot
3. Implement restore snapshot:
   - Load snapshot_data JSON
   - Parse and replace current state
   - Update diagram.updated_at
4. Add history navigation to Toolbar

**Files to create**:
- `HistoryPanel.tsx` - history viewer component
- `HistoryPanel.css.ts` - styles
- `history-persistence.ts` - Effect services for history

**Files to modify**:
- `canvas-persistence.ts` - add saveSnapshot function
- `C4CanvasContainer.tsx` - integrate history panel
- `canvas.machine.ts` - add RESTORE_SNAPSHOT event

### Phase 3: Polish (Priority 3)

**Goal**: UX improvements

**Tasks**:
1. Add board templates (empty, sample architectures)
2. Add board duplication
3. Add export/import (JSON)
4. Add search/filter in saved diagrams
5. Add tags/categories
6. Add snapshot comparison view

## Data Flow Examples

### Creating New Board
```
User: clicks "New Board", enters "Auth System"
  ↓
UI: send({ type: "CREATE_NEW_BOARD", name: "Auth System" })
  ↓
Effect: createNewDiagram("Auth System")
  ↓
DB: INSERT INTO diagrams (id, name, ...) VALUES (...)
  ↓
Machine: LOAD_DIAGRAM_SUCCESS (empty board)
  ↓
Canvas: displays empty board with name "Auth System"
```

### Saving with Snapshot
```
User: enters session name "v1.0", clicks "Save"
  ↓
UI: handleSave() with sessionName = "v1.0"
  ↓
Effect: saveDiagram() - updates nodes/edges
Effect: createSnapshot() - inserts into history
  ↓
DB:
  1. UPDATE diagrams SET updated_at = ... WHERE id = ...
  2. UPDATE/INSERT nodes WHERE diagram_id = ...
  3. INSERT INTO history (diagram_id, session_name, snapshot_data, ...)
  ↓
Machine: SAVE_SUCCESS
  ↓
UI: "Saved as v1.0" message
```

### Restoring from History
```
User: clicks [Restore] on "v1.0" snapshot
  ↓
UI: send({ type: "RESTORE_SNAPSHOT", snapshotId: "history-xxx" })
  ↓
Effect: loadSnapshot("history-xxx")
  ↓
DB: SELECT snapshot_data FROM history WHERE id = ...
  ↓
Effect: Parse JSON → { nodes: [...], edges: [...] }
Effect: saveDiagram() to replace current state
  ↓
Machine: LOAD_DIAGRAM_SUCCESS with restored data
  ↓
Canvas: displays restored board state
```

## Key Decisions

### 1. Snapshot Strategy
**Decision**: Create snapshot on every explicit save
- **Pro**: Full history, easy rollback
- **Con**: More DB writes
- **Mitigation**: Limit history (e.g., keep last 50 per board)

### 2. Board Naming
**Decision**: Require unique names per board
- **Pro**: User-friendly, easy to identify
- **Con**: Need validation
- **Implementation**: Check existing names before save

### 3. Current State Storage
**Decision**: Keep `diagrams` + `nodes` + `edges` as live state
- **Pro**: Normalized, efficient queries, supports relationships
- **Con**: More complex than JSON-only
- **Why**: Enables SQL queries, filtering, reporting

### 4. History Storage
**Decision**: JSON snapshots in `history` table
- **Pro**: Simple, fast restore, immutable
- **Con**: Denormalized, snapshot_data can be large
- **Why**: History is append-only, no need for normalization

## Testing Strategy

### Unit Tests
- Effect services (create, load, restore)
- Snapshot serialization/deserialization
- Board name validation

### Integration Tests
1. Create board → add nodes → save → verify in DB
2. Create board → save snapshot → restore → verify state
3. Switch boards → verify correct state loaded
4. Restore snapshot → verify nodes/edges replaced

### Manual Testing
1. Create 3 boards with different names
2. Add nodes to each board
3. Switch between boards - verify state preserved
4. Save snapshots with names
5. Restore old snapshot - verify rollback works

## Performance Considerations

1. **Loading boards list**: Query only metadata (diagrams table), not all nodes
2. **Loading history**: Lazy load - only when history panel opened
3. **Snapshot size**: Store compressed JSON (optional)
4. **History limit**: Auto-delete old snapshots (keep last 50)

## Success Criteria

✅ **Phase 1 Complete When**:
- User can create new board with custom name
- User can switch between boards
- Each board maintains independent state
- Board name editable from canvas

✅ **Phase 2 Complete When**:
- User can save named snapshots
- User can view history for current board
- User can restore from any snapshot
- Restoring replaces current state

✅ **Phase 3 Complete When**:
- All polish features implemented
- Smooth UX, no jarring transitions
- Error handling covers edge cases
