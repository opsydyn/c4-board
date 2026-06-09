/**
 * DDD Model Schema Definitions (Effect Schema)
 *
 * Domain-Driven Design modeling types, separate from C4.
 * Following the "Functional Core" principle - pure data validation only.
 */

import * as S from "effect/Schema";
import { Position } from "./c4"; // Reuse Position from C4

/**
 * DDD Element Types
 */
export const DDDElementType = S.Union(
  // Strategic DDD
  S.Literal("boundedContext"),
  S.Literal("aggregate"),
  S.Literal("domainEvent"),
  // Tactical DDD
  S.Literal("entity"),
  S.Literal("valueObject"),
  S.Literal("domainService"),
  S.Literal("repository"),
  S.Literal("factory"),
  // Application Layer
  S.Literal("command"),
  S.Literal("query"),
  S.Literal("applicationService"),
  // Infrastructure
  S.Literal("integrationEvent"),
  S.Literal("antiCorruptionLayer"),
  S.Literal("saga"),
);

export type DDDElementType = S.Schema.Type<typeof DDDElementType>;

/**
 * Bounded Context
 * Strategic DDD: Define boundaries where a specific domain model applies
 */
export const BoundedContext = S.Struct({
  id: S.String,
  type: S.Literal("boundedContext"),
  name: S.String.pipe(S.minLength(1)),
  description: S.optional(S.String),
  ubiquitousLanguage: S.optional(S.Array(S.String)), // Domain-specific terms
  teamOwnership: S.optional(S.String), // Team responsible for this context
  position: Position,
});

export type BoundedContext = S.Schema.Type<typeof BoundedContext>;

/**
 * Aggregate
 * Tactical DDD: Cluster of domain objects treated as a single unit
 */
export const Aggregate = S.Struct({
  id: S.String,
  type: S.Literal("aggregate"),
  name: S.String.pipe(S.minLength(1)),
  description: S.optional(S.String),
  aggregateRoot: S.optional(S.String), // Name of the root entity
  invariants: S.optional(S.Array(S.String)), // Business rules that must be maintained
  position: Position,
  parentContext: S.optional(S.String), // Link to bounded context
});

export type Aggregate = S.Schema.Type<typeof Aggregate>;

/**
 * Domain Event
 * Tactical DDD: Something significant that happened in the domain
 */
export const DomainEvent = S.Struct({
  id: S.String,
  type: S.Literal("domainEvent"),
  name: S.String.pipe(S.minLength(1)),
  description: S.optional(S.String),
  eventSchema: S.optional(S.String), // JSON schema of event data
  triggeringAggregate: S.optional(S.String), // Which aggregate raises this event
  position: Position,
});

export type DomainEvent = S.Schema.Type<typeof DomainEvent>;

/**
 * Entity
 * Tactical DDD: Domain object with unique identity
 */
export const Entity = S.Struct({
  id: S.String,
  type: S.Literal("entity"),
  name: S.String.pipe(S.minLength(1)),
  description: S.optional(S.String),
  identityField: S.optional(S.String), // Name of the field that provides identity
  attributes: S.optional(S.Array(S.String)), // Entity attributes
  position: Position,
  parentAggregate: S.optional(S.String), // Link to parent aggregate
});

export type Entity = S.Schema.Type<typeof Entity>;

/**
 * Value Object
 * Tactical DDD: Immutable object defined by its attributes
 */
export const ValueObject = S.Struct({
  id: S.String,
  type: S.Literal("valueObject"),
  name: S.String.pipe(S.minLength(1)),
  description: S.optional(S.String),
  attributes: S.optional(S.Array(S.String)), // Value object attributes (no identity)
  position: Position,
  parentAggregate: S.optional(S.String), // Link to parent aggregate
});

export type ValueObject = S.Schema.Type<typeof ValueObject>;

/**
 * Domain Service
 * Tactical DDD: Operation that doesn't belong to an entity or value object
 */
export const DomainService = S.Struct({
  id: S.String,
  type: S.Literal("domainService"),
  name: S.String.pipe(S.minLength(1)),
  description: S.optional(S.String),
  operations: S.optional(S.Array(S.String)), // Service operations/methods
  position: Position,
});

export type DomainService = S.Schema.Type<typeof DomainService>;

/**
 * Repository
 * Tactical DDD: Abstraction for aggregate persistence
 */
export const Repository = S.Struct({
  id: S.String,
  type: S.Literal("repository"),
  name: S.String.pipe(S.minLength(1)),
  description: S.optional(S.String),
  managedAggregate: S.optional(S.String), // Which aggregate this repository manages
  persistenceTechnology: S.optional(S.String), // e.g., "PostgreSQL", "MongoDB"
  position: Position,
});

export type Repository = S.Schema.Type<typeof Repository>;

/**
 * Factory
 * Tactical DDD: Complex object creation logic
 */
export const Factory = S.Struct({
  id: S.String,
  type: S.Literal("factory"),
  name: S.String.pipe(S.minLength(1)),
  description: S.optional(S.String),
  createdObjects: S.optional(S.Array(S.String)), // Types of objects it creates
  creationRules: S.optional(S.Array(S.String)), // Creation logic/rules
  position: Position,
});

export type Factory = S.Schema.Type<typeof Factory>;

/**
 * Command
 * Application Layer: Intent to change system state
 */
