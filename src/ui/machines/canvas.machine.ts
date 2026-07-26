/**
 * Canvas Machine (XState)
 *
 * IMPERATIVE SHELL - Orchestrates canvas interactions and persistence.
 * Manages user flows: adding nodes, selecting, editing, connecting, saving/loading.
 *
 * This machine coordinates WHEN to run effects, but delegates all business logic
 * to the functional core (Effect services).
 */

import type { Edge, EdgeChange, Node, NodeChange, Viewport } from "@xyflow/react";
import { applyEdgeChanges, applyNodeChanges } from "@xyflow/react";
import { Effect } from "effect";
import { type AnyStateMachine, assign, setup } from "xstate";
import * as DiagramOps from "../../core/effects/diagram-operations";
import * as EdgeOps from "../../core/effects/edge-operations";
import type { EdgeData, EdgeMetadata } from "../../core/effects/edge-operations";
import { eventStormingStickyFor } from "../../core/effects/event-storming";
import {
  DEFAULT_MERMAID_DIALECT,
  exportMermaidForDialect,
  type MermaidDialect,
} from "../../core/effects/export-mermaid-dialect";
import * as PlantUMLExport from "../../core/effects/export-plantuml-c4";
import * as MermaidImport from "../../core/effects/import-mermaid";
import * as PlantUMLImport from "../../core/effects/import-plantuml-c4";
import {
  autoLayout,
  autoLayoutSelected,
  getPreset,
  LAYOUT_AUDIT_RETENTION_LIMIT,
  type LayoutApplicationAudit,
  type LayoutOptions,
  type LayoutPresetName,
} from "../../core/effects/layout";
import type { NodeDomain } from "../../core/effects/node-operations";
import * as NodeOps from "../../core/effects/node-operations";

/** Re-exported, not redeclared: one source, so widening it is one edit (ADR-016). */
export type DiagramDomain = NodeDomain;

export type CanvasEvent =
  // === Domain Toggle ===
  | { type: "SET_DOMAIN"; domain: DiagramDomain }
  // === C4 Architecture Events ===
  | { type: "ADD_PERSON" }
  | { type: "ADD_SYSTEM" }
  | { type: "ADD_EXTERNAL_SYSTEM" }
  | { type: "ADD_CONTAINER" }
  | { type: "ADD_COMPONENT" }
  // === DDD Strategic Events ===
  | { type: "ADD_BOUNDED_CONTEXT" }
  | { type: "ADD_AGGREGATE" }
  | { type: "ADD_DOMAIN_EVENT" }
  // === DDD Tactical Events ===
  | { type: "ADD_ENTITY" }
  | { type: "ADD_VALUE_OBJECT" }
  | { type: "ADD_DOMAIN_SERVICE" }
  | { type: "ADD_REPOSITORY" }
  | { type: "ADD_FACTORY" }
  // === DDD Application Events ===
  | { type: "ADD_COMMAND" }
  | { type: "ADD_QUERY" }
  | { type: "ADD_APPLICATION_SERVICE" }
  // === DDD Infrastructure Events ===
  | { type: "ADD_INTEGRATION_EVENT" }
  | { type: "ADD_ACL" }
  | { type: "ADD_SAGA" }
  // === Canvas Events ===
  | { type: "SELECT_NODE"; nodeId: string }
  | { type: "DESELECT_NODE" }
  | { type: "TOGGLE_ANIMATIONS" }
  | { type: "AUTO_LAYOUT"; preset?: LayoutPresetName; options?: Partial<LayoutOptions> }
  | { type: "AUTO_LAYOUT_SELECTED"; preset?: LayoutPresetName; options?: Partial<LayoutOptions> }
  | { type: "DELETE_LAYOUT_AUDIT_SUCCESS"; appliedAt: number }
  | { type: "CLEAR_LAYOUT_AUDITS_SUCCESS" }
  | {
    type: "APPLY_LAYOUT_PREVIEW";
    preset: LayoutPresetName;
    nodes: Node[];
    edges: Edge[];
    audit: LayoutApplicationAudit;
  }
  | {
    type: "UPDATE_NODE";
    nodeId: string;
    updates: Partial<NodeOps.NodeData>;
  }
  | { type: "DELETE_NODE"; nodeId: string }
  | { type: "DUPLICATE_NODE"; nodeId: string }
  | { type: "CHANGE_NODE_TYPE"; nodeId: string; nodeType: string }
  | { type: "CONNECT_NODES"; source: string; target: string; label?: string }
  | { type: "UPDATE_EDGE_LABEL"; edgeId: string; label: string }
  | { type: "UPDATE_EDGE_METADATA"; edgeId: string; metadata: EdgeMetadata }
  | { type: "DELETE_EDGE"; edgeId: string }
  | { type: "CHANGE_EDGE_STYLE"; edgeId: string; style: "solid" | "dashed" | "dotted" }
  | { type: "REVERSE_EDGE_DIRECTION"; edgeId: string }
  | { type: "NODES_CHANGED"; changes: NodeChange[] }
  | { type: "EDGES_CHANGED"; changes: EdgeChange[] }
  // Context menu events
  | { type: "SHOW_NODE_CONTEXT_MENU"; nodeId: string; position: { x: number; y: number } }
  | { type: "SHOW_EDGE_CONTEXT_MENU"; edgeId: string; position: { x: number; y: number } }
  | { type: "SHOW_CANVAS_CONTEXT_MENU"; position: { x: number; y: number } }
  | { type: "ADD_NODE"; nodeType: string }
  | { type: "ADD_NODE_AT_POSITION"; nodeType: string; position: { x: number; y: number } }
  | { type: "ADD_NODE_WITH_LABEL"; nodeType: NodeOps.C4Type; label: string }
  // Persistence events
  | { type: "CREATE_NEW_DIAGRAM"; name: string; description?: string }
  | { type: "CREATE_NEW_BOARD" }
  | { type: "LOAD_DIAGRAM"; diagramId: string }
  | { type: "SWITCH_BOARD"; diagramId: string }
  | {
    type: "LOAD_DIAGRAM_SUCCESS";
    diagram: {
      id: string;
      name: string;
      description?: string;
      nodes: Node[];
      edges: Edge[];
      updatedAt: number;
      layoutAudit?: LayoutApplicationAudit;
      layoutAudits?: LayoutApplicationAudit[];
    };
  }
  | { type: "LOAD_VISUAL_FIXTURE"; name: string; nodes: Node[]; edges: Edge[] }
  | { type: "SAVE_DIAGRAM" }
  | { type: "SAVE_SUCCESS" }
  | { type: "SAVE_ERROR"; error: string }
  | { type: "AUTO_SAVE" }
  | { type: "UPDATE_DIAGRAM_NAME"; name: string }
  | { type: "UPDATE_DIAGRAM_DESCRIPTION"; description: string }
  | { type: "UPDATE_SESSION_NAME"; name: string }
  // Export events
  | { type: "EXPORT_PLANTUML"; viewport?: Viewport }
  | { type: "EXPORT_MERMAID"; viewport?: Viewport }
  | { type: "SET_EXPORT_DIALECT"; dialect: MermaidDialect }
  | { type: "DISMISS_IMPORT_ERROR" }
  | { type: "CLOSE_EXPORT_MODAL" }
  // Import events
  | { type: "IMPORT_DIAGRAM"; content: string; format: "plantuml" | "mermaid"; mode: "replace" | "merge" };

