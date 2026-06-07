import Fuse, { type IFuseOptions } from "fuse.js";
import { Effect } from "effect";
import type { EffectiveRigAgentV1RolloutState } from "./feature-flags";
import type { OpyBoardContextRegistry } from "./opy-board-context";
import type { OpyAgentArtifact } from "./opy-agent.trace";
import {
  listOpyAgentArtifacts,
  listOpyAgentCheckpoints,
  listOpyAgentTasks,
  listOpyChatMessages,
  listOpyDiagramProposals,
  type OpyAgentCheckpoint,
  type OpyAgentTask,
  type OpyChatDomain,
  type OpyChatMessage,
  type OpyPersistedDiagramProposal,
} from "./opy-chat.persistence";
import type { RigC4BoardNode, RigC4BoardSummary } from "./ai-agent.runtime";
import { listDiagrams, type Diagram } from "./database";
import type { RigExecutionPolicySettings, RigMutationPolicySettings } from "./agent-policy";
import type { AiActionMode, AiProvider, RedactionMode } from "./settings.types";

export type RigAgentRetrievalDomain = OpyChatDomain | "azure";
export type RigAgentRetrievalScope =
  | "board"
  | "session"
  | "task"
  | "artifact"
  | "checkpoint"
  | "governance";

export type RigAgentRetrievalSource =
  | "diagram"
  | "node"
  | "edge"
  | "message"
  | "task"
  | "proposal"
  | "artifact"
  | "checkpoint"
  | "governance"
  | "settings"
  | "azure_sync"
  | "explainability";

export interface RigAgentRetrievalHit {
  readonly id: string;
  readonly scope: RigAgentRetrievalScope;
  readonly source: RigAgentRetrievalSource;
  readonly label: string;
  readonly detail: string;
  readonly contentPreview: string;
  readonly createdAt: number | null;
  readonly score: number | null;
}

export interface RigAgentRetrievalBundle {
  readonly domain: RigAgentRetrievalDomain;
  readonly query: string;
  readonly diagramScope: "current-diagram" | "all-diagrams";
  readonly redactionMode: RedactionMode;
  readonly hits: ReadonlyArray<RigAgentRetrievalHit>;
  readonly promptContext: string;
}

export interface RigAgentGovernanceSnapshot {
  readonly actionMode: AiActionMode;
  readonly redactionMode: RedactionMode;
  readonly aiProvider: AiProvider;
  readonly aiModel: string;
  readonly rigExecutionPolicy: RigExecutionPolicySettings;
  readonly rigAgentRollout: EffectiveRigAgentV1RolloutState;
  readonly agentPolicy: RigMutationPolicySettings;
}

export interface RigAgentSettingsRetrievalSnapshot {
  readonly opyVisible: boolean;
  readonly azurePanelVisible: boolean;
  readonly ownershipLensVisible: boolean;
  readonly couplingExplainabilityVisible: boolean;
  readonly opyWidgetPresence: "orb" | "field" | "mission";
  readonly viewportSections: Readonly<{
    control: boolean;
    diagnostics: boolean;
    checkpoints: boolean;
    review: boolean;
    proposal: boolean;
  }>;
  readonly autosaveEnabled: boolean;
  readonly autosaveIntervalMs: number;
  readonly saveOnNavigate: boolean;
  readonly transitionIntensity: "low" | "normal" | "high";
  readonly historyRetentionDays: number;
  readonly telemetryEnabled: boolean;
  readonly mudAlertThreshold: number;
}

export interface RigAgentAzureSyncRetrievalSnapshot {
  readonly authState: "unknown" | "ready" | "required" | "unavailable";
  readonly authStrategy: string | null;
  readonly subscriptionCount: number;
  readonly resourceGroupCount: number;
  readonly tagFilterCount: number;
  readonly advancedQuery: string | null;
  readonly existingAzureNodeCount: number;
  readonly existingAzureEdgeCount: number;
  readonly previewResourceCount: number;
  readonly previewRelationshipCount: number;
  readonly mappedNodeCount: number;
  readonly mappedEdgeCount: number;
  readonly plannedNodeCreates: number;
  readonly plannedNodeUpdates: number;
  readonly plannedNodeArchives: number;
  readonly plannedEdgeCreates: number;
  readonly plannedEdgeUpdates: number;
  readonly plannedEdgeArchives: number;
  readonly warningCount: number;
  readonly warnings: ReadonlyArray<string>;
  readonly lastStatus: "planned" | "applied" | "aborted" | "failed" | "idle";
  readonly lastUpdatedAt: number | null;
  readonly lastAppliedAt: number | null;
  readonly lastError: string | null;
}

