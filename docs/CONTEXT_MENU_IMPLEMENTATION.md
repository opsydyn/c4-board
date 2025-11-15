# Context Menu Implementation Guide

## Overview

After researching Tauri v2 best practices, there are **two approaches** to implementing context menus:

1. **Native Tauri Menu API** (Recommended for in-app context menus)
2. **Custom React Component** (More flexible, better integration with ReactFlow)

## Recommendation: Hybrid Approach

Based on the Tauri v2 documentation and community practices, we should use:

- **Tauri's Native Menu API** (`menu.popup()`) for macOS/Windows native feel
- **Custom React positioning** to trigger the menu at the right location
- **Event handling in Rust** for menu actions that need backend integration

---

## Implementation Plan

### Architecture

```
User Right-Click (ReactFlow Canvas)
  ↓
React Event Handler (onContextMenu)
  ↓
Get Cursor Position (PhysicalPosition)
  ↓
Invoke Tauri Command to Show Menu
  ↓
Rust: Create Menu & Call menu.popup(at: position)
  ↓
User Clicks Menu Item
  ↓
Rust: Handle Menu Event (app.on_menu_event)
  ↓
Invoke Tauri Command Back to Frontend
  ↓
React: Execute Action (delete node, add edge, etc.)
```

---

## Step-by-Step Implementation

### Step 1: Create Menu Builder in Rust

**File**: `src-tauri/src/menu.rs`

```rust
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Runtime, Position, PhysicalPosition,
};

/// Context menu for nodes
pub fn create_node_context_menu<R: Runtime>(app: &AppHandle<R>) -> Menu<R> {
    let menu = Menu::new(app).unwrap();

    // Add menu items
    menu.append(&MenuItem::with_id(app, "edit", "Edit Node", true, None::<&str>).unwrap()).unwrap();
    menu.append(&MenuItem::with_id(app, "duplicate", "Duplicate", true, None::<&str>).unwrap()).unwrap();
    menu.append(&PredefinedMenuItem::separator(app).unwrap()).unwrap();
    menu.append(&MenuItem::with_id(app, "delete", "Delete", true, None::<&str>).unwrap()).unwrap();
    menu.append(&PredefinedMenuItem::separator(app).unwrap()).unwrap();

    // Submenu for node type changes
    let change_type_submenu = Submenu::with_items(
        app,
        "Change Type",
        true,
        &[
            &MenuItem::with_id(app, "type_person", "Person", true, None::<&str>).unwrap(),
            &MenuItem::with_id(app, "type_system", "System", true, None::<&str>).unwrap(),
            &MenuItem::with_id(app, "type_container", "Container", true, None::<&str>).unwrap(),
            &MenuItem::with_id(app, "type_component", "Component", true, None::<&str>).unwrap(),
        ],
    ).unwrap();

    menu.append(&change_type_submenu).unwrap();

    menu
}

/// Context menu for canvas (background)
pub fn create_canvas_context_menu<R: Runtime>(app: &AppHandle<R>) -> Menu<R> {
    let menu = Menu::new(app).unwrap();

    // Add Node submenu
    let add_node_submenu = Submenu::with_items(
        app,
        "Add Node",
        true,
        &[
            &MenuItem::with_id(app, "add_person", "Person", true, None::<&str>).unwrap(),
            &MenuItem::with_id(app, "add_system", "System", true, None::<&str>).unwrap(),
            &MenuItem::with_id(app, "add_container", "Container", true, None::<&str>).unwrap(),
            &MenuItem::with_id(app, "add_component", "Component", true, None::<&str>).unwrap(),
        ],
    ).unwrap();

    menu.append(&add_node_submenu).unwrap();
    menu.append(&PredefinedMenuItem::separator(app).unwrap()).unwrap();

    // Common actions
    menu.append(&MenuItem::with_id(app, "auto_layout", "Auto Layout", true, Some("Cmd+Shift+L")).unwrap()).unwrap();
    menu.append(&MenuItem::with_id(app, "export", "Export...", true, Some("Cmd+E")).unwrap()).unwrap();
    menu.append(&PredefinedMenuItem::separator(app).unwrap()).unwrap();

    // Undo/Redo
    menu.append(&PredefinedMenuItem::undo(app, None).unwrap()).unwrap();
    menu.append(&PredefinedMenuItem::redo(app, None).unwrap()).unwrap();

    menu
}

/// Context menu for edges
pub fn create_edge_context_menu<R: Runtime>(app: &AppHandle<R>) -> Menu<R> {
    let menu = Menu::new(app).unwrap();

    menu.append(&MenuItem::with_id(app, "edit_label", "Edit Label", true, None::<&str>).unwrap()).unwrap();
    menu.append(&MenuItem::with_id(app, "change_style", "Change Style", true, None::<&str>).unwrap()).unwrap();
    menu.append(&PredefinedMenuItem::separator(app).unwrap()).unwrap();
    menu.append(&MenuItem::with_id(app, "delete_edge", "Delete", true, None::<&str>).unwrap()).unwrap();

    menu
}
```

