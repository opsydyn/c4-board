import { Effect, Option } from "effect";
import { DatabaseService } from "./database.base";

const parseJson = Option.liftThrowable((text: string) => JSON.parse(text) as unknown);

/**
 * Prepares a value for a column bound through `json(?)`.
 *
 * SQLite raises "malformed JSON" for anything `json()` cannot parse, which aborts
 * the whole statement. Response bodies are not always JSON — HTML error pages,
 * plain text, and empty bodies are all normal — so a body is passed through when
 * it already parses, encoded as a JSON string when it does not, and treated as
 * absent when blank. That keeps the payload readable without letting an
 * unremarkable response fail the write.
 */
const toJsonColumnValue = (text: string | null): string | null => {
  if (text === null || text.trim() === "") return null;
  return Option.isSome(parseJson(text)) ? text : JSON.stringify(text);
};

export interface PosteeCollection {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface PosteeRequest {
  id: string;
  collection_id: string;
  name: string;
  method: string;
  url: string;
  description: string | null;
  favorite: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface PosteeRequestHeader {
  id: number;
  request_id: string;
  key: string;
  value: string | null;
  is_enabled: number;
  sort_order: number;
}

export interface PosteeRequestBody {
  request_id: string;
  mode: string;
  raw: string | null;
  form_values: string | null;
}

export interface PosteeGraphqlRequest {
  request_id: string;
  document: string;
  variables_json: string;
  operation_name: string | null;
}

export interface PosteeGraphqlSchemaSnapshot {
  id: string;
  endpoint_url: string;
  context_fingerprint: string;
  introspection_json: string;
  schema_digest: string;
  fetched_at: number;
  last_used_at: number;
}

export interface PosteeScratchDraftRow {
  id: string;
  name: string;
  method: string;
  url: string;
  description: string | null;
  headers_json: string;
  body_mode: string;
  body_raw: string | null;
  form_values: string | null;
  graphql_document: string | null;
  graphql_variables_json: string | null;
  graphql_operation_name: string | null;
  environment_id: string | null;
  tab_order: number;
  is_open: 0 | 1;
  created_at: number;
  updated_at: number;
}

export interface PosteeEnvironment {
  id: string;
  name: string;
  description: string | null;
  is_default: number;
  created_at: number;
  updated_at: number;
}

export interface PosteeEnvironmentVariable {
  id: number;
  environment_id: string;
  key: string;
  value: string | null;
  is_secret: number;
  is_enabled: number;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface PosteeHistoryEntry {
  id: string;
  request_id: string | null;
  request_snapshot: string;
  response_status: number | null;
  response_time_ms: number | null;
  response_size_bytes: number | null;
  response_body: string | null; // JSON string
  response_headers: string | null; // JSON string
  error_message: string | null;
  executed_at: number;
}

export const listPosteeScratchDrafts = (openOnly?: boolean) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    return yield* service.query<PosteeScratchDraftRow>(
      `SELECT * FROM postee_scratch_drafts
       ${openOnly === undefined ? "" : "WHERE is_open = ?"}
       ORDER BY is_open DESC, tab_order ASC, updated_at DESC`,
      openOnly === undefined ? [] : [openOnly ? 1 : 0],
    );
  });

export const upsertPosteeScratchDraft = (draft: PosteeScratchDraftRow) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(
      `INSERT INTO postee_scratch_drafts (
        id, name, method, url, description, headers_json, body_mode, body_raw,
        form_values, graphql_document, graphql_variables_json, graphql_operation_name,
        environment_id, tab_order, is_open, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        method = excluded.method,
        url = excluded.url,
        description = excluded.description,
        headers_json = excluded.headers_json,
        body_mode = excluded.body_mode,
        body_raw = excluded.body_raw,
        form_values = excluded.form_values,
        graphql_document = excluded.graphql_document,
        graphql_variables_json = excluded.graphql_variables_json,
        graphql_operation_name = excluded.graphql_operation_name,
        environment_id = excluded.environment_id,
        tab_order = excluded.tab_order,
        is_open = excluded.is_open,
        updated_at = excluded.updated_at`,
      [
        draft.id,
        draft.name,
        draft.method,
        draft.url,
        draft.description,
        draft.headers_json,
        draft.body_mode,
        draft.body_raw,
        draft.form_values,
        draft.graphql_document,
        draft.graphql_variables_json,
        draft.graphql_operation_name,
        draft.environment_id,
        draft.tab_order,
        draft.is_open,
        draft.created_at,
        draft.updated_at,
      ],
    );
    return draft;
  });

export const setPosteeScratchDraftOpen = (id: string, isOpen: boolean) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const updatedAt = Date.now();
    yield* service.execute(
      `UPDATE postee_scratch_drafts SET is_open = ?, updated_at = ? WHERE id = ?`,
      [isOpen ? 1 : 0, updatedAt, id],
    );
    return updatedAt;
  });

export const deletePosteeScratchDraft = (id: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(`DELETE FROM postee_scratch_drafts WHERE id = ?`, [id]);
  });

// Collections

