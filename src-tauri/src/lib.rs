use serde::{Deserialize, Serialize};
use sqlx::migrate::Migrator;
use std::{fs, io::Write, path::Path, time::Duration};
use tauri::async_runtime::spawn;
use tauri::menu::{MenuBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{Emitter, Listener, Manager};
use tokio::time::sleep;

mod ai_agent;
mod azure_rest;
mod azure_sync;
mod db;
mod load_test;
mod rig_runtime;

use ai_agent::{
    rig_agent_clear_openai_api_key, rig_agent_hello, rig_agent_plan_c4_diagram,
    rig_agent_propose_postee_request, rig_agent_review_c4_board, rig_agent_run_postee_read_tool,
    rig_agent_run_read_tool, rig_agent_secret_status, rig_agent_store_openai_api_key,
};
use azure_sync::{azure_graph_query, azure_graph_validate_auth};
use db::{db_runtime_probe, sql_execute, sql_query};
use load_test::{LoadTestConfig, LoadTestEngine};

const APP_STORAGE_IDENTIFIER: &str = "com.opsydyn.c4board";
static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

fn resolve_persistent_app_storage_dir<R: tauri::Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Result<std::path::PathBuf, String> {
    let resolved = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|err| format!("Could not resolve app data directory: {err}"))?;

    if resolved
        .file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value == APP_STORAGE_IDENTIFIER)
    {
        return Ok(resolved);
    }

    match resolved.parent() {
        Some(parent) => Ok(parent.join(APP_STORAGE_IDENTIFIER)),
        None => Ok(resolved),
    }
}

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
    pub metadata: Option<String>, // JSON string containing EdgeMetadata
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
    pub metadata: Option<String>, // JSON string containing EdgeMetadata
}

#[derive(Debug, Deserialize)]
pub struct SaveIconInput {
    pub filename: String,
    pub data: Vec<u8>,
    pub mime_type: String,
}

#[derive(Debug, Serialize)]
pub struct SaveIconResult {
    pub icon_id: String,
    pub filename: String,
    pub mime_type: String,
    pub label: String,
    pub bytes_written: usize,
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

#[tauri::command]
fn get_layout_visual_fixture() -> Option<String> {
    if cfg!(debug_assertions) {
        return std::env::var("C4_VISUAL_FIXTURE").ok();
    }
    None
}

#[tauri::command]
fn save_custom_icon(
    app: tauri::AppHandle,
    payload: SaveIconInput,
) -> Result<SaveIconResult, String> {
    const MAX_FILE_SIZE: usize = 512 * 1024; // 512 KB
    const ALLOWED_MIME_TYPES: [(&str, &str); 4] = [
        ("image/png", "png"),
        ("image/svg+xml", "svg"),
        ("image/webp", "webp"),
        ("image/jpeg", "jpg"),
    ];

    let mime = payload.mime_type.trim();
    let ext_from_mime = ALLOWED_MIME_TYPES
        .iter()
        .find(|(allowed, _)| *allowed == mime)
        .map(|(_, ext)| *ext);

    if ext_from_mime.is_none() {
        return Err(format!("Unsupported mime type: {}", payload.mime_type));
    }

    if payload.data.len() > MAX_FILE_SIZE {
        return Err("Icon file too large (max 512KB)".into());
    }

    let mut icon_dir = resolve_persistent_app_storage_dir(&app)?;
    icon_dir.push("icons");

    fs::create_dir_all(&icon_dir)
        .map_err(|err| format!("Failed to create icon directory: {err}"))?;

    let original = payload.filename.to_lowercase();
    let path = Path::new(&original);

    let sanitize = |component: &str| -> String {
        component
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_'))
            .collect::<String>()
    };

    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .map(sanitize)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "icon".to_string());

    let mut extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(sanitize)
        .filter(|s| !s.is_empty())
        .or(ext_from_mime.map(|ext| ext.to_string()))
        .unwrap_or_else(|| "bin".to_string());

    if extension == "jpeg" {
        // prefer .jpg for jpeg files
        extension = "jpg".to_string();
    }

    let mut candidate = format!("{stem}.{extension}");
    let mut target = icon_dir.join(&candidate);
    let mut counter = 1;
    while target.exists() {
        candidate = format!("{stem}-{counter}.{extension}");
        target = icon_dir.join(&candidate);
        counter += 1;
    }

