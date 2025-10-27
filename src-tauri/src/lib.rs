use serde::{Deserialize, Serialize};
use tauri::menu::{MenuBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};

// ============================================================================
// Domain Models (Functional Core)
// Pure data structures representing C4 diagram entities
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Diagram {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Node {
    pub id: String,
    pub diagram_id: String,
    #[serde(rename = "type")]
    pub node_type: String, // "person" | "system" | "externalSystem" | "container" | "component"
    pub label: String,
    pub technology: Option<String>,
    pub description: Option<String>,
    pub position_x: f64,
    pub position_y: f64,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Edge {
    pub id: String,
    pub diagram_id: String,
    pub source: String,
    pub target: String,
    pub label: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

// ============================================================================
// Input DTOs for Commands
// ============================================================================

#[derive(Debug, Deserialize)]
pub struct CreateDiagramInput {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDiagramInput {
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNodeInput {
    pub id: String,
    pub diagram_id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub label: String,
    pub technology: Option<String>,
    pub description: Option<String>,
    pub position_x: f64,
    pub position_y: f64,
    pub width: Option<f64>,
    pub height: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateNodeInput {
    pub label: Option<String>,
    pub technology: Option<String>,
    pub description: Option<String>,
    pub position_x: Option<f64>,
    pub position_y: Option<f64>,
    pub width: Option<f64>,
    pub height: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEdgeInput {
    pub id: String,
    pub diagram_id: String,
    pub source: String,
    pub target: String,
    pub label: Option<String>,
}

// ============================================================================
// Tauri Commands (Imperative Shell)
// I/O boundary - handles database operations
// ============================================================================

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// ============================================================================
// Menu Builder
// Creates native window menu with keyboard shortcuts
// ============================================================================

fn build_menu(app: &tauri::AppHandle) -> Result<tauri::menu::Menu<tauri::Wry>, tauri::Error> {
    use tauri::menu::MenuItemBuilder;

    // File Menu
    let new_board = MenuItemBuilder::with_id("new-board", "New Board")
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let open_board = MenuItemBuilder::with_id("open-board", "Open Board...")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let save = MenuItemBuilder::with_id("save", "Save")
        .accelerator("CmdOrCtrl+S")
        .build(app)?;
    let save_as = MenuItemBuilder::with_id("save-as", "Save As...")
        .accelerator("CmdOrCtrl+Shift+S")
        .build(app)?;
    let view_all = MenuItemBuilder::with_id("view-all", "View All Boards")
        .accelerator("CmdOrCtrl+L")
        .build(app)?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&new_board)
        .item(&open_board)
        .separator()
        .item(&save)
        .item(&save_as)
        .separator()
        .item(&view_all)
        .separator()
        .close_window()
        .build()?;

    // Edit Menu with predefined items
    let delete_node = MenuItemBuilder::with_id("delete-node", "Delete Node")
        .accelerator("Delete")
        .build(app)?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .separator()
        .item(&delete_node)
        .build()?;

    // Insert Menu
    let add_person = MenuItemBuilder::with_id("add-person", "Person")
        .accelerator("CmdOrCtrl+1")
        .build(app)?;
    let add_system = MenuItemBuilder::with_id("add-system", "System")
        .accelerator("CmdOrCtrl+2")
        .build(app)?;
    let add_external = MenuItemBuilder::with_id("add-external", "External System")
        .accelerator("CmdOrCtrl+3")
        .build(app)?;
    let add_container = MenuItemBuilder::with_id("add-container", "Container")
        .accelerator("CmdOrCtrl+4")
        .build(app)?;
    let add_component = MenuItemBuilder::with_id("add-component", "Component")
        .accelerator("CmdOrCtrl+5")
        .build(app)?;

    let insert_menu = SubmenuBuilder::new(app, "Insert")
        .item(&add_person)
        .item(&add_system)
        .item(&add_external)
        .separator()
        .item(&add_container)
        .item(&add_component)
        .build()?;

    // View Menu
    let toggle_properties =
        MenuItemBuilder::with_id("toggle-properties", "Toggle Properties Panel")
            .accelerator("CmdOrCtrl+P")
            .build(app)?;
    let zoom_in = MenuItemBuilder::with_id("zoom-in", "Zoom In")
        .accelerator("CmdOrCtrl+Plus")
        .build(app)?;
    let zoom_out = MenuItemBuilder::with_id("zoom-out", "Zoom Out")
        .accelerator("CmdOrCtrl+-")
        .build(app)?;
    let zoom_reset = MenuItemBuilder::with_id("zoom-reset", "Zoom to 100%")
        .accelerator("CmdOrCtrl+0")
        .build(app)?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&toggle_properties)
        .separator()
        .item(&zoom_in)
        .item(&zoom_out)
        .item(&zoom_reset)
        .build()?;

    // Build the complete menu
    MenuBuilder::new(app)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&insert_menu)
        .item(&view_menu)
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Define database migrations
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_history_table",
            sql: include_str!("../migrations/002_history.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "update_node_types",
            sql: include_str!("../migrations/003_update_node_types.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add_node_dimensions",
            sql: include_str!("../migrations/004_add_node_dimensions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add_node_parent_fields",
            sql: include_str!("../migrations/005_add_node_parent_fields.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:c4board.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet])
        .setup(|app| {
            // Build and set the native menu
            let menu = build_menu(app.handle())?;
            app.set_menu(menu)?;

            // Handle menu events
            app.on_menu_event(|app, event| {
                println!("📋 Menu event received: {:?}", event.id());

                let Some(window) = app.get_webview_window("main") else {
                    eprintln!(
                        "⚠️ Unable to resolve window for menu event {:?}",
                        event.id()
                    );
                    return;
                };

                let emit = |channel: &str| {
                    if let Err(err) = window.emit(channel, ()) {
                        eprintln!("⚠️ Emitting {channel} failed: {err}");
                    }
                };

                match event.id().as_ref() {
                    // File menu
                    "new-board" => {
                        emit("menu:new-board");
                    }
                    "open-board" => {
                        emit("menu:open-board");
                    }
                    "save" => {
                        emit("menu:save");
                    }
                    "save-as" => {
                        emit("menu:save-as");
                    }
                    "view-all" => {
                        emit("menu:view-all");
                    }

                    // Edit menu
                    "delete-node" => {
                        emit("menu:delete-node");
                    }

                    // Insert menu
                    "add-person" => {
                        emit("menu:add-person");
                    }
                    "add-system" => {
                        emit("menu:add-system");
                    }
                    "add-external" => {
                        emit("menu:add-external");
                    }
                    "add-container" => {
                        emit("menu:add-container");
                    }
                    "add-component" => {
                        emit("menu:add-component");
                    }

                    // View menu
                    "toggle-properties" => {
                        emit("menu:toggle-properties");
                    }
                    "zoom-in" => {
                        emit("menu:zoom-in");
                    }
                    "zoom-out" => {
                        emit("menu:zoom-out");
                    }
                    "zoom-reset" => {
                        emit("menu:zoom-reset");
                    }

                    _ => {}
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
