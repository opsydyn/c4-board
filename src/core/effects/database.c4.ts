import { Effect } from "effect";
import { DatabaseService, NotFoundError } from "./database.base";

// ============================================================================
// Domain Models (C4 + DDD)
// ============================================================================

export interface Diagram {
	id: string;
	name: string;
	description: string | null;
	created_at: number;
	updated_at: number;
}

/**
 * C4 Node Types
 */
export type C4NodeType = "person" | "system" | "externalSystem" | "container" | "component";

/**
 * DDD Node Types
 */
export type DDDNodeType =
	// Strategic DDD
	| "boundedContext"
	| "aggregate"
	| "domainEvent"
	// Tactical DDD
	| "entity"
	| "valueObject"
	| "domainService"
	| "repository"
	| "factory"
	// Application Layer
	| "command"
	| "query"
	| "applicationService"
	// Infrastructure
	| "integrationEvent"
	| "antiCorruptionLayer"
	| "saga";

/**
 * Combined Node Type (C4 + DDD)
 */
export type NodeType = C4NodeType | DDDNodeType;

/**
 * Node Domain
 */
export type NodeDomain = "c4" | "ddd";

/**
 * Node Model
 * Supports both C4 and DDD modeling domains
 */
export interface Node {
	id: string;
	diagram_id: string;
	domain: NodeDomain;
	type: NodeType;
	label: string;
	technology: string | null;
	description: string | null;
	position_x: number;
	position_y: number;
	width: number | null;
	height: number | null;
	parent_id: string | null;
	extent: "parent" | null;
	expand_parent: number;
	icon_id: string | null;

	// DDD-specific fields (nullable for C4 nodes)
	aggregate_root: string | null;
	invariants: string | null; // JSON array
	ubiquitous_language: string | null; // JSON array
	team_ownership: string | null;
	event_schema: string | null; // JSON schema
	identity_field: string | null;
	attributes: string | null; // JSON array
	parent_aggregate: string | null;
	parent_context: string | null;
	operations: string | null; // JSON array
	managed_aggregate: string | null;
	persistence_technology: string | null;
	created_objects: string | null; // JSON array
	creation_rules: string | null; // JSON array
	parameters: string | null; // JSON schema
	target_aggregate: string | null;
	return_type: string | null;
	use_cases: string | null; // JSON array
	dependencies: string | null; // JSON array
	publishing_context: string | null;
	subscribing_contexts: string | null; // JSON array
	from_context: string | null;
	to_context: string | null;
	translation_rules: string | null; // JSON array
	saga_steps: string | null; // JSON array
	compensation_logic: string | null; // JSON array

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

export interface CustomIcon {
	id: string;
	label: string | null;
	filename: string;
	mime_type: string;
	created_at: number;
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
	domain: NodeDomain;
	type: NodeType;
	label: string;
	technology?: string;
	description?: string;
	position_x: number;
	position_y: number;
	width?: number;
	height?: number;
	parent_id?: string;
	extent?: "parent";
	expand_parent?: boolean;
	icon_id?: string;

