//! Database module — properly configured single-connection SQLite pool.
//!
//! The `tauri-plugin-sql` plugin is kept for migrations only. This module
//! provides runtime query execution via custom Tauri commands backed by a
//! `SqlitePool` with `busy_timeout`, WAL, `foreign_keys`, and `max_connections(1)`
//! configured at the connection level.
//!
//! See ADR-004 for the full architectural rationale.

use std::path::{Path, PathBuf};
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
    pub db_file_size_bytes: Option<i64>,
    pub db_file_size_mb: Option<f64>,
    pub wal_file_size_bytes: Option<i64>,
    pub wal_file_size_mb: Option<f64>,
}

#[derive(sqlx::FromRow)]
struct DatabaseListRow {
    name: String,
    file: String,
}

fn bytes_to_megabytes(bytes: i64) -> f64 {
    (bytes as f64) / (1024_f64 * 1024_f64)
}

fn normalize_file_size(bytes: u64) -> i64 {
    if bytes > i64::MAX as u64 {
        i64::MAX
    } else {
        bytes as i64
    }
}

fn read_file_size_bytes(path: &Path) -> Option<i64> {
    std::fs::metadata(path)
        .ok()
        .map(|metadata| normalize_file_size(metadata.len()))
}

async fn resolve_main_database_path(pool: &SqlitePool) -> Result<Option<PathBuf>, DbError> {
    let databases = sqlx::query_as::<_, DatabaseListRow>("PRAGMA database_list;")
        .fetch_all(pool)
        .await?;

    let main_path = databases
        .iter()
        .find(|database| database.name.eq_ignore_ascii_case("main"))
        .map(|database| database.file.trim())
        .filter(|file| !file.is_empty() && *file != ":memory:")
        .map(PathBuf::from);

    Ok(main_path)
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

    let page_count: i64 = sqlx::query_scalar("PRAGMA page_count;")
        .fetch_one(&state.0)
        .await?;
    let page_size: i64 = sqlx::query_scalar("PRAGMA page_size;")
        .fetch_one(&state.0)
        .await?;
    let pragma_db_size_bytes = page_count.saturating_mul(page_size);

    let main_database_path = resolve_main_database_path(&state.0).await?;
    let db_file_size_bytes = main_database_path
        .as_deref()
        .and_then(read_file_size_bytes)
        .or_else(|| {
            if pragma_db_size_bytes > 0 {
                Some(pragma_db_size_bytes)
            } else {
                None
            }
        });
    let db_file_size_mb = db_file_size_bytes.map(bytes_to_megabytes);

    let wal_file_size_bytes = main_database_path.as_deref().and_then(|path| {
        let wal_path = PathBuf::from(format!("{}-wal", path.to_string_lossy()));
        read_file_size_bytes(wal_path.as_path())
    });
    let wal_file_size_mb = wal_file_size_bytes.map(bytes_to_megabytes);

    Ok(DbRuntimeProbe {
        journal_mode: journal_mode.to_lowercase(),
        foreign_keys: foreign_keys_raw != 0,
        busy_timeout_ms,
        synchronous_mode: synchronous_mode.to_string(),
        max_connections: 1,
        db_file_size_bytes,
        db_file_size_mb,
        wal_file_size_bytes,
        wal_file_size_mb,
    })
}
