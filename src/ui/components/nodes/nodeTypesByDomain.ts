/**
 * Which component draws a node, per domain.
 *
 * ADR-016 Phase 4a. The three types a storm shares with C4 and DDD are a Shared
 * Kernel — one `domainEvent`, one row, one CHECK constraint — so a storm can be
 * promoted into a DDD model without translating anything. That sharing is
 * deliberate, and worth keeping small.
 *
 * What is not shared is the drawing. One renderer serving three vocabularies
 * would mean C4's rendering changes whenever Event Storming does: a stable
 * context depending on a volatile one, which is the coupling inversion this
 * codebase's own model exists to warn about. So the model is shared and the
 * presentation is resolved per domain.
 *
 * That is also the Functional Core / Imperative Shell line. The type is core;
 * choosing how to draw it is shell, and variation belongs in the shell.
 */

import type { NodeTypes } from "@xyflow/react";
import { EVENT_STORMING_STICKIES } from "../../../core/effects/event-storming";
import type { NodeDomain } from "../../../core/effects/node-operations";
import { ACLNode } from "./ACLNode";
import { AggregateNode } from "./AggregateNode";
import { ApplicationServiceNode } from "./ApplicationServiceNode";
import { BoundedContextNode } from "./BoundedContextNode";
import { CommandNode } from "./CommandNode";
import { ComponentNode } from "./ComponentNode";
import { ContainerNode } from "./ContainerNode";
import { DomainEventNode } from "./DomainEventNode";
import { DomainServiceNode } from "./DomainServiceNode";
import { EntityNode } from "./EntityNode";
import { ExternalSystemNode } from "./ExternalSystemNode";
import { FactoryNode } from "./FactoryNode";
import { IntegrationEventNode } from "./IntegrationEventNode";
import { PersonNode } from "./PersonNode";
import { QueryNode } from "./QueryNode";
import { RepositoryNode } from "./RepositoryNode";
import { SagaNode } from "./SagaNode";
import { StickyNode } from "./StickyNode";
import { SystemNode } from "./SystemNode";
import { ValueObjectNode } from "./ValueObjectNode";

/** How C4 and DDD have always drawn things. Unchanged by Event Storming existing. */
const MODELLING_NODE_TYPES: NodeTypes = {
  // C4
  person: PersonNode,
  system: SystemNode,
  externalSystem: ExternalSystemNode,
  container: ContainerNode,
  component: ComponentNode,
  // DDD strategic
  boundedContext: BoundedContextNode,
  aggregate: AggregateNode,
  domainEvent: DomainEventNode,
  // DDD tactical
  entity: EntityNode,
  valueObject: ValueObjectNode,
  domainService: DomainServiceNode,
  repository: RepositoryNode,
  factory: FactoryNode,
  // DDD application
  command: CommandNode,
  query: QueryNode,
  applicationService: ApplicationServiceNode,
  // DDD infrastructure
  integrationEvent: IntegrationEventNode,
  antiCorruptionLayer: ACLNode,
  saga: SagaNode,
  // Event Storming's own two, which nothing else draws
  hotspot: StickyNode,
  opportunity: StickyNode,
};

/**
 * A storm draws its whole vocabulary as stickies, including the types it borrows.
 * The rest stay drawn as they are, so a board still holding nodes from before a
 * mode switch does not go blank — which would read as data loss.
 */
const EVENT_STORMING_NODE_TYPES: NodeTypes = {
  ...MODELLING_NODE_TYPES,
  ...Object.fromEntries(EVENT_STORMING_STICKIES.map((sticky) => [sticky.type, StickyNode])),
};

/**
 * Built once per domain, never per render: ReactFlow remounts every node when
 * this object's identity changes, so a fresh map each render would remount the
 * board on every keystroke.
 */
const BY_DOMAIN: Record<NodeDomain, NodeTypes> = {
  c4: MODELLING_NODE_TYPES,
  ddd: MODELLING_NODE_TYPES,
  eventStorming: EVENT_STORMING_NODE_TYPES,
};

export const nodeTypesForDomain = (domain: NodeDomain): NodeTypes => BY_DOMAIN[domain];
