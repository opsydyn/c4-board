/**
 * Database Effect Service (Functional Core)
 *
 * Pure functions that return Effect<Database, DatabaseError, Result>
 * Contains ZERO side effects - all I/O happens at the boundary via Tauri
 *
 * Architecture:
 * - Effect functions describe WHAT to do (pure logic)
 * - Tauri SQL plugin provides HOW to do it (I/O)
 * - XState machines orchestrate WHEN to do it (flow control)
 */

import { Effect, Context } from "effect";
import Database from "@tauri-apps/plugin-sql";

// ============================================================================
// Service Definition
// ============================================================================

export class DatabaseService extends Context.Tag("DatabaseService")<
	DatabaseService,
	{
		readonly getDatabase: () => Effect.Effect<Database, DatabaseError>;
		readonly query: <T>(
			sql: string,
			bindValues?: unknown[],
		) => Effect.Effect<T[], DatabaseError>;
		readonly execute: (
			sql: string,
			bindValues?: unknown[],
		) => Effect.Effect<void, DatabaseError>;
	}
>() {}

// ============================================================================
// Error Types
// ============================================================================

export class DatabaseError {
	readonly _tag = "DatabaseError";
	constructor(readonly message: string, readonly cause?: unknown) {}
}

export class NotFoundError {
	readonly _tag = "NotFoundError";
	constructor(readonly entity: string, readonly id: string) {}
}

export class ValidationError {
	readonly _tag = "ValidationError";
	constructor(readonly field: string, readonly message: string) {}
}

// ============================================================================
// Domain Models (matching Rust structs)
// ============================================================================

export interface Diagram {
	id: string;
	name: string;
	description: string | null;
	created_at: number;
	updated_at: number;
}

export interface Node {
	id: string;
	diagram_id: string;
	type: "person" | "system" | "externalSystem" | "container" | "component";
	label: string;
	technology: string | null;
	description: string | null;
	position_x: number;
	position_y: number;
	created_at: number;
	updated_at: number;
}

export interface Edge {
	id: string;
	diagram_id: string;
	source: string;
	target: string;
	label: string | null;
	created_at: number;
	updated_at: number;
}

// ============================================================================
// Input Types
// ============================================================================

export interface CreateDiagramInput {
	id: string;
	name: string;
	description?: string;
}

export interface UpdateDiagramInput {
	name?: string;
	description?: string;
}

export interface CreateNodeInput {
	id: string;
	diagram_id: string;
	type: "person" | "system" | "externalSystem" | "container" | "component";
	label: string;
	technology?: string;
	description?: string;
	position_x: number;
	position_y: number;
}

export interface UpdateNodeInput {
	label?: string;
	technology?: string;
	description?: string;
	position_x?: number;
	position_y?: number;
}

export interface CreateEdgeInput {
	id: string;
	diagram_id: string;
	source: string;
	target: string;
	label?: string;
}

// ============================================================================
// Pure Effect Functions (Functional Core)
// ============================================================================

/**
 * Initialize database connection
 * Migrations are automatically applied via Tauri plugin configuration
 */
export const initDatabase = Effect.gen(function* () {
	const service = yield* DatabaseService;

	// Just ensure database is loaded - migrations run automatically
	yield* service.getDatabase();
});

// ============================================================================
// Diagram CRUD Operations
// ============================================================================