export interface CanvasContext {
  // Canvas state
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  nodeCounter: number;
  currentDomain: DiagramDomain; // Current diagram domain (C4 or DDD)

  // UI preferences
  animationsEnabled: boolean; // Global toggle for visual + audio effects

  // Diagram metadata
  currentDiagramId: string | null;
  diagramName: string;
  diagramDescription: string | null;
  sessionName: string;

  // Persistence state
  isSaving: boolean;
  lastSaved: number | null;
  saveError: string | null;

  // Layout state
  previousLayout: Node[] | null; // For undo functionality
  currentLayout: LayoutPresetName | null; // Track currently applied layout preset
  lastLayoutAudit: LayoutApplicationAudit | null;
  layoutAudits: LayoutApplicationAudit[];

  // Export state
  exportModalOpen: boolean;
  exportFormat: "plantuml" | "mermaid" | null;
  exportedCode: string | null;
  /** Which Mermaid dialect the modal is showing (ADR-014). */
  exportDialect: MermaidDialect;
  /** Why the last import was refused, for the UI to show (null when fine). */
  importError: string | null;
  /** Kept so switching dialect can re-emit without another canvas round trip. */
  exportViewport: Viewport | null;

  // Viewport state (for import/export)
  viewport: Viewport | null;
}

/**
 * Run an Effect synchronously - XState actions must be sync
 * Extracts the value from Effect or throws if it fails
 */
function runEffectSync<A>(effect: Effect.Effect<A>): A {
  let result: A | undefined;
  let error: unknown;

  Effect.runSync(
    Effect.gen(function*() {
      try {
        result = yield* effect;
      } catch (e) {
        error = e;
        throw e;
      }
    }),
  );

  if (error) {
    throw error;
  }

  return result as A;
}

