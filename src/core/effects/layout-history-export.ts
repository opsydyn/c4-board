import { LAYOUT_AUDIT_RETENTION_LIMIT, type LayoutApplicationAudit } from "./layout.types";

export interface LayoutHistoryArtifact {
  schema: "opsydyn.layout-history";
  version: 1;
  exportedAt: number;
  diagram: {
    id: string;
    name: string;
  };
  retention: {
    limit: number;
    exportedCount: number;
  };
  audits: LayoutApplicationAudit[];
}

export interface BuildLayoutHistoryArtifactInput {
  diagramId: string;
  diagramName: string;
  exportedAt: number;
  audits: ReadonlyArray<LayoutApplicationAudit>;
}

export const buildLayoutHistoryArtifact = (
  input: BuildLayoutHistoryArtifactInput,
): LayoutHistoryArtifact => ({
  schema: "opsydyn.layout-history",
  version: 1,
  exportedAt: input.exportedAt,
  diagram: {
    id: input.diagramId,
    name: input.diagramName,
  },
  retention: {
    limit: LAYOUT_AUDIT_RETENTION_LIMIT,
    exportedCount: input.audits.length,
  },
  audits: [...input.audits].sort((left, right) => right.appliedAt - left.appliedAt),
});

export const serializeLayoutHistoryArtifact = (artifact: LayoutHistoryArtifact): string =>
  `${JSON.stringify(artifact, null, 2)}\n`;

export const createLayoutHistoryFilename = (diagramName: string): string => {
  const slug = diagramName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${slug || "diagram"}-layout-history.json`;
};