export const listPosteeCollections = () =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    return yield* service.query<PosteeCollection>(
      `SELECT * FROM postee_collections ORDER BY sort_order ASC, updated_at DESC`,
    );
  });

export const createPosteeCollection = (input: Omit<PosteeCollection, "created_at" | "updated_at">) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const now = Date.now();
    yield* service.execute(
      `INSERT INTO postee_collections (id, name, description, sort_order, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
      [input.id, input.name, input.description ?? null, input.sort_order, now, now],
    );
    return {
      ...input,
      description: input.description ?? null,
      created_at: now,
      updated_at: now,
    } satisfies PosteeCollection;
  });

export const updatePosteeCollection = (input: PosteeCollection) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const now = Date.now();
    yield* service.execute(
      `UPDATE postee_collections SET name = ?, description = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
      [input.name, input.description ?? null, input.sort_order, now, input.id],
    );
    return { ...input, description: input.description ?? null, updated_at: now } satisfies PosteeCollection;
  });

export const deletePosteeCollection = (id: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(`DELETE FROM postee_collections WHERE id = ?`, [id]);
  });

export const deletePosteeCollections = (ids: ReadonlyArray<string>) =>
  Effect.gen(function*() {
    if (ids.length === 0) {
      return;
    }

    const service = yield* DatabaseService;
    const placeholders = ids.map(() => "?").join(", ");
    yield* service.execute(
      `DELETE FROM postee_collections WHERE id IN (${placeholders})`,
      Array.from(ids),
    );
  });

// Requests

export const listPosteeRequests = (collectionId: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    return yield* service.query<PosteeRequest>(
      `SELECT * FROM postee_requests WHERE collection_id = ? ORDER BY sort_order ASC, updated_at DESC`,
      [collectionId],
    );
  });

export const getPosteeRequest = (id: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<PosteeRequest>(`SELECT * FROM postee_requests WHERE id = ?`, [id]);
    return rows[0] ?? null;
  });

export const createPosteeRequest = (input: Omit<PosteeRequest, "created_at" | "updated_at">) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const now = Date.now();
    yield* service.execute(
      `INSERT INTO postee_requests (id, collection_id, name, method, url, description, favorite, sort_order, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.collection_id,
        input.name,
        input.method,
        input.url,
        input.description ?? null,
        input.favorite,
        input.sort_order,
        now,
        now,
      ],
    );
    return {
      ...input,
      description: input.description ?? null,
      created_at: now,
      updated_at: now,
    } satisfies PosteeRequest;
  });

export const updatePosteeRequest = (input: PosteeRequest) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const now = Date.now();
    yield* service.execute(
      `UPDATE postee_requests SET name = ?, method = ?, url = ?, description = ?, favorite = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
      [
        input.name,
        input.method,
        input.url,
        input.description ?? null,
        input.favorite,
        input.sort_order,
        now,
        input.id,
      ],
    );
    return { ...input, description: input.description ?? null, updated_at: now } satisfies PosteeRequest;
  });

export const deletePosteeRequest = (id: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(`DELETE FROM postee_requests WHERE id = ?`, [id]);
  });

export const listPosteeRequestHeaders = (requestId: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    return yield* service.query<PosteeRequestHeader>(
      `SELECT * FROM postee_request_headers WHERE request_id = ? ORDER BY sort_order ASC`,
      [requestId],
    );
  });

export const replacePosteeRequestHeaders = (
  requestId: string,
  headers: ReadonlyArray<Omit<PosteeRequestHeader, "id">>,
) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(`DELETE FROM postee_request_headers WHERE request_id = ?`, [requestId]);
    for (const header of headers) {
      yield* service.execute(
        `INSERT INTO postee_request_headers (request_id, key, value, is_enabled, sort_order) VALUES (?, ?, ?, ?, ?)`,
        [
          header.request_id,
          header.key,
          header.value ?? null,
          header.is_enabled,
          header.sort_order,
        ],
      );
    }
  });

export const getPosteeRequestBody = (requestId: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<PosteeRequestBody>(`SELECT * FROM postee_request_bodies WHERE request_id = ?`, [
      requestId,
    ]);
    return rows[0] ?? null;
  });

export const upsertPosteeRequestBody = (body: PosteeRequestBody) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(
      `INSERT INTO postee_request_bodies (request_id, mode, raw, form_values)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(request_id) DO UPDATE SET mode = excluded.mode, raw = excluded.raw, form_values = excluded.form_values`,
      [body.request_id, body.mode, body.raw ?? null, body.form_values ?? null],
    );
  });

export const getPosteeGraphqlRequest = (requestId: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<PosteeGraphqlRequest>(
      `SELECT * FROM postee_graphql_requests WHERE request_id = ?`,
      [requestId],
    );
    return rows[0] ?? null;
  });

export const upsertPosteeGraphqlRequest = (request: PosteeGraphqlRequest) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(
      `INSERT INTO postee_graphql_requests (request_id, document, variables_json, operation_name)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(request_id) DO UPDATE SET
         document = excluded.document,
         variables_json = excluded.variables_json,
         operation_name = excluded.operation_name`,
      [request.request_id, request.document, request.variables_json, request.operation_name],
    );
  });

