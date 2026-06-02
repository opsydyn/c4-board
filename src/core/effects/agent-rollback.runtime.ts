import type { OpyAgentCheckpoint } from "./opy-chat.persistence";

export const selectLatestOpyAgentCheckpoint = (
  checkpoints: ReadonlyArray<OpyAgentCheckpoint>,
): OpyAgentCheckpoint | null => checkpoints[0] ?? null;

export const formatOpyRollbackSummary = (checkpoint: OpyAgentCheckpoint): string =>
  `ROLLBACK READY:: CHECKPOINT ${checkpoint.id.slice(0, 8)} · ${
    checkpoint.snapshot.nodes.length
  } NODE(S) · ${checkpoint.snapshot.edges.length} EDGE(S)`;
