use serde::{Deserialize, Serialize};
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
    pub node_type: String, // "person" | "system" | "externalSystem"
    pub label: String,
    pub technology: Option<String>,
    pub description: Option<String>,
    pub position_x: f64,
    pub position_y: f64,
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
}

#[derive(Debug, Deserialize)]
pub struct UpdateNodeInput {
    pub label: Option<String>,
    pub technology: Option<String>,
    pub description: Option<String>,
    pub position_x: Option<f64>,
    pub position_y: Option<f64>,
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
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:c4board.db", migrations)
                .build()
        )
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
