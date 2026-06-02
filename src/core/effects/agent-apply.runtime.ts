import type { Edge, Node } from "@xyflow/react";
import type { OpyAgentCheckpoint, OpyAgentCheckpointSnapshot } from "./opy-chat.persistence";

const createCheckpointId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `opy-checkpoint-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

interface BuildOpyCheckpointSnapshotInput {
  readonly diagramId: string;
  readonly diagramName: string;
  readonly diagramDescription: string | null;
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly savedAt: number | null;
}

interface BuildOpyCheckpointRecordInput {
  readonly sessionId: string;
  readonly diagramId: string;
  readonly proposalRespondedAtMs: number;
  readonly snapshot: OpyAgentCheckpointSnapshot;
  readonly createdAt?: number;
}

export const buildOpyCheckpointSnapshot = (
  input: BuildOpyCheckpointSnapshotInput,
): OpyAgentCheckpointSnapshot => ({
  id: input.diagramId,
  name: input.diagramName,
  ...(input.diagramDescription ? { description: input.diagramDescription } : {}),
  nodes: [...input.nodes],
  edges: [...input.edges],
  savedAt: input.savedAt,
});

export const buildOpyCheckpointRecord = (
  input: BuildOpyCheckpointRecordInput,
): OpyAgentCheckpoint => {
  const createdAt = input.createdAt ?? Date.now();

  return {
    id: createCheckpointId(),
    sessionId: input.sessionId,
    diagramId: input.diagramId,
    proposalRespondedAtMs: input.proposalRespondedAtMs,
    checkpointType: "pre-apply",
    snapshot: input.snapshot,
    createdAt,
  };
};

export const checkpointSnapshotToLoadedDiagram = (
  snapshot: OpyAgentCheckpointSnapshot,
): {
  readonly id: string;
  readonly name: string;
  readonly nodes: Node[];
  readonly edges: Edge[];
  readonly updatedAt: number;
  readonly description?: string;
} => ({
  id: snapshot.id,
  name: snapshot.name,
  nodes: [...snapshot.nodes],
  edges: [...snapshot.edges],
  updatedAt: snapshot.savedAt ?? Date.now(),
  ...(snapshot.description ? { description: snapshot.description } : {}),
});