export const deletePosteeGraphqlRequest = (requestId: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(`DELETE FROM postee_graphql_requests WHERE request_id = ?`, [requestId]);
  });

export const getPosteeGraphqlSchemaSnapshot = (endpointUrl: string, contextFingerprint: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const rows = yield* service.query<PosteeGraphqlSchemaSnapshot>(
      `SELECT * FROM postee_graphql_schema_snapshots
       WHERE endpoint_url = ? AND context_fingerprint = ?`,
      [endpointUrl, contextFingerprint],
    );
    return rows[0] ?? null;
  });

export const upsertPosteeGraphqlSchemaSnapshot = (snapshot: PosteeGraphqlSchemaSnapshot) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(
      `INSERT INTO postee_graphql_schema_snapshots (
         id, endpoint_url, context_fingerprint, introspection_json, schema_digest, fetched_at, last_used_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(endpoint_url, context_fingerprint) DO UPDATE SET
         id = excluded.id,
         introspection_json = excluded.introspection_json,
         schema_digest = excluded.schema_digest,
         fetched_at = excluded.fetched_at,
         last_used_at = excluded.last_used_at`,
      [
        snapshot.id,
        snapshot.endpoint_url,
        snapshot.context_fingerprint,
        snapshot.introspection_json,
        snapshot.schema_digest,
        snapshot.fetched_at,
        snapshot.last_used_at,
      ],
    );
  });

export const touchPosteeGraphqlSchemaSnapshot = (id: string, lastUsedAt: number) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(
      `UPDATE postee_graphql_schema_snapshots SET last_used_at = ? WHERE id = ?`,
      [lastUsedAt, id],
    );
  });

// Environments

export const listPosteeEnvironments = () =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    return yield* service.query<PosteeEnvironment>(
      `SELECT * FROM postee_environments ORDER BY is_default DESC, updated_at DESC`,
    );
  });

export const createPosteeEnvironment = (input: Omit<PosteeEnvironment, "created_at" | "updated_at">) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const now = Date.now();
    yield* service.execute(
      `INSERT INTO postee_environments (id, name, description, is_default, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
      [input.id, input.name, input.description ?? null, input.is_default, now, now],
    );
    return {
      ...input,
      description: input.description ?? null,
      created_at: now,
      updated_at: now,
    } satisfies PosteeEnvironment;
  });

export const updatePosteeEnvironment = (input: PosteeEnvironment) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    const now = Date.now();
    yield* service.execute(
      `UPDATE postee_environments SET name = ?, description = ?, is_default = ?, updated_at = ? WHERE id = ?`,
      [input.name, input.description ?? null, input.is_default, now, input.id],
    );
    return { ...input, description: input.description ?? null, updated_at: now } satisfies PosteeEnvironment;
  });

export const deletePosteeEnvironment = (id: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(`DELETE FROM postee_environments WHERE id = ?`, [id]);
  });

export const listPosteeEnvironmentVariables = (environmentId: string) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    return yield* service.query<PosteeEnvironmentVariable>(
      `SELECT * FROM postee_environment_variables WHERE environment_id = ? ORDER BY sort_order ASC`,
      [environmentId],
    );
  });

export const upsertPosteeEnvironmentVariables = (
  environmentId: string,
  variables: ReadonlyArray<Omit<PosteeEnvironmentVariable, "id" | "created_at" | "updated_at">>,
) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(`DELETE FROM postee_environment_variables WHERE environment_id = ?`, [environmentId]);
    const now = Date.now();
    for (const variable of variables) {
      yield* service.execute(
        `INSERT INTO postee_environment_variables (environment_id, key, value, is_secret, is_enabled, sort_order, created_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          environmentId,
          variable.key,
          variable.value ?? null,
          variable.is_secret,
          variable.is_enabled,
          variable.sort_order,
          now,
          now,
        ],
      );
    }
  });

// History

export const listPosteeHistory = (limit = 50) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    return yield* service.query<PosteeHistoryEntry>(
      `SELECT * FROM postee_history ORDER BY executed_at DESC LIMIT ?`,
      [limit],
    );
  });

export const insertPosteeHistory = (entry: PosteeHistoryEntry) =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(
      `INSERT INTO postee_history (id, request_id, request_snapshot, response_status, response_time_ms, response_size_bytes, response_body, response_headers, error_message, executed_at)
			 VALUES (?, ?, ?, ?, ?, ?, json(?), json(?), ?, ?)`,
      [
        entry.id,
        entry.request_id ?? null,
        entry.request_snapshot,
        entry.response_status ?? null,
        entry.response_time_ms ?? null,
        entry.response_size_bytes ?? null,
        toJsonColumnValue(entry.response_body ?? null),
        toJsonColumnValue(entry.response_headers ?? null),
        entry.error_message ?? null,
        entry.executed_at,
      ],
    );
  });

export const clearPosteeHistory = () =>
  Effect.gen(function*() {
    const service = yield* DatabaseService;
    yield* service.execute(`DELETE FROM postee_history`);
  });