export interface RigAgentExplainabilityModuleSnapshot {
  readonly id: string;
  readonly label: string;
  readonly riskTier: "low" | "medium" | "high";
  readonly systemicRisk: number;
  readonly modularity: number;
  readonly balance: number;
  readonly volatilityPropagation: number;
  readonly subdomainType: string;
  readonly integrationType: string;
  readonly strategy: string | null;
}

export interface RigAgentExplainabilityRetrievalSnapshot {
  readonly domain: RigAgentRetrievalDomain;
  readonly explainabilityVisible: boolean;
  readonly mudAlertThreshold: number;
  readonly totalModules: number;
  readonly averageModularity: number;
  readonly averageBalance: number;
  readonly averageRisk: number;
  readonly totalPropagation: number;
  readonly selectedModule: RigAgentExplainabilityModuleSnapshot | null;
  readonly topRiskModule: RigAgentExplainabilityModuleSnapshot | null;
}

export interface LoadRigAgentRetrievalBundleInput {
  readonly domain: RigAgentRetrievalDomain;
  readonly sessionId: string;
  readonly diagramId: string | null;
  readonly boardSummary: RigC4BoardSummary | null;
  readonly boardContext: OpyBoardContextRegistry | null;
  readonly query: string | null;
  readonly governance: RigAgentGovernanceSnapshot;
  readonly settingsSnapshot?: RigAgentSettingsRetrievalSnapshot;
  readonly azureSyncSnapshot?: RigAgentAzureSyncRetrievalSnapshot | null;
  readonly explainabilitySnapshot?: RigAgentExplainabilityRetrievalSnapshot | null;
  readonly redactionMode: RedactionMode;
  readonly scopes?: ReadonlyArray<RigAgentRetrievalScope>;
  readonly diagramScope?: "current-diagram" | "all-diagrams";
  readonly recencyMs?: number | null;
  readonly maxHits?: number;
  readonly now?: number;
}

interface RigAgentRetrievalDocument {
  readonly id: string;
  readonly domain: RigAgentRetrievalDomain;
  readonly scope: RigAgentRetrievalScope;
  readonly source: RigAgentRetrievalSource;
  readonly title: string;
  readonly detail: string;
  readonly content: string;
  readonly createdAt: number | null;
  readonly priority: number;
  readonly tags: ReadonlyArray<string>;
}

const DEFAULT_SCOPES: ReadonlyArray<RigAgentRetrievalScope> = [
  "board",
  "session",
  "task",
  "artifact",
  "checkpoint",
  "governance",
];

const DEFAULT_MAX_HITS = 4;
const DEFAULT_RECENCY_MS = 1000 * 60 * 60 * 24 * 30;
const SECRET_TOKEN_PATTERN = /\bsk-[A-Za-z0-9_-]{8,}\b/g;
const UUID_PATTERN =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const AZURE_RESOURCE_ID_PATTERN = /\/subscriptions\/[^\s]+/gi;
const INTERNAL_ID_PATTERN =
  /\b(session|task|request|checkpoint|artifact|diagram|tool)-[A-Za-z0-9-]+\b/gi;

