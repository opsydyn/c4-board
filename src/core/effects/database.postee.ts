import { Effect } from "effect";
import { DatabaseService } from "./database.base";

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
	error_message: string | null;
	executed_at: number;
}

// Collections

export const listPosteeCollections = () =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		return yield* service.query<PosteeCollection>(
			`SELECT * FROM postee_collections ORDER BY sort_order ASC, updated_at DESC`,
		);
	});

export const createPosteeCollection = (input: Omit<PosteeCollection, "created_at" | "updated_at">) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		const now = Date.now();
		yield* service.execute(
			`INSERT INTO postee_collections (id, name, description, sort_order, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[input.id, input.name, input.description ?? null, input.sort_order, now, now],
		);
		return { ...input, description: input.description ?? null, created_at: now, updated_at: now } satisfies PosteeCollection;
	});

export const updatePosteeCollection = (input: PosteeCollection) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		const now = Date.now();
		yield* service.execute(
			`UPDATE postee_collections SET name = ?, description = ?, sort_order = ?, updated_at = ? WHERE id = ?`,
			[input.name, input.description ?? null, input.sort_order, now, input.id],
		);
		return { ...input, description: input.description ?? null, updated_at: now } satisfies PosteeCollection;
	});

export const deletePosteeCollection = (id: string) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		yield* service.execute(`DELETE FROM postee_collections WHERE id = ?`, [id]);
	});

// Requests

export const listPosteeRequests = (collectionId: string) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		return yield* service.query<PosteeRequest>(
			`SELECT * FROM postee_requests WHERE collection_id = ? ORDER BY sort_order ASC, updated_at DESC`,
			[collectionId],
		);
	});

export const getPosteeRequest = (id: string) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		const rows = yield* service.query<PosteeRequest>(`SELECT * FROM postee_requests WHERE id = ?`, [id]);
		return rows[0] ?? null;
	});

export const createPosteeRequest = (input: Omit<PosteeRequest, "created_at" | "updated_at">) =>
	Effect.gen(function* () {
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
		return { ...input, description: input.description ?? null, created_at: now, updated_at: now } satisfies PosteeRequest;
	});

export const updatePosteeRequest = (input: PosteeRequest) =>
	Effect.gen(function* () {
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
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		yield* service.execute(`DELETE FROM postee_requests WHERE id = ?`, [id]);
	});

export const listPosteeRequestHeaders = (requestId: string) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		return yield* service.query<PosteeRequestHeader>(
			`SELECT * FROM postee_request_headers WHERE request_id = ? ORDER BY sort_order ASC`,
			[requestId],
		);
	});

export const replacePosteeRequestHeaders = (requestId: string, headers: ReadonlyArray<Omit<PosteeRequestHeader, "id">>) =>
	Effect.gen(function* () {
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
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		const rows = yield* service.query<PosteeRequestBody>(`SELECT * FROM postee_request_bodies WHERE request_id = ?`, [requestId]);
		return rows[0] ?? null;
	});

export const upsertPosteeRequestBody = (body: PosteeRequestBody) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		yield* service.execute(
			`INSERT INTO postee_request_bodies (request_id, mode, raw, form_values)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(request_id) DO UPDATE SET mode = excluded.mode, raw = excluded.raw, form_values = excluded.form_values`,
			[body.request_id, body.mode, body.raw ?? null, body.form_values ?? null],
		);
	});

// Environments

export const listPosteeEnvironments = () =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		return yield* service.query<PosteeEnvironment>(
			`SELECT * FROM postee_environments ORDER BY is_default DESC, updated_at DESC`,
		);
	});

export const createPosteeEnvironment = (input: Omit<PosteeEnvironment, "created_at" | "updated_at">) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		const now = Date.now();
		yield* service.execute(
			`INSERT INTO postee_environments (id, name, description, is_default, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			[input.id, input.name, input.description ?? null, input.is_default, now, now],
		);
		return { ...input, description: input.description ?? null, created_at: now, updated_at: now } satisfies PosteeEnvironment;
	});

export const updatePosteeEnvironment = (input: PosteeEnvironment) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		const now = Date.now();
		yield* service.execute(
			`UPDATE postee_environments SET name = ?, description = ?, is_default = ?, updated_at = ? WHERE id = ?`,
			[input.name, input.description ?? null, input.is_default, now, input.id],
		);
		return { ...input, description: input.description ?? null, updated_at: now } satisfies PosteeEnvironment;
	});

export const deletePosteeEnvironment = (id: string) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		yield* service.execute(`DELETE FROM postee_environments WHERE id = ?`, [id]);
	});

export const listPosteeEnvironmentVariables = (environmentId: string) =>
	Effect.gen(function* () {
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
	Effect.gen(function* () {
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
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		return yield* service.query<PosteeHistoryEntry>(
			`SELECT * FROM postee_history ORDER BY executed_at DESC LIMIT ?`,
			[limit],
		);
	});

export const insertPosteeHistory = (entry: PosteeHistoryEntry) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		yield* service.execute(
			`INSERT INTO postee_history (id, request_id, request_snapshot, response_status, response_time_ms, response_size_bytes, error_message, executed_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				entry.id,
				entry.request_id ?? null,
				entry.request_snapshot,
				entry.response_status ?? null,
				entry.response_time_ms ?? null,
				entry.response_size_bytes ?? null,
				entry.error_message ?? null,
				entry.executed_at,
			],
		);
	});

export const clearPosteeHistory = () =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		yield* service.execute(`DELETE FROM postee_history`);
	});