	// DDD-specific fields (optional)
	aggregate_root?: string;
	invariants?: string[]; // Will be JSON.stringified
	ubiquitous_language?: string[]; // Will be JSON.stringified
	team_ownership?: string;
	event_schema?: string;
	identity_field?: string;
	attributes?: string[]; // Will be JSON.stringified
	parent_aggregate?: string;
	parent_context?: string;
	operations?: string[]; // Will be JSON.stringified
	managed_aggregate?: string;
	persistence_technology?: string;
	created_objects?: string[]; // Will be JSON.stringified
	creation_rules?: string[]; // Will be JSON.stringified
	parameters?: string;
	target_aggregate?: string;
	return_type?: string;
	use_cases?: string[]; // Will be JSON.stringified
	dependencies?: string[]; // Will be JSON.stringified
	publishing_context?: string;
	subscribing_contexts?: string[]; // Will be JSON.stringified
	from_context?: string;
	to_context?: string;
	translation_rules?: string[]; // Will be JSON.stringified
	saga_steps?: string[]; // Will be JSON.stringified
	compensation_logic?: string[]; // Will be JSON.stringified
}

export interface UpdateNodeInput {
	label?: string;
	technology?: string;
	description?: string;
	position_x?: number;
	position_y?: number;
	width?: number;
	height?: number;
	parent_id?: string;
	extent?: "parent";
	expand_parent?: boolean;
	icon_id?: string | null;
}

export interface CreateEdgeInput {
	id: string;
	diagram_id: string;
	source: string;
	target: string;
	label?: string;
}

export interface UpsertCustomIconInput {
	id: string;
	filename: string;
	mime_type: string;
	label?: string | null;
}

// ============================================================================
// Diagram CRUD
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
			return yield* Effect.fail(new NotFoundError({ entity: "Diagram", id }));
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
		values.push(now, id);

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
// Node CRUD
// ============================================================================

export const createNode = (input: CreateNodeInput) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		const now = Date.now();

		// Helper to convert arrays to JSON strings
		const toJson = (arr?: string[]) => (arr ? JSON.stringify(arr) : null);