    let mut file =
        fs::File::create(&target).map_err(|err| format!("Failed to create icon file: {err}"))?;
    file.write_all(&payload.data)
        .and_then(|()| file.flush())
        .map_err(|err| format!("Failed to write icon file: {err}"))?;

    Ok(SaveIconResult {
        icon_id: format!("custom:{candidate}"),
        filename: candidate,
        mime_type: payload.mime_type,
        label: stem,
        bytes_written: payload.data.len(),
    })
}

/// The cancellation handle for the run currently in flight, if any. ADR-019.
///
/// One slot rather than a registry: the panel starts one run at a time, and a
/// stop button that had to name which run it meant would be a worse button.
#[derive(Default)]
struct ActiveLoadTest(std::sync::Mutex<Option<load_test::CancellationHandle>>);

#[tauri::command]
fn stop_load_test(active: tauri::State<'_, ActiveLoadTest>) -> Result<(), String> {
    // Idempotent by design: stopping nothing is a no-op, not an error. The button
    // is allowed to be pressed twice, or after a run has already finished.
    let handle = active
        .0
        .lock()
        .map_err(|_| "load test state poisoned")?
        .clone();
    if let Some(handle) = handle {
        handle.cancel();
    }
    Ok(())
}

#[tauri::command]
async fn start_load_test(
    app: tauri::AppHandle,
    active: tauri::State<'_, ActiveLoadTest>,
    config: LoadTestConfig,
) -> Result<(), String> {
    // Validate config
    config.validate()?;

    let engine = LoadTestEngine::new(config)?;
    let cancel = engine.cancellation_handle();

    // Published before the run starts, so a stop arriving immediately after start
    // still finds a handle rather than a None it would silently ignore.
    *active.0.lock().map_err(|_| "load test state poisoned")? = Some(cancel);

    // Spawn load test in background
    tokio::spawn(async move {
        // Run load test with progress streaming
        let app_clone = app.clone();
        let result = engine
            .run(move |progress| {
                // Emit progress to frontend every 100ms
                let _ = app_clone.emit("load-test-progress", progress);
            })
            .await;

        // Emit final result
        match result {
            Ok(final_stats) => {
                let _ = app.emit("load-test-complete", final_stats);
            }
            Err(e) => {
                let _ = app.emit("load-test-error", e);
            }
        }
    });

    Ok(())
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
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            get_layout_visual_fixture,
            save_custom_icon,
            start_load_test,
            stop_load_test,
            sql_execute,
            sql_query,
            db_runtime_probe,
            azure_graph_validate_auth,
            azure_graph_query,
            rig_agent_clear_openai_api_key,
            rig_agent_hello,
            rig_agent_plan_c4_diagram,
            rig_agent_review_c4_board,
            rig_agent_propose_postee_request,
            rig_agent_run_postee_read_tool,
            rig_agent_run_read_tool,
            rig_agent_secret_status,
            rig_agent_store_openai_api_key
        ])
        .setup(|app| {
            // Create a properly configured SQLite pool (single connection, busy_timeout, WAL)
            // Migrations and runtime queries share one stable storage root across dev and installed builds.
            let db_dir =
                resolve_persistent_app_storage_dir(app.handle()).map_err(std::io::Error::other)?;
            fs::create_dir_all(&db_dir)?;
            let db_path = db_dir.join("c4board.db");

            let pool = db::create_pool(&db_path)?;
            tauri::async_runtime::block_on(MIGRATOR.run(&pool))?;
            app.manage(db::AppDb(pool));
            app.manage(ActiveLoadTest::default());

            // Build and set the native menu
            let menu = build_menu(app.handle())?;
            app.set_menu(menu)?;

            let handle = app.handle().clone();
            app.listen_any("frontend:ready", move |_| {
                let handle = handle.clone();
                spawn(async move {
                    sleep(Duration::from_millis(420)).await;

                    if let Some(splash) = handle.get_webview_window("splashscreen") {
                        let _ = splash.close();
                    }

                    if let Some(main) = handle.get_webview_window("main") {
                        let _ = main.show();
                        let _ = main.set_focus();
                    }
                });
            });

            {
                let handle = app.handle().clone();
                spawn(async move {
                    sleep(Duration::from_secs(10)).await;
                    if let Some(main) = handle.get_webview_window("main") {
                        let _ = main.show();
                        let _ = main.set_focus();
                    }
                    if let Some(splash) = handle.get_webview_window("splashscreen") {
                        let _ = splash.close();
                    }
                });
            }

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
