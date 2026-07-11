import { pipe, Schema } from "effect";
import { LAYOUT_AUDIT_RETENTION_LIMIT, type LayoutApplicationAudit } from "./layout.types";

const NonNegativeIntegerSchema = pipe(
  Schema.Number,
  Schema.filter((value) => Number.isInteger(value) && value >= 0, {
    message: () => "Expected a non-negative integer",
  }),
);

const FiniteNumberSchema = pipe(
  Schema.Number,
  Schema.filter(Number.isFinite, { message: () => "Expected a finite number" }),
);

export const LayoutApplicationAuditSchema = Schema.Struct({
  version: Schema.Literal(1),
  appliedAt: NonNegativeIntegerSchema,
  preset: Schema.String,
  strategyId: Schema.String,
  engine: Schema.Literal("dagre", "elk", "custom"),
  selectedVariant: Schema.Literal("single", "original", "recommended"),
  comparisonMetrics: Schema.Array(Schema.Struct({
    key: Schema.Literal("overlaps", "canvasArea", "routedCrossings", "routedLength"),
    original: FiniteNumberSchema,
    recommended: FiniteNumberSchema,
    favored: Schema.Literal("original", "recommended", "tie"),
  })),
});

export const LayoutHistoryArtifactSchema = pipe(
  Schema.Struct({
    schema: Schema.Literal("opsydyn.layout-history"),
    version: Schema.Literal(1),
    exportedAt: NonNegativeIntegerSchema,
    diagram: Schema.Struct({
      id: Schema.String,
      name: Schema.String,
    }),
    retention: Schema.Struct({
      limit: Schema.Literal(LAYOUT_AUDIT_RETENTION_LIMIT),
      exportedCount: NonNegativeIntegerSchema,
    }),
    audits: Schema.Array(LayoutApplicationAuditSchema),
  }),
  Schema.filter(
    (artifact) =>
      artifact.retention.exportedCount === artifact.audits.length
      && artifact.audits.length <= LAYOUT_AUDIT_RETENTION_LIMIT,
    { message: () => "Exported audit count must match retained audit history" },
  ),
);

export type LayoutHistoryArtifact = Schema.Schema.Type<typeof LayoutHistoryArtifactSchema>;

export const validateLayoutHistoryArtifact = Schema.decodeUnknownSync(LayoutHistoryArtifactSchema);

export interface BuildLayoutHistoryArtifactInput {
  diagramId: string;
  diagramName: string;
  exportedAt: number;
  audits: ReadonlyArray<LayoutApplicationAudit>;
}

export const buildLayoutHistoryArtifact = (
  input: BuildLayoutHistoryArtifactInput,
): LayoutHistoryArtifact =>
  validateLayoutHistoryArtifact({
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
  `${JSON.stringify(validateLayoutHistoryArtifact(artifact), null, 2)}\n`;

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