const canvasMachineDefinition = setup({
  types: {
    context: {} as CanvasContext,
    events: {} as CanvasEvent,
  },
  actions: {
    /**
     * One event for any node type, rather than one event per type.
     *
     * C4 and DDD each grew a machine event per node type — nineteen events
     * describing the same operation. Event Storming is where that stops being
     * worth repeating, so its palette is data-driven off EVENT_STORMING_STICKIES
     * and adding a sticky needs no machine change at all (ADR-016).
     */
    addNode: assign({
      nodes: ({ context, event }) => {
        if (event.type !== "ADD_NODE" || !NodeOps.isNodeType(event.nodeType)) {
          // A type the board cannot hold would be rejected by the database CHECK
          // on save; better never to create it.
          return context.nodes;
        }

        const newNode = runEffectSync(
          NodeOps.createNode({
            type: event.nodeType,
            label: defaultLabelForNodeType(event.nodeType),
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );

        return [...context.nodes, newNode];
      },
      nodeCounter: ({ context, event }) =>
        event.type === "ADD_NODE" && NodeOps.isNodeType(event.nodeType)
          ? context.nodeCounter + 1
          : context.nodeCounter,
    }),

    addPerson: assign({
      nodes: ({ context }) => {
        // Use Effect service for pure business logic
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "person",
            label: "New Person",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );

        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    addSystem: assign({
      nodes: ({ context }) => {
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "system",
            label: "New System",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );

        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    addExternalSystem: assign({
      nodes: ({ context }) => {
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "externalSystem",
            label: "External System",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );

        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    addContainer: assign({
      nodes: ({ context }) => {
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "container",
            label: "Container",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );

        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    addComponent: assign({
      nodes: ({ context }) => {
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "component",
            label: "Component",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );

        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    // === DDD Strategic Actions ===

    addBoundedContext: assign({
      nodes: ({ context }) => {
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "boundedContext",
            label: "Bounded Context",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );
        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    addAggregate: assign({
      nodes: ({ context }) => {
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "aggregate",
            label: "Aggregate",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );
        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    addDomainEvent: assign({
      nodes: ({ context }) => {
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "domainEvent",
            label: "Domain Event",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );
        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    // === DDD Tactical Actions ===

    addEntity: assign({
      nodes: ({ context }) => {
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "entity",
            label: "Entity",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );
        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    addValueObject: assign({
      nodes: ({ context }) => {
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "valueObject",
            label: "Value Object",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );
        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    addDomainService: assign({
      nodes: ({ context }) => {
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "domainService",
            label: "Domain Service",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );
        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    addRepository: assign({
      nodes: ({ context }) => {
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "repository",
            label: "Repository",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );
        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    addFactory: assign({
      nodes: ({ context }) => {
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "factory",
            label: "Factory",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );
        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    // === DDD Application Actions ===

    addCommand: assign({
      nodes: ({ context }) => {
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "command",
            label: "Command",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );
        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    addQuery: assign({
      nodes: ({ context }) => {
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "query",
            label: "Query",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );
        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    addApplicationService: assign({
      nodes: ({ context }) => {
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "applicationService",
            label: "Application Service",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );
        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    // === DDD Infrastructure Actions ===

    addIntegrationEvent: assign({
      nodes: ({ context }) => {
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "integrationEvent",
            label: "Integration Event",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );
        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    addACL: assign({
      nodes: ({ context }) => {
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "antiCorruptionLayer",
            label: "Anti-Corruption Layer",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );
        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    addSaga: assign({
      nodes: ({ context }) => {
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: "saga",
            label: "Saga",
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );
        return runEffectSync(NodeOps.addNode(context.nodes, newNode));
      },
      nodeCounter: ({ context }) => context.nodeCounter + 1,
    }),

    selectNode: assign({
      selectedNodeId: ({ event }) => {
        if (event.type !== "SELECT_NODE") return null;
        return event.nodeId;
      },
    }),

    deselectNode: assign({
      selectedNodeId: null,
    }),

    setDomain: assign({
      currentDomain: ({ event }) => {
        if (event.type !== "SET_DOMAIN") return "c4";
        return event.domain;
      },
    }),
    toggleAnimations: assign({
      animationsEnabled: ({ context }) => !context.animationsEnabled,
    }),

    updateNode: assign({
      nodes: ({ context, event }) => {
        if (event.type !== "UPDATE_NODE") return context.nodes;

        return runEffectSync(
          NodeOps.updateNodeData(context.nodes, event.nodeId, event.updates),
        );
      },
    }),

    deleteNode: assign({
      nodes: ({ context, event }) => {
        if (event.type !== "DELETE_NODE") return context.nodes;
        return runEffectSync(NodeOps.removeNode(context.nodes, event.nodeId));
      },
      edges: ({ context, event }) => {
        if (event.type !== "DELETE_NODE") return context.edges;
        // Remove edges connected to deleted node using Effect service
        return runEffectSync(
          EdgeOps.removeEdgesConnectedToNode(context.edges, event.nodeId),
        );
      },
      selectedNodeId: ({ context, event }) => {
        if (event.type !== "DELETE_NODE") return context.selectedNodeId;
        return context.selectedNodeId === event.nodeId
          ? null
          : context.selectedNodeId;
      },
    }),

    connectNodes: assign({
      edges: ({ context, event }) => {
        if (event.type !== "CONNECT_NODES") return context.edges;

        // Use custom label or default to "uses"
        const label = event.label ?? "uses";

        // Use Effect service for validation and creation
        // Validation errors will be caught and logged, returning unchanged edges
        const result = Effect.runSync(
          Effect.gen(function*() {
            return yield* EdgeOps.addValidatedEdge(
              context.edges,
              event.source,
              event.target,
              label,
            );
          }).pipe(
            Effect.catchAll((error) => {
              if (error instanceof EdgeOps.EdgeValidationError) {
                console.warn(`⚠️ ${error.message}`);
              }
              return Effect.succeed(context.edges); // Return unchanged edges on error
            }),
          ),
        );

        return result;
      },
    }),

    updateEdgeLabel: assign({
      edges: ({ context, event }) => {
        if (event.type !== "UPDATE_EDGE_LABEL") return context.edges;

        // Use Effect service for validation and update
        const result = Effect.runSync(
          Effect.gen(function*() {
            return yield* EdgeOps.updateEdgeLabel(
              context.edges,
              event.edgeId,
              event.label,
            );
          }).pipe(
            Effect.catchAll((error) => {
              if (error instanceof EdgeOps.EdgeValidationError) {
                console.warn(`⚠️ ${error.message}`);
              }
              return Effect.succeed(context.edges); // Return unchanged edges on error
            }),
          ),
        );

        return result;
      },
    }),

    updateEdgeMetadata: assign({
      edges: ({ context, event }) => {
        if (event.type !== "UPDATE_EDGE_METADATA") return context.edges;

        // Use Effect service to update metadata
        const result = Effect.runSync(
          Effect.gen(function*() {
            return yield* EdgeOps.updateEdgeMetadata(
              context.edges,
              event.edgeId,
              event.metadata,
            );
          }).pipe(
            Effect.catchAll((error) => {
              if (error instanceof EdgeOps.EdgeValidationError) {
                console.warn(`⚠️ ${error.message}`);
              }
              return Effect.succeed(context.edges); // Return unchanged edges on error
            }),
          ),
        );

        return result;
      },
    }),

    updateNodesFromReactFlow: assign({
      nodes: ({ context, event }) => {
        if (event.type !== "NODES_CHANGED") return context.nodes;
        // Apply ReactFlow changes to nodes using applyNodeChanges
        return applyNodeChanges(event.changes, context.nodes);
      },
    }),

    updateEdgesFromReactFlow: assign({
      edges: ({ context, event }) => {
        if (event.type !== "EDGES_CHANGED") return context.edges;
        // Apply ReactFlow changes to edges using applyEdgeChanges
        return applyEdgeChanges(event.changes, context.edges);
      },
    }),

    updateDiagramName: assign({
      diagramName: ({ context, event }) => {
        if (event.type !== "UPDATE_DIAGRAM_NAME") return context.diagramName;

        const metadata = runEffectSync(
          DiagramOps.updateDiagramName(
            {
              id: context.currentDiagramId,
              name: context.diagramName,
              description: context.diagramDescription,
              sessionName: context.sessionName,
            },
            event.name,
          ),
        );

        return metadata.name;
      },
    }),

    updateDiagramDescription: assign({
      diagramDescription: ({ context, event }) => {
        if (event.type !== "UPDATE_DIAGRAM_DESCRIPTION") return context.diagramDescription;

        const metadata = runEffectSync(
          DiagramOps.updateDiagramDescription(
            {
              id: context.currentDiagramId,
              name: context.diagramName,
              description: context.diagramDescription,
              sessionName: context.sessionName,
            },
            event.description,
          ),
        );

        return metadata.description;
      },
    }),

    updateSessionName: assign({
      sessionName: ({ context, event }) => {
        if (event.type !== "UPDATE_SESSION_NAME") return context.sessionName;

        const metadata = runEffectSync(
          DiagramOps.updateSessionName(
            {
              id: context.currentDiagramId,
              name: context.diagramName,
              description: context.diagramDescription,
              sessionName: context.sessionName,
            },
            event.name,
          ),
        );

        return metadata.sessionName;
      },
    }),

    applyLayout: assign({
      previousLayout: ({ context }) => context.nodes, // Save current layout for undo
      currentLayout: ({ event }) => {
        if (event.type !== "AUTO_LAYOUT") return null;
        return event.preset ?? "command"; // Default to command if no preset specified
      },
      nodes: ({ context, event }) => {
        if (event.type !== "AUTO_LAYOUT") return context.nodes;

        // Merge preset options with explicit options (explicit options take precedence)
        const presetOptions = event.preset ? getPreset(event.preset) : {};
        const mergedOptions = { ...presetOptions, ...event.options };

        return autoLayout(context.nodes, context.edges, mergedOptions);
      },
    }),

    applyLayoutSelected: assign({
      previousLayout: ({ context }) => context.nodes, // Save current layout for undo
      currentLayout: ({ event }) => {
        if (event.type !== "AUTO_LAYOUT_SELECTED") return null;
        return event.preset ?? "command"; // Default to command if no preset specified
      },
      nodes: ({ context, event }) => {
        if (event.type !== "AUTO_LAYOUT_SELECTED") return context.nodes;

        // Merge preset options with explicit options (explicit options take precedence)
        const presetOptions = event.preset ? getPreset(event.preset) : {};
        const mergedOptions = { ...presetOptions, ...event.options };

        // Get all selected nodes (ReactFlow stores selection in node.selected)
        const selectedNodeIds = context.nodes
          .filter((node) => node.selected)
          .map((node) => node.id);

        if (selectedNodeIds.length === 0) {
          // No selection, fallback to layout all
          return autoLayout(context.nodes, context.edges, mergedOptions);
        }

        return autoLayoutSelected(
          context.nodes,
          context.edges,
          selectedNodeIds,
          mergedOptions,
        );
      },
    }),

    applyLayoutPreview: assign({
      previousLayout: ({ context }) => context.nodes,
      currentLayout: ({ event }) => event.type === "APPLY_LAYOUT_PREVIEW" ? event.preset : null,
      nodes: ({ context, event }) => event.type === "APPLY_LAYOUT_PREVIEW" ? event.nodes : context.nodes,
      edges: ({ context, event }) => event.type === "APPLY_LAYOUT_PREVIEW" ? event.edges : context.edges,
      lastLayoutAudit: ({ context, event }) =>
        event.type === "APPLY_LAYOUT_PREVIEW" ? event.audit : context.lastLayoutAudit,
      layoutAudits: ({ context, event }) =>
        event.type === "APPLY_LAYOUT_PREVIEW"
          ? [event.audit, ...context.layoutAudits.filter((audit) => audit.appliedAt !== event.audit.appliedAt)]
            .slice(0, LAYOUT_AUDIT_RETENTION_LIMIT)
          : context.layoutAudits,
    }),

    removeLayoutAudit: assign(({ context, event }) => {
      if (event.type !== "DELETE_LAYOUT_AUDIT_SUCCESS") return {};
      const layoutAudits = context.layoutAudits.filter((audit) => audit.appliedAt !== event.appliedAt);
      return {
        layoutAudits,
        lastLayoutAudit: layoutAudits[0] ?? null,
      };
    }),

    clearLayoutAuditHistory: assign({
      layoutAudits: [],
      lastLayoutAudit: null,
    }),

    setSaving: assign({
      isSaving: true,
      saveError: null,
    }),

    setSaveSuccess: assign({
      isSaving: false,
      lastSaved: () => Date.now(),
      saveError: null,
    }),

    setSaveError: assign({
      isSaving: false,
      saveError: ({ event }) => {
        if (event.type !== "SAVE_ERROR") return null;
        return event.error;
      },
    }),

    loadDiagramSuccess: assign({
      currentDiagramId: ({ event }) => {
        if (event.type !== "LOAD_DIAGRAM_SUCCESS") return null;
        return event.diagram.id;
      },
      diagramName: ({ event }) => {
        if (event.type !== "LOAD_DIAGRAM_SUCCESS") return "Untitled";
        return event.diagram.name;
      },
      diagramDescription: ({ event }) => {
        if (event.type !== "LOAD_DIAGRAM_SUCCESS") return null;
        return event.diagram.description ?? null;
      },
      nodes: ({ event }) => {
        if (event.type !== "LOAD_DIAGRAM_SUCCESS") return [];
        return event.diagram.nodes;
      },
      edges: ({ event }) => {
        if (event.type !== "LOAD_DIAGRAM_SUCCESS") return [];
        return event.diagram.edges;
      },
      selectedNodeId: () => null,
      nodeCounter: ({ event }) => {
        if (event.type !== "LOAD_DIAGRAM_SUCCESS") return 0;
        return event.diagram.nodes.length;
      },
      lastSaved: ({ event }) => {
        if (event.type !== "LOAD_DIAGRAM_SUCCESS") return null;
        return event.diagram.updatedAt;
      },
      lastLayoutAudit: ({ event }) => {
        if (event.type !== "LOAD_DIAGRAM_SUCCESS") return null;
        return event.diagram.layoutAudit ?? event.diagram.edges
          .map((edge) => (edge.data as EdgeData | undefined)?.layoutAudit)
          .find((audit): audit is LayoutApplicationAudit => audit !== undefined)
          ?? null;
      },
      layoutAudits: ({ event }) => {
        if (event.type !== "LOAD_DIAGRAM_SUCCESS") return [];
        if (event.diagram.layoutAudits) {
          return event.diagram.layoutAudits.slice(0, LAYOUT_AUDIT_RETENTION_LIMIT);
        }
        return event.diagram.layoutAudit ? [event.diagram.layoutAudit] : [];
      },
    }),

    loadVisualFixture: assign({
      currentDiagramId: null,
      diagramName: ({ event }) => event.type === "LOAD_VISUAL_FIXTURE" ? event.name : "VISUAL::FIXTURE",
      diagramDescription: null,
      nodes: ({ event }) => event.type === "LOAD_VISUAL_FIXTURE" ? event.nodes : [],
      edges: ({ event }) => event.type === "LOAD_VISUAL_FIXTURE" ? event.edges : [],
      selectedNodeId: null,
      nodeCounter: ({ event }) => event.type === "LOAD_VISUAL_FIXTURE" ? event.nodes.length : 0,
      previousLayout: null,
      currentLayout: null,
      lastLayoutAudit: null,
      layoutAudits: [],
      lastSaved: null,
      saveError: null,
    }),

    // === Export Actions ===

    exportPlantUML: assign({
      exportModalOpen: () => true,
      exportFormat: () => "plantuml" as const,
      exportedCode: ({ context, event }) => {
        if (event.type !== "EXPORT_PLANTUML") return null;

        // Generate PlantUML using Effect service
        const options: PlantUMLExport.PlantUMLExportOptions = {
          title: context.diagramName !== "DIAGRAM::UNTITLED"
            ? context.diagramName
            : "C4 Diagram",
          includeDescriptions: true,
          includeTechnology: true,
        };

        if (event.viewport) {
          options.viewport = event.viewport;
        }

        const plantUML = runEffectSync(
          PlantUMLExport.exportC4ToPlantUML(
            context.nodes,
            context.edges,
            options,
          ),
        );
        return plantUML;
      },
    }),

    exportMermaid: assign({
      exportModalOpen: () => true,
      exportFormat: () => "mermaid" as const,
      exportViewport: ({ event }) => event.type === "EXPORT_MERMAID" && event.viewport ? event.viewport : null,
      exportedCode: ({ context, event }) => {
        if (event.type !== "EXPORT_MERMAID") return null;

        return runEffectSync(exportMermaidForDialect(
          context.exportDialect,
          context.nodes,
          context.edges,
          {
            title: mermaidExportTitle(context.diagramName),
            ...(event.viewport === undefined ? {} : { viewport: event.viewport }),
          },
        ));
      },
    }),

    // Switching dialect re-emits from the board rather than transforming the text,
    // because the two dialects carry different information (ADR-014).
    setExportDialect: assign({
      exportDialect: ({ context, event }) =>
        event.type === "SET_EXPORT_DIALECT" ? event.dialect : context.exportDialect,
      exportedCode: ({ context, event }) => {
        if (event.type !== "SET_EXPORT_DIALECT") return context.exportedCode;

        return runEffectSync(exportMermaidForDialect(
          event.dialect,
          context.nodes,
          context.edges,
          {
            title: mermaidExportTitle(context.diagramName),
            ...(context.exportViewport === null ? {} : { viewport: context.exportViewport }),
          },
        ));
      },
    }),

    dismissImportError: assign({ importError: () => null }),

    closeExportModal: assign({
      exportModalOpen: () => false,
      exportFormat: () => null,
      exportedCode: () => null,
    }),

    // === Import Actions ===

    /**
     * Parses once and applies the whole result together.
     *
     * Each of nodes, edges and viewport used to parse the file separately — three
     * times per import — and each substituted an empty result on failure. In
     * "replace" mode that empty result became the board, so importing a file the
     * parser rejects silently destroyed the diagram, with only a console line to
     * say why. Exporting the C4 dialect and importing it back did exactly that.
     */
    importDiagram: assign(({ context, event }) => {
      if (event.type !== "IMPORT_DIAGRAM") return {};

      const parseEffect = event.format === "plantuml"
        ? PlantUMLImport.importPlantUMLC4(event.content)
        : MermaidImport.importMermaid(event.content);

      const outcome = runEffectSync(
        Effect.either(parseEffect),
      );

      if (outcome._tag === "Left") {
        // The board is left exactly as it was; the reason goes to the UI.
        return { importError: outcome.left.message };
      }

      const result = outcome.right;

      if (event.mode === "replace") {
        return {
          nodes: result.nodes,
          edges: result.edges,
          selectedNodeId: null,
          importError: null,
          ...(result.viewport ? { viewport: result.viewport } : {}),
        };
      }

      // Merge: offset imported nodes to the right of everything present, and
      // prefix ids so an imported diagram cannot collide with the current one.
      const offsetX = context.nodes.reduce(
        (max, node) => Math.max(max, node.position.x),
        0,
      ) + 400;

      const offsetNodes = result.nodes.map((node) => ({
        ...node,
        id: `imported_${node.id}`,
        position: { x: node.position.x + offsetX, y: node.position.y },
      }));

      const importedEdges = result.edges.map((edge) => ({
        ...edge,
        id: `imported_${edge.id}`,
        source: `imported_${edge.source}`,
        target: `imported_${edge.target}`,
      }));

      return {
        nodes: [...context.nodes, ...offsetNodes],
        edges: [...context.edges, ...importedEdges],
        selectedNodeId: null,
        importError: null,
      };
    }),

    // === Context Menu Actions ===

    duplicateNode: assign({
      nodes: ({ context, event }) => {
        if (event.type !== "DUPLICATE_NODE") return context.nodes;

        const nodeToDuplicate = context.nodes.find((n) => n.id === event.nodeId);
        if (!nodeToDuplicate) return context.nodes;

        // TODO: Implement duplicateNode Effect function
        // For now, manually duplicate
        const newNodeId = `node-${context.nodeCounter}`;
        const newNode = {
          ...nodeToDuplicate,
          id: newNodeId,
          position: {
            x: nodeToDuplicate.position.x + 50,
            y: nodeToDuplicate.position.y + 50,
          },
        };

        return [...context.nodes, newNode];
      },
      nodeCounter: ({ context, event }) => {
        if (event.type !== "DUPLICATE_NODE") return context.nodeCounter;
        return context.nodeCounter + 1;
      },
    }),

    changeNodeType: assign({
      nodes: ({ context, event }) => {
        if (event.type !== "CHANGE_NODE_TYPE") return context.nodes;

        // TODO: Implement changeNodeType Effect function
        // For now, update the type directly
        return context.nodes.map((node) =>
          node.id === event.nodeId
            ? { ...node, type: event.nodeType }
            : node
        );
      },
    }),

    deleteEdge: assign({
      edges: ({ context, event }) => {
        if (event.type !== "DELETE_EDGE") return context.edges;
        return context.edges.filter((edge) => edge.id !== event.edgeId);
      },
    }),

    changeEdgeStyle: assign({
      edges: ({ context, event }) => {
        if (event.type !== "CHANGE_EDGE_STYLE") return context.edges;

        // TODO: Implement updateEdgeStyle Effect function
        // For now, update the style directly
        return context.edges.map((edge) =>
          edge.id === event.edgeId
            ? {
              ...edge,
              style: {
                ...edge.style,
                strokeDasharray: event.style === "solid" ? "0" : event.style === "dashed" ? "5,5" : "2,2",
              },
            }
            : edge
        );
      },
    }),

    reverseEdgeDirection: assign({
      edges: ({ context, event }) => {
        if (event.type !== "REVERSE_EDGE_DIRECTION") return context.edges;

        // TODO: Implement reverseEdge Effect function
        // For now, reverse manually
        return context.edges.map((edge) => {
          if (edge.id !== event.edgeId) return edge;

          return {
            ...edge,
            source: edge.target,
            target: edge.source,
            sourceHandle: edge.targetHandle ?? null,
            targetHandle: edge.sourceHandle ?? null,
          };
        });
      },
    }),

    addNodeAtPosition: assign({
      nodes: ({ context, event }) => {
        if (event.type !== "ADD_NODE_AT_POSITION") return context.nodes;

        const newNode = runEffectSync(
          NodeOps.createNode({
            type: event.nodeType as NodeOps.NodeType,
            label: event.nodeType as string,
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );

        // Override position with the clicked position
        newNode.position = event.position;

        return [...context.nodes, newNode];
      },
      nodeCounter: ({ context, event }) => {
        if (event.type !== "ADD_NODE_AT_POSITION") return context.nodeCounter;
        return context.nodeCounter + 1;
      },
    }),

    addNodeWithLabel: assign({
      nodes: ({ context, event }) => {
        if (event.type !== "ADD_NODE_WITH_LABEL") return context.nodes;

        const normalizedLabel = event.label.trim();
        const newNode = runEffectSync(
          NodeOps.createNode({
            type: event.nodeType,
            label: normalizedLabel.length > 0 ? normalizedLabel : event.nodeType,
            nodeCounter: context.nodeCounter,
            selectedNodeId: context.selectedNodeId,
            existingNodes: context.nodes,
          }),
        );

        return [...context.nodes, newNode];
      },
      nodeCounter: ({ context, event }) => {
        if (event.type !== "ADD_NODE_WITH_LABEL") return context.nodeCounter;
        return context.nodeCounter + 1;
      },
    }),
  },
}).createMachine({
  id: "canvas",
  initial: "idle",
  context: {
    // Canvas state
    nodes: [],
    edges: [],
    selectedNodeId: null,
    nodeCounter: 0,
    currentDomain: "c4" as DiagramDomain, // Default to C4

    // UI preferences
    animationsEnabled: true, // Animations enabled by default

    // Diagram metadata
    currentDiagramId: null,
    diagramName: "DIAGRAM::UNTITLED",
    diagramDescription: null,
    sessionName: "",

    // Persistence state
    isSaving: false,
    lastSaved: null,
    saveError: null,

    // Layout state
    previousLayout: null,
    currentLayout: null,
    lastLayoutAudit: null,
    layoutAudits: [],

    // Export state
    exportModalOpen: false,
    exportFormat: null,
    exportedCode: null,
    exportDialect: DEFAULT_MERMAID_DIALECT,
    importError: null,
    exportViewport: null,

    // Viewport state
    viewport: null,
  },
  states: {
    idle: {
      on: {
        SET_DOMAIN: {
          actions: "setDomain",
        },
        TOGGLE_ANIMATIONS: {
          actions: "toggleAnimations",
        },
        ADD_NODE: {
          actions: "addNode",
        },
        ADD_PERSON: {
          actions: "addPerson",
        },
        ADD_SYSTEM: {
          actions: "addSystem",
        },
        ADD_EXTERNAL_SYSTEM: {
          actions: "addExternalSystem",
        },
        ADD_CONTAINER: {
          actions: "addContainer",
        },
        ADD_COMPONENT: {
          actions: "addComponent",
        },
        // === DDD Strategic Events ===
        ADD_BOUNDED_CONTEXT: {
          actions: "addBoundedContext",
        },
        ADD_AGGREGATE: {
          actions: "addAggregate",
        },
        ADD_DOMAIN_EVENT: {
          actions: "addDomainEvent",
        },
        // === DDD Tactical Events ===
        ADD_ENTITY: {
          actions: "addEntity",
        },
        ADD_VALUE_OBJECT: {
          actions: "addValueObject",
        },
        ADD_DOMAIN_SERVICE: {
          actions: "addDomainService",
        },
        ADD_REPOSITORY: {
          actions: "addRepository",
        },
        ADD_FACTORY: {
          actions: "addFactory",
        },
        // === DDD Application Events ===
        ADD_COMMAND: {
          actions: "addCommand",
        },
        ADD_QUERY: {
          actions: "addQuery",
        },
        ADD_APPLICATION_SERVICE: {
          actions: "addApplicationService",
        },
        // === DDD Infrastructure Events ===
        ADD_INTEGRATION_EVENT: {
          actions: "addIntegrationEvent",
        },
        ADD_ACL: {
          actions: "addACL",
        },
        ADD_SAGA: {
          actions: "addSaga",
        },
        SELECT_NODE: {
          actions: "selectNode",
        },
        DESELECT_NODE: {
          actions: "deselectNode",
        },
        UPDATE_NODE: {
          actions: "updateNode",
        },
        DELETE_NODE: {
          actions: "deleteNode",
        },
        DUPLICATE_NODE: {
          actions: "duplicateNode",
        },
        CHANGE_NODE_TYPE: {
          actions: "changeNodeType",
        },
        CONNECT_NODES: {
          actions: "connectNodes",
        },
        UPDATE_EDGE_LABEL: {
          actions: "updateEdgeLabel",
        },
        UPDATE_EDGE_METADATA: {
          actions: "updateEdgeMetadata",
        },
        DELETE_EDGE: {
          actions: "deleteEdge",
        },
        CHANGE_EDGE_STYLE: {
          actions: "changeEdgeStyle",
        },
        REVERSE_EDGE_DIRECTION: {
          actions: "reverseEdgeDirection",
        },
        ADD_NODE_AT_POSITION: {
          actions: "addNodeAtPosition",
        },
        ADD_NODE_WITH_LABEL: {
          actions: "addNodeWithLabel",
        },
        NODES_CHANGED: {
          actions: "updateNodesFromReactFlow",
        },
        EDGES_CHANGED: {
          actions: "updateEdgesFromReactFlow",
        },
        UPDATE_DIAGRAM_NAME: {
          actions: "updateDiagramName",
        },
        UPDATE_DIAGRAM_DESCRIPTION: {
          actions: "updateDiagramDescription",
        },
        UPDATE_SESSION_NAME: {
          actions: "updateSessionName",
        },
        AUTO_LAYOUT: {
          actions: "applyLayout",
        },
        AUTO_LAYOUT_SELECTED: {
          actions: "applyLayoutSelected",
        },
        APPLY_LAYOUT_PREVIEW: {
          actions: "applyLayoutPreview",
        },
        DELETE_LAYOUT_AUDIT_SUCCESS: {
          actions: "removeLayoutAudit",
        },
        CLEAR_LAYOUT_AUDITS_SUCCESS: {
          actions: "clearLayoutAuditHistory",
        },
        EXPORT_PLANTUML: {
          actions: "exportPlantUML",
        },
        EXPORT_MERMAID: {
          actions: "exportMermaid",
        },
        SET_EXPORT_DIALECT: {
          actions: "setExportDialect",
        },
        DISMISS_IMPORT_ERROR: {
          actions: "dismissImportError",
        },
        CLOSE_EXPORT_MODAL: {
          actions: "closeExportModal",
        },
        IMPORT_DIAGRAM: {
          actions: "importDiagram",
        },
        // Persistence events
        CREATE_NEW_DIAGRAM: {
          target: "creatingDiagram",
        },
        CREATE_NEW_BOARD: {
          target: "creatingDiagram",
        },
        SWITCH_BOARD: {
          target: "loadingDiagram",
        },
        LOAD_DIAGRAM: {
          target: "loadingDiagram",
        },
        LOAD_DIAGRAM_SUCCESS: {
          actions: "loadDiagramSuccess",
        },
        LOAD_VISUAL_FIXTURE: {
          actions: "loadVisualFixture",
        },
        SAVE_DIAGRAM: {
          target: "saving",
        },
        AUTO_SAVE: {
          target: "saving",
        },
        // Handle late save completion events even after timeout transition.
        SAVE_SUCCESS: {
          actions: "setSaveSuccess",
        },
        SAVE_ERROR: {
          actions: "setSaveError",
        },
      },
    },
    creatingDiagram: {
      // This state is managed by the container component
      // It will invoke the createDiagramActor and transition back to idle
      always: "idle",
    },
    loadingDiagram: {
      // This state is managed by the container component
      // It will invoke the loadDiagramActor and transition back to idle
      always: "idle",
    },
    saving: {
      entry: "setSaving",
      on: {
        SAVE_SUCCESS: {
          target: "idle",
          actions: "setSaveSuccess",
        },
        SAVE_ERROR: {
          target: "idle",
          actions: "setSaveError",
        },
        // Allow other actions while saving
        ADD_NODE: {
          actions: "addNode",
        },
        ADD_PERSON: {
          actions: "addPerson",
        },
        ADD_SYSTEM: {
          actions: "addSystem",
        },
        ADD_EXTERNAL_SYSTEM: {
          actions: "addExternalSystem",
        },
        ADD_CONTAINER: {
          actions: "addContainer",
        },
        ADD_COMPONENT: {
          actions: "addComponent",
        },
        // === DDD Strategic Events ===
        ADD_BOUNDED_CONTEXT: {
          actions: "addBoundedContext",
        },
        ADD_AGGREGATE: {
          actions: "addAggregate",
        },
        ADD_DOMAIN_EVENT: {
          actions: "addDomainEvent",
        },
        // === DDD Tactical Events ===
        ADD_ENTITY: {
          actions: "addEntity",
        },
        ADD_VALUE_OBJECT: {
          actions: "addValueObject",
        },
        ADD_DOMAIN_SERVICE: {
          actions: "addDomainService",
        },
        ADD_REPOSITORY: {
          actions: "addRepository",
        },
        ADD_FACTORY: {
          actions: "addFactory",
        },
        // === DDD Application Events ===
        ADD_COMMAND: {
          actions: "addCommand",
        },
        ADD_QUERY: {
          actions: "addQuery",
        },
        ADD_APPLICATION_SERVICE: {
          actions: "addApplicationService",
        },
        // === DDD Infrastructure Events ===
        ADD_INTEGRATION_EVENT: {
          actions: "addIntegrationEvent",
        },
        ADD_ACL: {
          actions: "addACL",
        },
        ADD_SAGA: {
          actions: "addSaga",
        },
        SELECT_NODE: {
          actions: "selectNode",
        },
        DESELECT_NODE: {
          actions: "deselectNode",
        },
        UPDATE_NODE: {
          actions: "updateNode",
        },
        DELETE_NODE: {
          actions: "deleteNode",
        },
        ADD_NODE_WITH_LABEL: {
          actions: "addNodeWithLabel",
        },
      },
      after: {
        // Timeout after 5 seconds
        5000: {
          target: "idle",
          actions: assign({
            isSaving: false,
            saveError: "Save timeout",
          }),
        },
      },
    },
  },
});

export type CanvasMachine = typeof canvasMachineDefinition;

/** Falls back to a generic title so an unnamed board still labels its export. */
const mermaidExportTitle = (diagramName: string): string =>
  diagramName !== "DIAGRAM::UNTITLED" ? diagramName : "C4 Diagram";

/** Uses the storm palette's own wording where it has some, so a hotspot reads "Hotspot". */
const defaultLabelForNodeType = (nodeType: NodeOps.NodeType): string => {
  const sticky = eventStormingStickyFor(nodeType);
  if (sticky) return sticky.label.charAt(0) + sticky.label.slice(1).toLowerCase();

  return `New ${nodeType.replace(/([A-Z])/g, " $1").trim().toLowerCase()}`;
};

export const canvasMachine: CanvasMachine & AnyStateMachine = canvasMachineDefinition as
  & CanvasMachine
  & AnyStateMachine;