export const createDiagram = (input: CreateDiagramInput) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		const now = Date.now();

		yield* service.execute(
			`INSERT INTO diagrams (id, name, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
			[input.id, input.name, input.description ?? null, now, now],
		);

		return {
			id: input.id,
			name: input.name,
			description: input.description ?? null,
			created_at: now,
			updated_at: now,
		} satisfies Diagram;
	});

export const getDiagram = (id: string) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;

		const results = yield* service.query<Diagram>(
			`SELECT * FROM diagrams WHERE id = ?`,
			[id],
		);

		if (results.length === 0) {
			return yield* Effect.fail(new NotFoundError("Diagram", id));
		}

		return results[0];
	});

export const listDiagrams = () =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;

		return yield* service.query<Diagram>(
			`SELECT * FROM diagrams ORDER BY updated_at DESC`,
		);
	});

export const updateDiagram = (id: string, input: UpdateDiagramInput) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		const now = Date.now();

		// Build dynamic update query
		const updates: string[] = [];
		const values: unknown[] = [];

		if (input.name !== undefined) {
			updates.push("name = ?");
			values.push(input.name);
		}
		if (input.description !== undefined) {
			updates.push("description = ?");
			values.push(input.description);
		}

		if (updates.length === 0) {
			return yield* getDiagram(id);
		}

		updates.push("updated_at = ?");
		values.push(now);
		values.push(id);

		yield* service.execute(
			`UPDATE diagrams SET ${updates.join(", ")} WHERE id = ?`,
			values,
		);

		return yield* getDiagram(id);
	});

export const deleteDiagram = (id: string) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;

		yield* service.execute(`DELETE FROM diagrams WHERE id = ?`, [id]);
	});

// ============================================================================
// Node CRUD Operations
// ============================================================================

export const createNode = (input: CreateNodeInput) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		const now = Date.now();

		yield* service.execute(
			`INSERT INTO nodes (id, diagram_id, type, label, technology, description, position_x, position_y, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				input.id,
				input.diagram_id,
				input.type,
				input.label,
				input.technology ?? null,
				input.description ?? null,
				input.position_x,
				input.position_y,
				now,
				now,
			],
		);

		return {
			id: input.id,
			diagram_id: input.diagram_id,
			type: input.type,
			label: input.label,
			technology: input.technology ?? null,
			description: input.description ?? null,
			position_x: input.position_x,
			position_y: input.position_y,
			created_at: now,
			updated_at: now,
		} satisfies Node;
	});

export const getNodesByDiagram = (diagramId: string) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;

		return yield* service.query<Node>(
			`SELECT * FROM nodes WHERE diagram_id = ?`,
			[diagramId],
		);
	});

export const updateNode = (id: string, input: UpdateNodeInput) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		const now = Date.now();

		const updates: string[] = [];
		const values: unknown[] = [];

		if (input.label !== undefined) {
			updates.push("label = ?");
			values.push(input.label);
		}
		if (input.technology !== undefined) {
			updates.push("technology = ?");
			values.push(input.technology);
		}
		if (input.description !== undefined) {
			updates.push("description = ?");
			values.push(input.description);
		}
		if (input.position_x !== undefined) {
			updates.push("position_x = ?");
			values.push(input.position_x);
		}
		if (input.position_y !== undefined) {
			updates.push("position_y = ?");
			values.push(input.position_y);
		}

		if (updates.length === 0) {
			return;
		}

		updates.push("updated_at = ?");
		values.push(now);
		values.push(id);

		yield* service.execute(
			`UPDATE nodes SET ${updates.join(", ")} WHERE id = ?`,
			values,
		);
	});

export const deleteNode = (id: string) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;

		yield* service.execute(`DELETE FROM nodes WHERE id = ?`, [id]);
	});

// ============================================================================
// Edge CRUD Operations
// ============================================================================

export const createEdge = (input: CreateEdgeInput) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		const now = Date.now();

		yield* service.execute(
			`INSERT INTO edges (id, diagram_id, source, target, label, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				input.id,
				input.diagram_id,
				input.source,
				input.target,
				input.label ?? null,
				now,
				now,
			],
		);

		return {
			id: input.id,
			diagram_id: input.diagram_id,
			source: input.source,
			target: input.target,
			label: input.label ?? null,
			created_at: now,
			updated_at: now,
		} satisfies Edge;
	});

export const getEdgesByDiagram = (diagramId: string) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;

		return yield* service.query<Edge>(
			`SELECT * FROM edges WHERE diagram_id = ?`,
			[diagramId],
		);
	});

export const deleteEdge = (id: string) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;

		yield* service.execute(`DELETE FROM edges WHERE id = ?`, [id]);
	});