		yield* service.execute(
			`INSERT INTO nodes (
				id, diagram_id, domain, type, label, technology, description,
				position_x, position_y, width, height, parent_id, extent, expand_parent, icon_id,
				aggregate_root, invariants, ubiquitous_language, team_ownership, event_schema,
				identity_field, attributes, parent_aggregate, parent_context, operations,
				managed_aggregate, persistence_technology, created_objects, creation_rules,
				parameters, target_aggregate, return_type, use_cases, dependencies,
				publishing_context, subscribing_contexts, from_context, to_context, translation_rules,
				saga_steps, compensation_logic,
				created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				input.id,
				input.diagram_id,
				input.domain,
				input.type,
				input.label,
				input.technology ?? null,
				input.description ?? null,
				input.position_x,
				input.position_y,
				input.width ?? null,
				input.height ?? null,
				input.parent_id ?? null,
				input.extent ?? null,
				input.expand_parent ? 1 : 0,
				input.icon_id ?? null,
				// DDD fields
				input.aggregate_root ?? null,
				toJson(input.invariants),
				toJson(input.ubiquitous_language),
				input.team_ownership ?? null,
				input.event_schema ?? null,
				input.identity_field ?? null,
				toJson(input.attributes),
				input.parent_aggregate ?? null,
				input.parent_context ?? null,
				toJson(input.operations),
				input.managed_aggregate ?? null,
				input.persistence_technology ?? null,
				toJson(input.created_objects),
				toJson(input.creation_rules),
				input.parameters ?? null,
				input.target_aggregate ?? null,
				input.return_type ?? null,
				toJson(input.use_cases),
				toJson(input.dependencies),
				input.publishing_context ?? null,
				toJson(input.subscribing_contexts),
				input.from_context ?? null,
				input.to_context ?? null,
				toJson(input.translation_rules),
				toJson(input.saga_steps),
				toJson(input.compensation_logic),
				now,
				now,
			],
		);

		return {
			id: input.id,
			diagram_id: input.diagram_id,
			domain: input.domain,
			type: input.type,
			label: input.label,
			technology: input.technology ?? null,
			description: input.description ?? null,
			position_x: input.position_x,
			position_y: input.position_y,
			width: input.width ?? null,
			height: input.height ?? null,
			parent_id: input.parent_id ?? null,
			extent: input.extent ?? null,
			expand_parent: input.expand_parent ? 1 : 0,
			icon_id: input.icon_id ?? null,
			// DDD fields
			aggregate_root: input.aggregate_root ?? null,
			invariants: toJson(input.invariants),
			ubiquitous_language: toJson(input.ubiquitous_language),
			team_ownership: input.team_ownership ?? null,
			event_schema: input.event_schema ?? null,
			identity_field: input.identity_field ?? null,
			attributes: toJson(input.attributes),
			parent_aggregate: input.parent_aggregate ?? null,
			parent_context: input.parent_context ?? null,
			operations: toJson(input.operations),
			managed_aggregate: input.managed_aggregate ?? null,
			persistence_technology: input.persistence_technology ?? null,
			created_objects: toJson(input.created_objects),
			creation_rules: toJson(input.creation_rules),
			parameters: input.parameters ?? null,
			target_aggregate: input.target_aggregate ?? null,
			return_type: input.return_type ?? null,
			use_cases: toJson(input.use_cases),
			dependencies: toJson(input.dependencies),
			publishing_context: input.publishing_context ?? null,
			subscribing_contexts: toJson(input.subscribing_contexts),
			from_context: input.from_context ?? null,
			to_context: input.to_context ?? null,
			translation_rules: toJson(input.translation_rules),
			saga_steps: toJson(input.saga_steps),
			compensation_logic: toJson(input.compensation_logic),
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
			values.push(input.technology ?? null);
		}
		if (input.description !== undefined) {
			updates.push("description = ?");
			values.push(input.description ?? null);
		}
		if (input.position_x !== undefined) {
			updates.push("position_x = ?");
			values.push(input.position_x);
		}
		if (input.position_y !== undefined) {
			updates.push("position_y = ?");
			values.push(input.position_y);
		}
		if (input.width !== undefined) {
			updates.push("width = ?");
			values.push(input.width ?? null);
		}
		if (input.height !== undefined) {
			updates.push("height = ?");
			values.push(input.height ?? null);
		}
		if (input.parent_id !== undefined) {
			updates.push("parent_id = ?");
			values.push(input.parent_id ?? null);
		}
		if (input.extent !== undefined) {
			updates.push("extent = ?");
			values.push(input.extent ?? null);
		}
		if (input.expand_parent !== undefined) {
			updates.push("expand_parent = ?");
			values.push(input.expand_parent ? 1 : 0);
		}
		if (input.icon_id !== undefined) {
			updates.push("icon_id = ?");
			values.push(input.icon_id ?? null);
		}

		if (updates.length === 0) {
			return;
		}

		updates.push("updated_at = ?");
		values.push(now, id);

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
// Edge CRUD
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

export const updateEdgeLabel = (edgeId: string, label: string) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		const now = Date.now();

		yield* service.execute(
			`UPDATE edges SET label = ?, updated_at = ? WHERE id = ?`,
			[label, now, edgeId],
		);

		// Return updated edge
		const rows = yield* service.query<Edge>(
			`SELECT * FROM edges WHERE id = ?`,
			[edgeId],
		);

		if (rows.length === 0) {
			return yield* Effect.fail(
				new Error(`Edge ${edgeId} not found after update`),
			);
		}

		return rows[0];
	});

// ============================================================================
// Custom Icons
// ============================================================================

export const upsertCustomIcon = (input: UpsertCustomIconInput) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		const now = Date.now();

		yield* service.execute(
			`INSERT INTO custom_icons (id, label, filename, mime_type, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         label = excluded.label,
         filename = excluded.filename,
         mime_type = excluded.mime_type`,
			[input.id, input.label ?? null, input.filename, input.mime_type, now],
		);

		return {
			id: input.id,
			label: input.label ?? null,
			filename: input.filename,
			mime_type: input.mime_type,
			created_at: now,
		} satisfies CustomIcon;
	});

export const listCustomIcons = () =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		return yield* service.query<CustomIcon>(
			`SELECT * FROM custom_icons ORDER BY created_at DESC`,
		);
	});

export const deleteCustomIcon = (id: string) =>
	Effect.gen(function* () {
		const service = yield* DatabaseService;
		yield* service.execute(`DELETE FROM custom_icons WHERE id = ?`, [id]);
	});
