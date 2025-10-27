/**
 * C4 Model Schema Definitions (Effect Schema)
 *
 * Defines the type-safe schema for C4 architecture diagrams using Effect's Schema.
 * Following the "Functional Core" principle - pure data validation only.
 */

import * as S from "effect/Schema";

/**
 * C4 Element Types
 */
export const C4ElementType = S.Union(
	S.Literal("person" as const),
	S.Literal("system" as const),
	S.Literal("externalSystem" as const),
	S.Literal("container" as const),
	S.Literal("component" as const),
	S.Literal("relationship" as const),
);

export type C4ElementType = S.Schema.Type<typeof C4ElementType>;

/**
 * Position on the canvas
 */
export const Position = S.Struct({
	x: S.Number,
	y: S.Number,
});

export type Position = S.Schema.Type<typeof Position>;

/**
 * Person (User, Actor, Role)
 * Represents a human user of the system
 */
export const Person = S.Struct({
	id: S.String,
	type: S.Literal("person" as const),
	name: S.String.pipe(S.minLength(1)),
	description: S.optional(S.String),
	technology: S.optional(S.String), // e.g., "Customer", "Internal User"
	position: Position,
});

export type Person = S.Schema.Type<typeof Person>;

/**
 * Software System
 * Represents a software system in your architecture
 */
export const SoftwareSystem = S.Struct({
	id: S.String,
	type: S.Literal("system" as const),
	name: S.String.pipe(S.minLength(1)),
	description: S.optional(S.String),
	technology: S.optional(S.String), // e.g., "Java, Spring Boot"
	position: Position,
	external: S.optional(S.Boolean).pipe(
		S.withDefaults({ constructor: () => false as const, decoding: () => false as const }),
	), // Is this an external system?
});

export type SoftwareSystem = S.Schema.Type<typeof SoftwareSystem>;

/**
 * External System
 * Convenience type for external software systems
 */
export const ExternalSystem = S.extend(SoftwareSystem, S.Struct({
	type: S.Literal("externalSystem" as const),
	external: S.Literal(true as const),
}));

export type ExternalSystem = S.Schema.Type<typeof ExternalSystem>;

/**
 * Container (Application, Database, etc.)
 */
export const Container = S.Struct({
	id: S.String,
	type: S.Literal("container" as const),
	name: S.String.pipe(S.minLength(1)),
	description: S.optional(S.String),
	technology: S.optional(S.String),
	position: Position,
});

export type Container = S.Schema.Type<typeof Container>;

/**
 * Component (Module inside a container)
 */
export const Component = S.Struct({
	id: S.String,
	type: S.Literal("component" as const),
	name: S.String.pipe(S.minLength(1)),
	description: S.optional(S.String),
	technology: S.optional(S.String),
	position: Position,
});

export type Component = S.Schema.Type<typeof Component>;

/**
 * Relationship (Connection between elements)
 * Represents how elements interact
 */
export const Relationship = S.Struct({
	id: S.String,
	type: S.Literal("relationship" as const),
	source: S.String, // ID of source element
	target: S.String, // ID of target element
	description: S.optional(S.String), // e.g., "Makes API calls to"
	technology: S.optional(S.String), // e.g., "HTTPS, JSON/REST"
});

export type Relationship = S.Schema.Type<typeof Relationship>;

/**
 * Union of all C4 elements
 */
export const C4Element = S.Union(
	Person,
	SoftwareSystem,
	ExternalSystem,
	Container,
	Component,
	Relationship,
);

export type C4Element = S.Schema.Type<typeof C4Element>;

/**
 * C4 Model (complete diagram)
 * Contains all elements and relationships
 */
export const C4Model = S.Struct({
	id: S.String,
	name: S.String.pipe(S.minLength(1)),
	description: S.optional(S.String),
	level: S.optional(
		S.Union(
			S.Literal("context" as const),
			S.Literal("container" as const),
			S.Literal("component" as const),
			S.Literal("code" as const),
		),
	).pipe(S.withDefaults({ constructor: () => "context" as const, decoding: () => "context" as const })),
	elements: S.Array(C4Element),
	createdAt: S.String, // consider Schema.DateFromString for stricter validation
	updatedAt: S.String,
});

export type C4Model = S.Schema.Type<typeof C4Model>;

/**
 * ReactFlow Node Data
 * Bridge between C4 schema and ReactFlow's node format
 */
export const ReactFlowNodeData = S.Struct({
	label: S.String,
	description: S.optional(S.String),
	technology: S.optional(S.String),
	c4Type: C4ElementType,
});

export type ReactFlowNodeData = S.Schema.Type<typeof ReactFlowNodeData>;