const retrievalFuseOptions: IFuseOptions<RigAgentRetrievalDocument> = {
  keys: [
    { name: "title", weight: 2.0 },
    { name: "detail", weight: 1.3 },
    { name: "content", weight: 1.1 },
    { name: "tags", weight: 0.8 },
    { name: "scope", weight: 0.5 },
    { name: "source", weight: 0.5 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  includeScore: true,
  minMatchCharLength: 2,
  shouldSort: true,
};

const normalizeText = (value: string | null | undefined, fallback = ""): string => {
  const trimmed = (value ?? "").trim().replace(/\s+/g, " ");
  return trimmed.length > 0 ? trimmed : fallback;
};

const truncateText = (value: string, limit: number): string =>
  value.length <= limit ? value : `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;

const maskIdentifiers = (value: string): string =>
  value
    .replace(SECRET_TOKEN_PATTERN, "[REDACTED SECRET]")
    .replace(UUID_PATTERN, "[REDACTED UUID]")
    .replace(AZURE_RESOURCE_ID_PATTERN, "/subscriptions/[REDACTED]")
    .replace(INTERNAL_ID_PATTERN, "[REDACTED ID]");

const redactMetadata = (
  value: string | null | undefined,
  mode: RedactionMode,
  strictPlaceholder: string,
): string => {
  const normalized = normalizeText(value);
  if (normalized.length === 0) {
    return "";
  }

  if (mode === "strict") {
    return strictPlaceholder;
  }

  return mode === "standard" ? maskIdentifiers(normalized) : normalized;
};

const redactFreeform = (value: string | null | undefined, mode: RedactionMode): string => {
  const normalized = normalizeText(value);
  if (normalized.length === 0) {
    return "";
  }

  if (mode === "strict") {
    return "[REDACTED BY PRIVACY POLICY]";
  }

  return mode === "standard" ? maskIdentifiers(normalized) : normalized;
};

const toHitPreview = (content: string): string => {
  const normalized = normalizeText(content);
  return normalized.length === 0 ? "" : truncateText(normalized, 160);
};

const createEmptyRigAgentRetrievalBundle = (input: {
  readonly domain: RigAgentRetrievalDomain;
  readonly query: string;
  readonly diagramScope: "current-diagram" | "all-diagrams";
  readonly redactionMode: RedactionMode;
}): RigAgentRetrievalBundle => ({
  domain: input.domain,
  query: input.query,
  diagramScope: input.diagramScope,
  redactionMode: input.redactionMode,
  hits: [],
  promptContext: "",
});

const formatRetrievalLine = (hit: RigAgentRetrievalHit): string => {
  const preview = normalizeText(hit.contentPreview);
  const previewSuffix = preview.length > 0 ? ` :: ${preview}` : "";
  return `RETRIEVAL=[${hit.scope.toUpperCase()}/${hit.source.toUpperCase()}] ${hit.label} :: ${hit.detail}${previewSuffix}`;
};

const buildPromptContextFromHits = (
  hits: ReadonlyArray<RigAgentRetrievalHit>,
): string => hits.map(formatRetrievalLine).join("\n");

const toOnOff = (value: boolean): string => value ? "on" : "off";

const summarizeViewportSections = (
  sections: RigAgentSettingsRetrievalSnapshot["viewportSections"],
): string => {
  const expanded = Object.entries(sections)
    .filter(([, isVisible]) => isVisible)
    .map(([section]) => section);

  return expanded.length > 0 ? expanded.join(", ") : "conversation-first";
};

const describeTaskWhat = (task: OpyAgentTask): string => {
  switch (task.request.replay.kind) {
    case "chat":
      return "CHAT";
    case "review":
      return "BOARD REVIEW";
    case "proposal":
      return "DIAGRAM PROPOSAL";
    case "add-node":
      return `ADD ${task.request.replay.nodeType.toUpperCase()}`;
    case "apply-proposal":
      return "APPLY PROPOSAL";
    case "rollback":
      return "ROLLBACK CHECKPOINT";
  }
};

const describeTaskWhy = (task: OpyAgentTask, redactionMode: RedactionMode): string => {
  switch (task.request.replay.kind) {
    case "chat":
      return redactFreeform(task.request.replay.prompt, redactionMode);
    case "review":
      return redactFreeform(task.request.replay.focus ?? "WHOLE BOARD", redactionMode);
    case "proposal":
      return redactFreeform(task.request.replay.description, redactionMode);
    case "add-node":
      return redactionMode === "strict"
        ? `NODE ${task.request.replay.nodeType.toUpperCase()}`
        : redactMetadata(task.request.replay.label, redactionMode, "[REDACTED NODE]");
    case "apply-proposal":
      return `RESPONDED AT ${task.request.replay.proposalRespondedAtMs}`;
    case "rollback":
      return redactMetadata(task.request.replay.checkpointId, redactionMode, "[REDACTED CHECKPOINT]");
  }
};

const toTaskPriority = (task: OpyAgentTask): number => {
  switch (task.status) {
    case "running":
      return 140;
    case "interrupted":
      return 130;
    case "failed":
      return 125;
    case "cancelled":
      return 90;
    case "completed":
      return task.request.requiresConfirmation ? 95 : 80;
  }
};

const toRoleTag = (message: OpyChatMessage): string => {
  switch (message.role) {
    case "assistant":
      return "assistant";
    case "user":
      return "operator";
    case "system":
      return "system";
  }
};

const toBoardNodePriority = (
  node: RigC4BoardNode,
  boardContext: OpyBoardContextRegistry | null,
): number => {
  if (boardContext?.selectedNode?.id === node.id) {
    return 150;
  }

  if (boardContext?.hotspotNode?.id === node.id) {
    return 145;
  }

  return 85;
};

const buildBoardDocuments = (input: {
  readonly domain: RigAgentRetrievalDomain;
  readonly boardSummary: RigC4BoardSummary | null;
  readonly boardContext: OpyBoardContextRegistry | null;
  readonly redactionMode: RedactionMode;
}): ReadonlyArray<RigAgentRetrievalDocument> => {
  if (!input.boardSummary) {
    return [];
  }

  const boardSummary = input.boardSummary;
  const boardDocuments: RigAgentRetrievalDocument[] = [{
    id: `board:${boardSummary.diagramId ?? "unsaved"}`,
    domain: input.domain,
    scope: "board",
    source: "diagram",
    title: normalizeText(boardSummary.diagramName, "UNTITLED BOARD"),
    detail: `${boardSummary.nodeCount} nodes · ${boardSummary.edgeCount} edges`,
    content: [
      normalizeText(boardSummary.diagramName, "UNTITLED BOARD"),
      `${boardSummary.nodeCount} nodes`,
      `${boardSummary.edgeCount} edges`,
      `${boardSummary.nodes.length} indexed node records`,
      `${boardSummary.edges.length} indexed edge records`,
    ].join(" · "),
    createdAt: null,
    priority: 120,
    tags: ["board", "diagram", input.domain],
  }];

  for (const node of boardSummary.nodes) {
    const relationshipCount = boardSummary.edges.filter((edge) =>
      edge.sourceId === node.id || edge.targetId === node.id
    ).length;
    boardDocuments.push({
      id: `node:${node.id}`,
      domain: input.domain,
      scope: "board",
      source: "node",
      title: `${node.nodeType.toUpperCase()} ${node.label}`,
      detail: [
        `${relationshipCount} links`,
        node.teamOwnership
          ? `team ${redactMetadata(node.teamOwnership, input.redactionMode, "[REDACTED TEAM]")}`
          : "",
        node.technology
          ? `tech ${redactMetadata(node.technology, input.redactionMode, "[REDACTED TECH]")}`
          : "",
      ].filter((value) => value.length > 0).join(" · "),
      content: [
        node.label,
        node.nodeType,
        redactMetadata(node.description, input.redactionMode, "[REDACTED DESCRIPTION]"),
        redactMetadata(node.teamOwnership, input.redactionMode, "[REDACTED TEAM]"),
        redactMetadata(node.technology, input.redactionMode, "[REDACTED TECH]"),
      ].filter((value) => value.length > 0).join(" · "),
      createdAt: null,
      priority: toBoardNodePriority(node, input.boardContext),
      tags: [
        "board",
        "node",
        input.domain,
        node.nodeType,
        ...(input.boardContext?.selectedNode?.id === node.id ? ["selected"] : []),
        ...(input.boardContext?.hotspotNode?.id === node.id ? ["hotspot"] : []),
      ],
    });
  }

  for (const edge of boardSummary.edges) {
    boardDocuments.push({
      id: `edge:${edge.id}`,
      domain: input.domain,
      scope: "board",
      source: "edge",
      title: `${edge.sourceLabel} -> ${edge.targetLabel}`,
      detail: normalizeText(edge.label, "(no label)"),
      content: [
        edge.sourceLabel,
        edge.targetLabel,
        normalizeText(edge.label, "(no label)"),
      ].join(" · "),
      createdAt: null,
      priority: 72,
      tags: ["board", "edge", input.domain],
    });
  }

  return boardDocuments;
};

const buildDiagramMetadataDocuments = (input: {
  readonly domain: RigAgentRetrievalDomain;
  readonly diagrams: ReadonlyArray<Diagram>;
  readonly redactionMode: RedactionMode;
}): ReadonlyArray<RigAgentRetrievalDocument> =>
  input.diagrams.map((diagram) => ({
    id: `diagram-meta:${diagram.id}`,
    domain: input.domain,
    scope: "board",
    source: "diagram",
    title: normalizeText(diagram.name, "UNTITLED DIAGRAM"),
    detail: `updated ${diagram.updated_at}`,
    content: [
      normalizeText(diagram.name, "UNTITLED DIAGRAM"),
      redactMetadata(diagram.description, input.redactionMode, "[REDACTED DESCRIPTION]"),
    ].filter((value) => value.length > 0).join(" · "),
    createdAt: diagram.updated_at,
    priority: 65,
    tags: ["diagram", "saved", input.domain],
  }));

const buildMessageDocuments = (input: {
  readonly domain: RigAgentRetrievalDomain;
  readonly messages: ReadonlyArray<OpyChatMessage>;
  readonly redactionMode: RedactionMode;
}): ReadonlyArray<RigAgentRetrievalDocument> =>
  [...input.messages]
    .slice(-8)
    .reverse()
    .map((message) => ({
      id: `message:${message.id}`,
      domain: input.domain,
      scope: "session",
      source: "message",
      title: `${message.role.toUpperCase()} MESSAGE`,
      detail: `${message.role.toUpperCase()} · ${message.createdAt}`,
      content: redactFreeform(message.content, input.redactionMode),
      createdAt: message.createdAt,
      priority: message.role === "user" ? 118 : message.role === "assistant" ? 102 : 96,
      tags: ["session", "transcript", toRoleTag(message), input.domain],
    }));

const buildTaskDocuments = (input: {
  readonly domain: RigAgentRetrievalDomain;
  readonly tasks: ReadonlyArray<OpyAgentTask>;
  readonly redactionMode: RedactionMode;
}): ReadonlyArray<RigAgentRetrievalDocument> =>
  input.tasks.slice(0, 8).map((task) => ({
    id: `task:${task.id}`,
    domain: input.domain,
    scope: "task",
    source: task.request.replay.kind === "proposal" ? "proposal" : "task",
    title: describeTaskWhat(task),
    detail: `${task.status.toUpperCase()} · ${task.stage.toUpperCase()}`,
    content: [
      describeTaskWhy(task, input.redactionMode),
      task.errorSummary ? redactMetadata(task.errorSummary, input.redactionMode, "[REDACTED ERROR]") : "",
    ].filter((value) => value.length > 0).join(" · "),
    createdAt: task.updatedAt,
    priority: toTaskPriority(task),
    tags: [
      "task",
      task.status,
      task.stage,
      task.request.mode,
      task.request.replay.kind,
      input.domain,
    ],
  }));

const buildProposalDocuments = (input: {
  readonly domain: RigAgentRetrievalDomain;
  readonly proposals: ReadonlyArray<OpyPersistedDiagramProposal>;
  readonly redactionMode: RedactionMode;
}): ReadonlyArray<RigAgentRetrievalDocument> =>
  input.proposals.slice(0, 4).map((proposal) => ({
    id: `proposal:${proposal.sessionId}:${proposal.proposal.respondedAtMs}`,
    domain: input.domain,
    scope: "task",
    source: "proposal",
    title: `PROPOSAL ${proposal.decisionStatus.toUpperCase()}`,
    detail: normalizeText(proposal.proposal.summary, "Untitled proposal"),
    content: [
      redactFreeform(proposal.commandDescription, input.redactionMode),
      normalizeText(proposal.proposal.rationale),
      proposal.proposal.warnings.join(" · "),
    ].filter((value) => value.length > 0).join(" · "),
    createdAt: proposal.decidedAt,
    priority: proposal.decisionStatus === "pending" ? 122 : 92,
    tags: ["proposal", proposal.decisionStatus, input.domain],
  }));

const buildArtifactDocuments = (input: {
  readonly domain: RigAgentRetrievalDomain;
  readonly artifacts: ReadonlyArray<OpyAgentArtifact>;
  readonly redactionMode: RedactionMode;
}): ReadonlyArray<RigAgentRetrievalDocument> =>
  [...input.artifacts]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, 8)
    .map((artifact) => ({
      id: `artifact:${artifact.id}`,
      domain: input.domain,
      scope: "artifact",
      source: "artifact",
      title: artifact.kind.replace(/_/g, " ").toUpperCase(),
      detail: redactMetadata(artifact.summary, input.redactionMode, "[REDACTED ARTIFACT]"),
      content: redactMetadata(artifact.summary, input.redactionMode, "[REDACTED ARTIFACT]"),
      createdAt: artifact.createdAt,
      priority: artifact.kind === "mutation_plan" || artifact.kind === "board_review" ? 104 : 88,
      tags: ["artifact", artifact.kind, input.domain],
    }));

const buildCheckpointDocuments = (input: {
  readonly domain: RigAgentRetrievalDomain;
  readonly checkpoints: ReadonlyArray<OpyAgentCheckpoint>;
  readonly redactionMode: RedactionMode;
}): ReadonlyArray<RigAgentRetrievalDocument> =>
  input.checkpoints.slice(0, 3).map((checkpoint) => ({
    id: `checkpoint:${checkpoint.id}`,
    domain: input.domain,
    scope: "checkpoint",
    source: "checkpoint",
    title: `CHECKPOINT ${checkpoint.checkpointType.toUpperCase()}`,
    detail: `${checkpoint.snapshot.nodes.length} nodes · ${checkpoint.snapshot.edges.length} edges`,
    content: [
      redactMetadata(checkpoint.snapshot.name, input.redactionMode, "[REDACTED SNAPSHOT]"),
      checkpoint.snapshot.description
        ? redactMetadata(checkpoint.snapshot.description, input.redactionMode, "[REDACTED DESCRIPTION]")
        : "",
    ].filter((value) => value.length > 0).join(" · "),
    createdAt: checkpoint.createdAt,
    priority: 94,
    tags: ["checkpoint", checkpoint.checkpointType, input.domain],
  }));

const buildGovernanceDocument = (input: {
  readonly domain: RigAgentRetrievalDomain;
  readonly governance: RigAgentGovernanceSnapshot;
}): RigAgentRetrievalDocument => ({
  id: `governance:${input.domain}`,
  domain: input.domain,
  scope: "governance",
  source: "governance",
  title: "RIG GOVERNANCE SNAPSHOT",
  detail: `MODE ${input.governance.actionMode.toUpperCase()} · ROLLOUT ${input.governance.rigAgentRollout.mode.toUpperCase()} · REDACTION ${input.governance.redactionMode.toUpperCase()}`,
  content: [
    `provider ${input.governance.aiProvider}`,
    `model ${input.governance.aiModel}`,
    `kill-switch ${input.governance.rigExecutionPolicy.killSwitchEnabled ? "on" : "off"}`,
    `allowed providers ${input.governance.rigExecutionPolicy.allowedProviders.join(", ")}`,
    `allowed models ${input.governance.rigExecutionPolicy.allowedModels.join(", ")}`,
    `max actions ${input.governance.agentPolicy.maxActionsPerBatch}`,
    `max nodes ${input.governance.agentPolicy.maxNodesCreatedPerRun}`,
    `max edges ${input.governance.agentPolicy.maxEdgesCreatedPerRun}`,
    `settings mutation ${input.governance.agentPolicy.allowSettingsMutation ? "enabled" : "locked"}`,
  ].join(" · "),
  createdAt: null,
  priority: 86,
  tags: ["governance", "policy", "settings", input.domain],
});

const buildSettingsDocument = (input: {
  readonly domain: RigAgentRetrievalDomain;
  readonly settings: RigAgentSettingsRetrievalSnapshot | null | undefined;
}): RigAgentRetrievalDocument | null => {
  if (!input.settings) {
    return null;
  }

  return {
    id: `settings:${input.domain}`,
    domain: input.domain,
    scope: "governance",
    source: "settings",
    title: "OPERATOR SETTINGS SURFACE",
    detail: `PRESENCE ${input.settings.opyWidgetPresence.toUpperCase()} · TELEMETRY ${input.settings.telemetryEnabled ? "ON" : "OFF"} · RETENTION ${input.settings.historyRetentionDays}D`,
    content: [
      `opy visible ${toOnOff(input.settings.opyVisible)}`,
      `azure panel ${toOnOff(input.settings.azurePanelVisible)}`,
      `ownership lens ${toOnOff(input.settings.ownershipLensVisible)}`,
      `explainability ${toOnOff(input.settings.couplingExplainabilityVisible)}`,
      `viewport ${summarizeViewportSections(input.settings.viewportSections)}`,
      `autosave ${input.settings.autosaveEnabled ? `${input.settings.autosaveIntervalMs}ms` : "disabled"}`,
      `save on navigate ${toOnOff(input.settings.saveOnNavigate)}`,
      `transition ${input.settings.transitionIntensity}`,
      `mud threshold ${input.settings.mudAlertThreshold.toFixed(1)}`,
    ].join(" · "),
    createdAt: null,
    priority: 83,
    tags: ["settings", "operator", "surface", "opy", input.domain],
  };
};

const buildAzureSyncDocument = (input: {
  readonly domain: RigAgentRetrievalDomain;
  readonly snapshot: RigAgentAzureSyncRetrievalSnapshot | null | undefined;
  readonly redactionMode: RedactionMode;
}): RigAgentRetrievalDocument | null => {
  if (!input.snapshot) {
    return null;
  }

  const advancedQuery = redactFreeform(input.snapshot.advancedQuery, input.redactionMode);
  return {
    id: `azure-sync:${input.domain}`,
    domain: input.domain,
    scope: "governance",
    source: "azure_sync",
    title: "AZURE SYNC RUN SUMMARY",
    detail: `AUTH ${input.snapshot.authState.toUpperCase()} · ${input.snapshot.subscriptionCount} subs · ${input.snapshot.previewResourceCount} resources · ${input.snapshot.previewRelationshipCount} links`,
    content: [
      `strategy ${normalizeText(input.snapshot.authStrategy, "unconfigured")}`,
      `resource groups ${input.snapshot.resourceGroupCount}`,
      `tag filters ${input.snapshot.tagFilterCount}`,
      advancedQuery.length > 0 ? `query ${advancedQuery}` : "",
      `existing azure ${input.snapshot.existingAzureNodeCount} nodes / ${input.snapshot.existingAzureEdgeCount} edges`,
      `mapped graph ${input.snapshot.mappedNodeCount} nodes / ${input.snapshot.mappedEdgeCount} edges`,
      `planned nodes +${input.snapshot.plannedNodeCreates} ~${input.snapshot.plannedNodeUpdates} -${input.snapshot.plannedNodeArchives}`,
      `planned edges +${input.snapshot.plannedEdgeCreates} ~${input.snapshot.plannedEdgeUpdates} -${input.snapshot.plannedEdgeArchives}`,
      `warnings ${input.snapshot.warningCount}`,
      input.snapshot.lastError
        ? `last error ${redactFreeform(input.snapshot.lastError, input.redactionMode)}`
        : "",
    ].filter((value) => value.length > 0).join(" · "),
    createdAt: input.snapshot.lastUpdatedAt,
    priority: input.snapshot.lastError ? 110 : 84,
    tags: ["azure", "sync", "graph", input.snapshot.lastStatus, input.domain],
  };
};

const buildExplainabilityDocument = (input: {
  readonly snapshot: RigAgentExplainabilityRetrievalSnapshot | null | undefined;
}): RigAgentRetrievalDocument | null => {
  if (!input.snapshot || input.snapshot.totalModules === 0) {
    return null;
  }

  const focusedModule = input.snapshot.selectedModule ?? input.snapshot.topRiskModule;
  const focusDetail = focusedModule
    ? `${focusedModule.label} ${focusedModule.systemicRisk.toFixed(1)} ${focusedModule.riskTier.toUpperCase()}`
    : "NO FOCUS";

  return {
    id: `explainability:${input.snapshot.domain}`,
    domain: input.snapshot.domain,
    scope: "board",
    source: "explainability",
    title: "COMPLEXITY FIELD EXPLAINABILITY",
    detail: `${input.snapshot.totalModules} modules · avg risk ${input.snapshot.averageRisk.toFixed(1)} · focus ${focusDetail}`,
    content: [
      `panel ${toOnOff(input.snapshot.explainabilityVisible)}`,
      `threshold ${input.snapshot.mudAlertThreshold.toFixed(1)}`,
      `average modularity ${input.snapshot.averageModularity.toFixed(1)}`,
      `average balance ${input.snapshot.averageBalance.toFixed(1)}`,
      `propagation ${input.snapshot.totalPropagation.toFixed(1)}`,
      focusedModule
        ? `focus module ${focusedModule.label} · ${focusedModule.subdomainType} · ${focusedModule.integrationType} · strategy ${focusedModule.strategy ?? "legacy"}`
        : "",
      input.snapshot.topRiskModule
        ? `top risk ${input.snapshot.topRiskModule.label} ${input.snapshot.topRiskModule.systemicRisk.toFixed(1)} ${input.snapshot.topRiskModule.riskTier.toUpperCase()}`
        : "",
    ].filter((value) => value.length > 0).join(" · "),
    createdAt: null,
    priority: focusedModule?.riskTier === "high" ? 111 : 87,
    tags: ["explainability", "complexity", "coupling", input.snapshot.domain],
  };
};

const applyScopeAndRecencyFilters = (input: {
  readonly documents: ReadonlyArray<RigAgentRetrievalDocument>;
  readonly scopes: ReadonlySet<RigAgentRetrievalScope>;
  readonly recencyMs: number | null;
  readonly now: number;
}): ReadonlyArray<RigAgentRetrievalDocument> =>
  input.documents.filter((document) => {
    if (!input.scopes.has(document.scope)) {
      return false;
    }

    if (input.recencyMs === null || document.createdAt === null) {
      return true;
    }

    return document.createdAt >= input.now - input.recencyMs;
  });

const buildFallbackDocuments = (
  documents: ReadonlyArray<RigAgentRetrievalDocument>,
): ReadonlyArray<RigAgentRetrievalDocument> =>
  [...documents].sort((left, right) =>
    right.priority - left.priority
    || (right.createdAt ?? 0) - (left.createdAt ?? 0)
    || left.title.localeCompare(right.title)
  );

const searchDocuments = (input: {
  readonly documents: ReadonlyArray<RigAgentRetrievalDocument>;
  readonly query: string;
  readonly maxHits: number;
}): ReadonlyArray<RigAgentRetrievalHit> => {
  const selected = new Map<string, RigAgentRetrievalHit>();
  const normalizedQuery = normalizeText(input.query).toLowerCase();
  if (normalizedQuery.length >= 2) {
    const fuse = new Fuse(input.documents, retrievalFuseOptions);
    const searchResults = fuse.search(normalizedQuery, { limit: input.maxHits });
    for (const result of searchResults) {
      const item = result.item;
      selected.set(item.id, {
        id: item.id,
        scope: item.scope,
        source: item.source,
        label: item.title,
        detail: item.detail,
        contentPreview: toHitPreview(item.content),
        createdAt: item.createdAt,
        score: result.score ?? null,
      });
    }
  }

  for (const document of buildFallbackDocuments(input.documents)) {
    if (selected.size >= input.maxHits) {
      break;
    }

    if (!selected.has(document.id)) {
      selected.set(document.id, {
        id: document.id,
        scope: document.scope,
        source: document.source,
        label: document.title,
        detail: document.detail,
        contentPreview: toHitPreview(document.content),
        createdAt: document.createdAt,
        score: null,
      });
    }
  }

  return [...selected.values()].slice(0, input.maxHits);
};

export const loadRigAgentRetrievalBundle = (
  input: LoadRigAgentRetrievalBundleInput,
) => {
  const normalizedQuery = normalizeText(input.query);
  const diagramScope = input.diagramScope ?? "current-diagram";
  const now = input.now ?? Date.now();
  const maxHits = input.maxHits ?? DEFAULT_MAX_HITS;
  const recencyMs = input.recencyMs === undefined ? DEFAULT_RECENCY_MS : input.recencyMs;
  const scopes = new Set(input.scopes ?? DEFAULT_SCOPES);

  return Effect.gen(function*() {
    const snapshot = yield* Effect.all({
      messages: listOpyChatMessages(input.sessionId),
      tasks: listOpyAgentTasks(input.sessionId),
      proposals: listOpyDiagramProposals(input.sessionId),
      checkpoints: listOpyAgentCheckpoints(input.sessionId),
      diagrams: diagramScope === "all-diagrams" ? listDiagrams() : Effect.succeed([] as Diagram[]),
    });

    const artifactLists = yield* Effect.forEach(
      snapshot.tasks.slice(0, 4),
      (task) => listOpyAgentArtifacts(task.id),
    );
    const artifacts = artifactLists.flatMap((items) => items);

    const documents = applyScopeAndRecencyFilters({
      documents: [
        ...buildBoardDocuments({
          domain: input.domain,
          boardSummary: input.boardSummary,
          boardContext: input.boardContext,
          redactionMode: input.redactionMode,
        }),
        ...buildDiagramMetadataDocuments({
          domain: input.domain,
          diagrams: snapshot.diagrams.filter((diagram) =>
            diagramScope === "all-diagrams" ? true : diagram.id === input.diagramId
          ),
          redactionMode: input.redactionMode,
        }),
        ...buildMessageDocuments({
          domain: input.domain,
          messages: snapshot.messages,
          redactionMode: input.redactionMode,
        }),
        ...buildTaskDocuments({
          domain: input.domain,
          tasks: snapshot.tasks,
          redactionMode: input.redactionMode,
        }),
        ...buildProposalDocuments({
          domain: input.domain,
          proposals: snapshot.proposals,
          redactionMode: input.redactionMode,
        }),
        ...buildArtifactDocuments({
          domain: input.domain,
          artifacts,
          redactionMode: input.redactionMode,
        }),
        ...buildCheckpointDocuments({
          domain: input.domain,
          checkpoints: snapshot.checkpoints,
          redactionMode: input.redactionMode,
        }),
        buildGovernanceDocument({
          domain: input.domain,
          governance: input.governance,
        }),
        buildSettingsDocument({
          domain: input.domain,
          settings: input.settingsSnapshot,
        }),
        buildAzureSyncDocument({
          domain: input.domain,
          snapshot: input.azureSyncSnapshot,
          redactionMode: input.redactionMode,
        }),
        buildExplainabilityDocument({
          snapshot: input.explainabilitySnapshot,
        }),
      ].filter((document): document is RigAgentRetrievalDocument => document !== null),
      scopes,
      recencyMs,
      now,
    });

    const hits = searchDocuments({
      documents,
      query: normalizedQuery,
      maxHits,
    });

    return {
      domain: input.domain,
      query: normalizedQuery,
      diagramScope,
      redactionMode: input.redactionMode,
      hits,
      promptContext: buildPromptContextFromHits(hits),
    } satisfies RigAgentRetrievalBundle;
  }).pipe(
    Effect.catchAll(() =>
      Effect.succeed(
        createEmptyRigAgentRetrievalBundle({
          domain: input.domain,
          query: normalizedQuery,
          diagramScope,
          redactionMode: input.redactionMode,
        }),
      )
    ),
  );
};
