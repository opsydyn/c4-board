/**
 * The record of a board, carried alongside the drawing of it.
 *
 * ADR-015. Exports used to describe a board only through what a dialect could
 * draw: type inferred from a Mermaid shape, technology and description scraped
 * out of an HTML label, position attached to whichever node was parsed last.
 * Four of sixteen `NodeData` fields survived a share, and a DDD board exported as
 * nothing, because both exporters drop any node without a `c4Type`.
 *
 * This is the record instead. Every dialect emits it, every node appears in it
 * including ones nothing can draw, and the importer prefers it over inferring
 * anything. Renderers ignore `%%` comments, so the diagram is unaffected.
 *
 * Part of the functional core: no side effects.
 */

import type { Edge, Node, Viewport } from "@xyflow/react";

/** Bumped when the record shape changes in a way older readers cannot handle. */
export const BOARD_METADATA_VERSION = 1;

/** Mermaid comments with `%%`, PlantUML with `'`. The record itself is identical. */
export type CommentMarker = "%%" | "'";

const tag = `@c4b:v${BOARD_METADATA_VERSION}`;

/** Matches either marker and any version, so an unreadable one can be reported. */
const ANY_VERSION = /^(?:%%|')\s*@c4b:v(\d+)\s+(.*)$/;

interface NodeRecord {
  readonly kind: "node";
  readonly id: string;
  readonly type?: string;
  readonly x: number;
  readonly y: number;
  readonly w?: number;
  readonly h?: number;
  readonly data: Record<string, unknown>;
}

interface EdgeRecord {
  readonly kind: "edge";
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly label?: string;
  readonly data?: Record<string, unknown>;
}

interface BoardRecord {
  readonly kind: "board";
  readonly viewport?: Viewport;
}

type Record_ = NodeRecord | EdgeRecord | BoardRecord;

export interface DecodedBoardMetadata {
  readonly nodes: Node[];
  readonly edges: Edge[];
  readonly viewport?: Viewport;
}

const line = (record: Record_, marker: CommentMarker): string =>
  `${marker} ${tag} ${JSON.stringify(record)}`;

/**
 * One line per element, as comments. Every node is recorded regardless of whether
 * a dialect can draw it — the envelope is what makes a share faithful, and the
 * drawing is only a view.
 */
export const encodeBoardMetadata = (
  nodes: Node[],
  edges: Edge[],
  viewport?: Viewport,
  marker: CommentMarker = "%%",
): string[] => {
  if (nodes.length === 0 && edges.length === 0) return [];

  const lines = nodes.map((node) =>
    line({
      kind: "node",
      id: node.id,
      ...(node.type === undefined ? {} : { type: node.type }),
      x: node.position.x,
      y: node.position.y,
      ...(node.width === undefined ? {} : { w: node.width }),
      ...(node.height === undefined ? {} : { h: node.height }),
      data: (node.data ?? {}) as Record<string, unknown>,
    }, marker)
  );

  for (const edge of edges) {
    lines.push(line({
      kind: "edge",
      id: edge.id,
      source: edge.source,
      target: edge.target,
      ...(edge.label === undefined ? {} : { label: String(edge.label) }),
      ...(edge.data === undefined ? {} : { data: edge.data as Record<string, unknown> }),
    }, marker));
  }

  if (viewport !== undefined) lines.push(line({ kind: "board", viewport }, marker));

  return lines;
};

export class BoardMetadataError extends Error {}

/**
 * Reads the envelope out of a file's lines, or returns null when there is none so
 * the caller can fall back to the legacy `@pos`/`@ovl` readers.
 *
 * A record it cannot understand is an error rather than a skip: applying part of a
 * board is worse than refusing the file.
 */
export const decodeBoardMetadata = (
  lines: ReadonlyArray<string>,
): DecodedBoardMetadata | null => {
  const records: Record_[] = [];

  for (const raw of lines) {
    const match = raw.trim().match(ANY_VERSION);
    if (match === null) continue;

    const [, version, payload] = match;
    if (Number(version) !== BOARD_METADATA_VERSION) {
      throw new BoardMetadataError(
        `This board was exported with metadata v${version}, which this version cannot read. Update c4-board to import it.`,
      );
    }

    try {
      records.push(JSON.parse(payload ?? "") as Record_);
    } catch {
      throw new BoardMetadataError(`Board metadata is malformed and cannot be read: ${raw.trim()}`);
    }
  }

  if (records.length === 0) return null;

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let viewport: Viewport | undefined;

  for (const record of records) {
    if (record.kind === "node") {
      nodes.push({
        id: record.id,
        ...(record.type === undefined ? {} : { type: record.type }),
        position: { x: record.x, y: record.y },
        ...(record.w === undefined ? {} : { width: record.w }),
        ...(record.h === undefined ? {} : { height: record.h }),
        data: record.data,
      });
      continue;
    }

    if (record.kind === "edge") {
      edges.push({
        id: record.id,
        source: record.source,
        target: record.target,
        ...(record.label === undefined ? {} : { label: record.label }),
        ...(record.data === undefined ? {} : { data: record.data }),
      });
      continue;
    }

    if (record.viewport !== undefined) viewport = record.viewport;
  }

  return { nodes, edges, ...(viewport === undefined ? {} : { viewport }) };
};
