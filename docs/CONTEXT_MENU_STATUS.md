# Context Menu Implementation Status

## ✅ Completed (Rust Backend)

### 1. Menu Builders (`src-tauri/src/menu.rs`)
- ✅ `create_node_context_menu()` - Edit, Duplicate, Delete, Change Type, Add Connected
- ✅ `create_canvas_context_menu()` - Add Node submenu (all C4 + DDD types), Auto Layout, Export, Undo/Redo, Paste
- ✅ `create_edge_context_menu()` - Edit Label, Change Style, Reverse Direction, Delete

### 2. Tauri Commands (`src-tauri/src/commands/menu_commands.rs`)
- ✅ `show_node_context_menu` - Shows native menu at cursor position for nodes
- ✅ `show_canvas_context_menu` - Shows native menu for canvas background
- ✅ `show_edge_context_menu` - Shows native menu for edges

### 3. Event Handler (`src-tauri/src/lib.rs`)
- ✅ Extended `app.on_menu_event()` to handle all context menu events
- ✅ Emits events to frontend with naming convention: `context-menu:{action}`
- ✅ Registered commands in `invoke_handler!`

### Event Naming Convention:
- Node actions: `context-menu:edit`, `context-menu:duplicate`, `context-menu:delete`
- Change type: `context-menu:change-type:{nodeType}` (e.g., `context-menu:change-type:person`)
- Add node: `context-menu:add:{nodeType}` (e.g., `context-menu:add:system`)
- Canvas actions: `context-menu:auto-layout`, `context-menu:export`, `context-menu:paste`
- Edge actions: `context-menu:edit-label`, `context-menu:style:{type}`, `context-menu:reverse-direction`, `context-menu:delete-edge`

---

## 🚧 In Progress (React Frontend)

### Next Steps:

1. **Add context menu triggers to ReactFlow canvas** (`src/ui/components/C4Canvas.tsx`):
   ```tsx
   // Add these handlers to ReactFlow component
   onNodeContextMenu={(event, node) => {
     event.preventDefault();
     invoke('show_node_context_menu', {
       position: { x: event.clientX, y: event.clientY },
       nodeId: node.id
     });
   }}

   onEdgeContextMenu={(event, edge) => {
     event.preventDefault();
     invoke('show_edge_context_menu', {
       position: { x: event.clientX, y: event.clientY },
       edgeId: edge.id
     });
   }}

   onPaneContextMenu={(event) => {
     event.preventDefault();
     invoke('show_canvas_context_menu', {
       position: { x: event.clientX, y: event.clientY }
     });
   }}
   ```

2. **Listen for menu events** (add to Canvas component):
   ```tsx
   useEffect(() => {
     const unlisten = listen('context-menu:*', (event) => {
       // Parse event channel to determine action
       // Forward to XState machine
     });
     return () => { unlisten.then(fn => fn()); };
   }, []);
   ```

3. **Add XState events** to `canvas.machine.ts`:
   - `DUPLICATE_NODE`
   - `CHANGE_NODE_TYPE`
   - `ADD_CONNECTED_NODE`
   - `CHANGE_EDGE_STYLE`
   - `REVERSE_EDGE`
   - (many others already exist like `DELETE_NODE`, `AUTO_LAYOUT`, etc.)

4. **Disable default browser context menu**:
   ```css
   /* In global CSS */
   body {
     -webkit-context-menu: none;
   }
   ```

---

## 📝 Implementation Code Ready

All Rust code is complete and waiting for cargo check to finish. The frontend integration requires:
- ~50 lines of React code in C4Canvas.tsx
- ~20 lines for event listener
- ~5-10 new XState events (most already exist)

---

## 🎯 Features Included

### Node Context Menu:
- Edit Node (double-click alternative)
- Duplicate
- Delete
- **Change Type** submenu:
  - All C4 types (Person, System, External System, Container, Component)
  - All DDD types (Aggregate, Entity, Value Object, Domain Event, Domain Service, Repository, Factory, Command, Query, Application Service, Integration Event, ACL, Saga, Bounded Context)
- Add Connected Node (quick workflow)

### Canvas Context Menu:
- **Add Node** submenu (all C4 + DDD types)
- Auto Layout (Cmd+Shift+L)
- Export... (Cmd+E)
- Undo/Redo (native OS shortcuts)
- Paste (Cmd+V)

### Edge Context Menu:
- Edit Label
- **Change Style** submenu (Solid, Dashed, Dotted)
- Reverse Direction
- Delete

---

## 🔮 Next Session

1. Check cargo compilation results
2. Add React handlers to C4Canvas.tsx
3. Wire up event listeners
4. Add missing XState events
5. Test on macOS (native menus!)
6. Test keyboard shortcuts
7. Document for team

---

**Last Updated**: 2025-11-15 17:47 UTC
**Status**: Rust complete, React integration pending