### Step 2: Create Tauri Commands to Show Menus

**File**: `src-tauri/src/commands/menu.rs`

```rust
use tauri::{command, AppHandle, Runtime, PhysicalPosition, Manager};
use crate::menu::{create_node_context_menu, create_canvas_context_menu, create_edge_context_menu};

#[derive(Debug, serde::Deserialize)]
pub struct Position {
    pub x: i32,
    pub y: i32,
}

#[command]
pub async fn show_node_context_menu<R: Runtime>(
    app: AppHandle<R>,
    window: tauri::Window<R>,
    position: Position,
) -> Result<(), String> {
    let menu = create_node_context_menu(&app);

    // Convert to PhysicalPosition
    let pos = PhysicalPosition::new(position.x, position.y);

    // Show menu at cursor position
    menu.popup_at(&window, Some(pos))
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
pub async fn show_canvas_context_menu<R: Runtime>(
    app: AppHandle<R>,
    window: tauri::Window<R>,
    position: Position,
) -> Result<(), String> {
    let menu = create_canvas_context_menu(&app);
    let pos = PhysicalPosition::new(position.x, position.y);
    menu.popup_at(&window, Some(pos))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[command]
pub async fn show_edge_context_menu<R: Runtime>(
    app: AppHandle<R>,
    window: tauri::Window<R>,
    position: Position,
) -> Result<(), String> {
    let menu = create_edge_context_menu(&app);
    let pos = PhysicalPosition::new(position.x, position.y);
    menu.popup_at(&window, Some(pos))
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

### Step 3: Handle Menu Events in Rust

**File**: `src-tauri/src/lib.rs` (add to setup)

```rust
use tauri::menu::MenuEvent;