export const Command = S.Struct({
  id: S.String,
  type: S.Literal("command"),
  name: S.String.pipe(S.minLength(1)),
  description: S.optional(S.String),
  parameters: S.optional(S.String), // JSON schema of command parameters
  targetAggregate: S.optional(S.String), // Which aggregate the command targets
  position: Position,
});

export type Command = S.Schema.Type<typeof Command>;

/**
 * Query
 * Application Layer: Request for data without side effects
 */
export const Query = S.Struct({
  id: S.String,
  type: S.Literal("query"),
  name: S.String.pipe(S.minLength(1)),
  description: S.optional(S.String),
  parameters: S.optional(S.String), // JSON schema of query parameters
  returnType: S.optional(S.String), // What data the query returns
  position: Position,
});

export type Query = S.Schema.Type<typeof Query>;

/**
 * Application Service
 * Application Layer: Orchestrates domain operations, coordinates use cases
 */
export const ApplicationService = S.Struct({
  id: S.String,
  type: S.Literal("applicationService"),
  name: S.String.pipe(S.minLength(1)),
  description: S.optional(S.String),
  useCases: S.optional(S.Array(S.String)), // Use cases this service handles
  dependencies: S.optional(S.Array(S.String)), // Services/repositories it depends on
  position: Position,
});

export type ApplicationService = S.Schema.Type<typeof ApplicationService>;

/**
 * Integration Event
 * Infrastructure: Event published across bounded contexts
 */
export const IntegrationEvent = S.Struct({
  id: S.String,
  type: S.Literal("integrationEvent"),
  name: S.String.pipe(S.minLength(1)),
  description: S.optional(S.String),
  eventSchema: S.optional(S.String), // JSON schema of event data
  publishingContext: S.optional(S.String), // Which context publishes this
  subscribingContexts: S.optional(S.Array(S.String)), // Contexts that subscribe
  position: Position,
});

export type IntegrationEvent = S.Schema.Type<typeof IntegrationEvent>;

/**
 * Anti-Corruption Layer (ACL)
 * Infrastructure: Translation layer between contexts
 */
export const AntiCorruptionLayer = S.Struct({
  id: S.String,
  type: S.Literal("antiCorruptionLayer"),
  name: S.String.pipe(S.minLength(1)),
  description: S.optional(S.String),
  fromContext: S.optional(S.String), // Source context
  toContext: S.optional(S.String), // Target context
  translationRules: S.optional(S.Array(S.String)), // How data is translated
  position: Position,
});

export type AntiCorruptionLayer = S.Schema.Type<typeof AntiCorruptionLayer>;

/**
 * Saga / Process Manager
 * Infrastructure: Long-running transaction coordinator
 */
export const Saga = S.Struct({
  id: S.String,
  type: S.Literal("saga"),
  name: S.String.pipe(S.minLength(1)),
  description: S.optional(S.String),
  sagaSteps: S.optional(S.Array(S.String)), // Steps in the saga
  compensationLogic: S.optional(S.Array(S.String)), // Rollback logic for each step
  position: Position,
});

export type Saga = S.Schema.Type<typeof Saga>;

/**
 * Union of all DDD elements
 */
export const DDDElement = S.Union(
  BoundedContext,
  Aggregate,
  DomainEvent,
  Entity,
  ValueObject,
  DomainService,
  Repository,
  Factory,
  Command,
  Query,
  ApplicationService,
  IntegrationEvent,
  AntiCorruptionLayer,
  Saga,
);

export type DDDElement = S.Schema.Type<typeof DDDElement>;

/**
 * ReactFlow Node Data for DDD
 * Bridge between DDD schema and ReactFlow's node format
 */
export const ReactFlowDDDNodeData = S.Struct({
  label: S.String,
  description: S.optional(S.String),
  dddType: DDDElementType,
  iconId: S.optional(S.String),

  // Strategic DDD fields
  ubiquitousLanguage: S.optional(S.Array(S.String)),
  teamOwnership: S.optional(S.String),
  aggregateRoot: S.optional(S.String),
  invariants: S.optional(S.Array(S.String)),
  parentContext: S.optional(S.String),

  // Tactical DDD fields
  identityField: S.optional(S.String),
  attributes: S.optional(S.Array(S.String)),
  parentAggregate: S.optional(S.String),
  operations: S.optional(S.Array(S.String)),
  managedAggregate: S.optional(S.String),
  persistenceTechnology: S.optional(S.String),
  createdObjects: S.optional(S.Array(S.String)),
  creationRules: S.optional(S.Array(S.String)),

  // Application Layer fields
  parameters: S.optional(S.String),
  targetAggregate: S.optional(S.String),
  returnType: S.optional(S.String),
  useCases: S.optional(S.Array(S.String)),
  dependencies: S.optional(S.Array(S.String)),

  // Infrastructure fields
  eventSchema: S.optional(S.String),
  triggeringAggregate: S.optional(S.String),
  publishingContext: S.optional(S.String),
  subscribingContexts: S.optional(S.Array(S.String)),
  fromContext: S.optional(S.String),
  toContext: S.optional(S.String),
  translationRules: S.optional(S.Array(S.String)),
  sagaSteps: S.optional(S.Array(S.String)),
  compensationLogic: S.optional(S.Array(S.String)),
});

export type ReactFlowDDDNodeData = S.Schema.Type<typeof ReactFlowDDDNodeData>;
