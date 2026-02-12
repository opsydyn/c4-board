//! Database module — properly configured single-connection SQLite pool.
//!
//! The `tauri-plugin-sql` plugin is kept for migrations only. This module
//! provides runtime query execution via custom Tauri commands backed by a
//! `SqlitePool` with `busy_timeout`, WAL, `foreign_keys`, and `max_connections(1)`
//! configured at the connection level.
//!
//! See ADR-004 for the full architectural rationale.

use std::path::Path;
use std::time::Duration;

use indexmap::IndexMap;
use serde::Serialize;
use serde_json::Value as JsonValue;
use sqlx::sqlite::{
    SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteRow, SqliteSynchronous,
};
use sqlx::{Column, Executor, Row, SqlitePool, TypeInfo, ValueRef};
use tauri::State;

// ============================================================================
// Error type
// ============================================================================

#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("{0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("decode error: {0}")]
    Decode(String),
}

impl Serialize for DbError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

// ============================================================================
// Pool
// ============================================================================

/// Managed state holding a single-connection SQLite pool with `busy_timeout`,
/// WAL, and `foreign_keys` configured on every connection at creation time.
pub struct AppDb(pub SqlitePool);

/// Create a properly configured SQLite pool for the given database path.
pub fn create_pool(db_path: &Path) -> Result<SqlitePool, sqlx::Error> {
    let conn_opts = SqliteConnectOptions::new()
        .filename(db_path)
        .create_if_missing(true)
        .busy_timeout(Duration::from_secs(5))
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .foreign_keys(true);

    tauri::async_runtime::block_on(
        SqlitePoolOptions::new()
            .max_connections(1)
            .acquire_timeout(Duration::from_secs(30))
            .idle_timeout(Some(Duration::from_secs(300)))
            .connect_with(conn_opts),
    )
}

// ============================================================================
// Value binding
// ============================================================================

/// Bind JSON values to a sqlx query, matching the plugin's binding strategy:
/// null → `None`, string → `String`, number → `f64`, else → raw `JsonValue`.
#[inline]
fn bind_values<'a>(
    mut query: sqlx::query::Query<'a, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'a>>,
    values: &[JsonValue],
) -> sqlx::query::Query<'a, sqlx::Sqlite, sqlx::sqlite::SqliteArguments<'a>> {
    for value in values {
        if value.is_null() {
            query = query.bind(None::<JsonValue>);
        } else if value.is_string() {
            query = query.bind(value.as_str().unwrap().to_owned());
        } else if let Some(number) = value.as_number() {
            query = query.bind(number.as_f64().unwrap_or_default());
        } else {
            query = query.bind(value.clone());
        }
    }
    query
}

// ============================================================================
// Row decoding
// ============================================================================

/// Convert a SQLite row to a JSON-compatible `IndexMap`, matching the plugin's
/// decode strategy: TEXT→String, INTEGER→i64, REAL→f64, BOOLEAN→bool, NULL→null.
#[inline]
fn row_to_json(row: &SqliteRow) -> Result<IndexMap<String, JsonValue>, DbError> {
    let columns = row.columns();
    let mut map = IndexMap::with_capacity(columns.len());

    for (i, column) in columns.iter().enumerate() {
        let raw = row
            .try_get_raw(i)
            .map_err(|e| DbError::Decode(e.to_string()))?;

        let value = if raw.is_null() {
            JsonValue::Null
        } else {
            match raw.type_info().name() {
                "INTEGER" | "NUMERIC" => {
                    let v: i64 = row.try_get(i).map_err(|e| DbError::Decode(e.to_string()))?;
                    JsonValue::Number(v.into())
                }
                "REAL" => {
                    let v: f64 = row.try_get(i).map_err(|e| DbError::Decode(e.to_string()))?;
                    serde_json::Number::from_f64(v)
                        .map(JsonValue::Number)
                        .unwrap_or(JsonValue::Null)
                }
                "BOOLEAN" => {
                    let v: bool = row.try_get(i).map_err(|e| DbError::Decode(e.to_string()))?;
                    JsonValue::Bool(v)
                }
                _ => {
                    // TEXT, DATE, TIME, DATETIME, and anything else → String
                    let v: String = row.try_get(i).map_err(|e| DbError::Decode(e.to_string()))?;
                    JsonValue::String(v)
                }
            }
        };
        map.insert(column.name().to_string(), value);
    }
    Ok(map)
}

// ============================================================================
// Tauri commands
// ============================================================================

#[tauri::command]
pub async fn sql_execute(
    state: State<'_, AppDb>,
    sql: String,
    values: Vec<JsonValue>,
) -> Result<(u64, i64), DbError> {
    let query = bind_values(sqlx::query(&sql), &values);
    let result = state.0.execute(query).await?;
    Ok((result.rows_affected(), result.last_insert_rowid()))
}

#[tauri::command]
pub async fn sql_query(
    state: State<'_, AppDb>,
    sql: String,
    values: Vec<JsonValue>,
) -> Result<Vec<IndexMap<String, JsonValue>>, DbError> {
    let query = bind_values(sqlx::query(&sql), &values);
    let rows = state.0.fetch_all(query).await?;
    rows.iter().map(row_to_json).collect()
}

#[derive(Debug, Serialize)]
pub struct DbRuntimeProbe {
    pub journal_mode: String,
    pub foreign_keys: bool,
    pub busy_timeout_ms: i64,
    pub synchronous_mode: String,
    pub max_connections: u32,
}

#[tauri::command]
pub async fn db_runtime_probe(state: State<'_, AppDb>) -> Result<DbRuntimeProbe, DbError> {
    let journal_mode: String = sqlx::query_scalar("PRAGMA journal_mode;")
        .fetch_one(&state.0)
        .await?;

    let foreign_keys_raw: i64 = sqlx::query_scalar("PRAGMA foreign_keys;")
        .fetch_one(&state.0)
        .await?;

    let busy_timeout_ms: i64 = sqlx::query_scalar("PRAGMA busy_timeout;")
        .fetch_one(&state.0)
        .await?;

    let synchronous_raw: i64 = sqlx::query_scalar("PRAGMA synchronous;")
        .fetch_one(&state.0)
        .await?;

    let synchronous_mode = match synchronous_raw {
        0 => "off",
        1 => "normal",
        2 => "full",
        3 => "extra",
        _ => "unknown",
    };

    Ok(DbRuntimeProbe {
        journal_mode: journal_mode.to_lowercase(),
        foreign_keys: foreign_keys_raw != 0,
        busy_timeout_ms,
        synchronous_mode: synchronous_mode.to_string(),
        max_connections: 1,
    })
}