pub fn run() {
    tauri::Builder::default()
        // ... existing setup ...
        .setup(|app| {
            // Register menu event handler
            app.on_menu_event(|app, event| {
                handle_menu_event(app, event);
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ... existing commands ...
            commands::menu::show_node_context_menu,
            commands::menu::show_canvas_context_menu,
            commands::menu::show_edge_context_menu,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn handle_menu_event(app: &tauri::AppHandle, event: MenuEvent) {
    match event.id.as_ref() {
        // Node actions
        "edit" => {
            // Emit event to frontend
            let _ = app.emit("context-menu-action", MenuAction {
                action: "edit".to_string(),
                context: "node".to_string(),
            });
        }
        "duplicate" => {
            let _ = app.emit("context-menu-action", MenuAction {
                action: "duplicate".to_string(),
                context: "node".to_string(),
            });
        }
        "delete" => {
            let _ = app.emit("context-menu-action", MenuAction {
                action: "delete".to_string(),
                context: "node".to_string(),
            });
        }

        // Canvas actions
        "auto_layout" => {
            let _ = app.emit("context-menu-action", MenuAction {
                action: "auto_layout".to_string(),
                context: "canvas".to_string(),
            });
        }
        "export" => {
            let _ = app.emit("context-menu-action", MenuAction {
                action: "export".to_string(),
                context: "canvas".to_string(),
            });
        }

        // Add node actions
        "add_person" | "add_system" | "add_container" | "add_component" => {
            let node_type = event.id.as_ref().strip_prefix("add_").unwrap_or("person");
            let _ = app.emit("context-menu-action", MenuAction {
                action: "add_node".to_string(),
                context: node_type.to_string(),
            });
        }

        // Type change actions
        "type_person" | "type_system" | "type_container" | "type_component" => {
            let node_type = event.id.as_ref().strip_prefix("type_").unwrap_or("person");
            let _ = app.emit("context-menu-action", MenuAction {
                action: "change_type".to_string(),
                context: node_type.to_string(),
            });
        }

        _ => {}
    }
}

#[derive(Clone, serde::Serialize)]
struct MenuAction {
    action: String,
    context: String,
}
```

### Step 4: React Integration

**File**: `src/ui/components/Canvas.tsx`

```typescript
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect } from 'react';

export function Canvas() {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);

  // Handle context menu on nodes
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    event.stopPropagation();

    setSelectedNode(node.id);

    // Get physical screen position
    const position = {
      x: event.clientX,
      y: event.clientY,
    };

    // Invoke Tauri command to show native menu
    invoke('show_node_context_menu', { position });
  }, []);

  // Handle context menu on canvas background
  const handleCanvasContextMenu = useCallback((event: React.MouseEvent) => {
    // Only trigger if clicking on background (not node or edge)
    if (event.target === event.currentTarget) {
      event.preventDefault();

      const position = {
        x: event.clientX,
        y: event.clientY,
      };

      setContextMenuPosition({ x: event.clientX, y: event.clientY });

      invoke('show_canvas_context_menu', { position });
    }
  }, []);

  // Handle context menu on edges
  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    event.stopPropagation();

    const position = {
      x: event.clientX,
      y: event.clientY,
    };

    invoke('show_edge_context_menu', { position });
  }, []);

  // Listen for menu actions from Rust
  useEffect(() => {
    const unlisten = listen<{ action: string; context: string }>('context-menu-action', (event) => {
      const { action, context } = event.payload;

      switch (action) {
        case 'edit':
          // Send XState event to edit selected node
          send({ type: 'EDIT_NODE', nodeId: selectedNode });
          break;

        case 'duplicate':
          send({ type: 'DUPLICATE_NODE', nodeId: selectedNode });
          break;

        case 'delete':
          send({ type: 'DELETE_NODE', nodeId: selectedNode });
          break;

        case 'add_node':
          // Create node at context menu position
          send({
            type: 'ADD_NODE',
            nodeType: context,
            position: contextMenuPosition,
          });
          break;

        case 'change_type':
          send({
            type: 'CHANGE_NODE_TYPE',
            nodeId: selectedNode,
            newType: context,
          });
          break;

        case 'auto_layout':
          send({ type: 'AUTO_LAYOUT' });
          break;

        case 'export':
          send({ type: 'EXPORT_DIAGRAM' });
          break;
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, [selectedNode, contextMenuPosition, send]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodeContextMenu={handleNodeContextMenu}
      onEdgeContextMenu={handleEdgeContextMenu}
      onPaneContextMenu={handleCanvasContextMenu}
      // Disable default browser context menu
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* ... rest of ReactFlow setup ... */}
    </ReactFlow>
  );
}
```

### Step 5: Disable Default Browser Context Menu

**File**: `src/layouts/Layout.astro` or global CSS

```css
/* Disable default context menu globally in production */
body {
  -webkit-user-select: none; /* Disable text selection (optional) */
  -webkit-app-region: no-drag; /* Allow dragging within app */
}

/* Re-enable text selection in editable areas */
input,
textarea,
[contenteditable] {
  -webkit-user-select: text;
}

/* Prevent default context menu */
* {
  -webkit-context-menu: none; /* WebKit browsers */
}
```

**Alternative: JavaScript approach**

```typescript
// Prevent default context menu everywhere except during development
if (process.env.NODE_ENV === 'production') {
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
}
```

---

## Advantages of This Approach

✅ **Native Feel**: Uses OS-native menus (looks native on macOS/Windows/Linux)
✅ **Keyboard Shortcuts**: Supports accelerators (Cmd+Shift+L, etc.)
✅ **Accessibility**: Native menus are screen-reader friendly
✅ **Performance**: No React re-renders for menu positioning
✅ **Consistency**: Follows Tauri v2 best practices
✅ **Type-Safe**: Full TypeScript + Rust type checking

## Disadvantages

❌ **More Complex**: Requires Rust + React coordination
❌ **Event Passing**: Menu events go Rust → Frontend via events
❌ **Limited Styling**: Native menus can't be fully customized

---

## Alternative: Pure React Context Menu

If you prefer more control over styling and don't need native OS integration:

**Pros**:
- Full CSS control
- Easier to implement
- No Rust code needed

**Cons**:
- Not native (doesn't match OS look)
- Accessibility requires manual implementation
- Can't use outside Tauri window

### Libraries to Consider:
- `react-contexify` - Lightweight, easy to use
- `@radix-ui/react-context-menu` - Accessible, headless
- Custom implementation with Floating UI

---

## Recommendation

**For C4 Board**: Use the **Native Tauri Menu API** approach because:

1. Professional native feel
2. Works well with keyboard shortcuts
3. Integrates with Tauri's ecosystem
4. Better accessibility out of the box
5. Future-proof (official Tauri API)

However, start with a **simple React-based context menu** to iterate quickly, then migrate to native menus once the UX is validated.

---

## Next Steps

1. ✅ Research complete - documented above
2. ⬜ Create basic React context menu (iteration speed)
3. ⬜ Define all menu actions in XState machine
4. ⬜ Implement Rust menu builders
5. ⬜ Add Tauri commands for menu display
6. ⬜ Wire up event handling
7. ⬜ Add keyboard shortcuts
8. ⬜ Test on macOS/Windows/Linux

---

## References

- [Tauri v2 Menu API](https://v2.tauri.app/reference/javascript/api/namespacemenu/)
- [Tauri Window Menu Guide](https://v2.tauri.app/learn/window-menu/)
- [muda Library (underlying menu implementation)](https://github.com/tauri-apps/muda)
- [Stack Overflow: Tauri Context Menus](https://stackoverflow.com/questions/77930215/how-to-add-menu-to-users-right-click-tauri-rust)
- [GitHub Discussion: Context Menu Implementation](https://github.com/tauri-apps/tauri/discussions/8726)

---

**Last Updated**: 2025-11-15
**Status**: Research Complete - Ready for Implementation
