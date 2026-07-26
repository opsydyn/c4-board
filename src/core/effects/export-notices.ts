/**
 * What an exported file says about its own completeness.
 *
 * ADR-016 Phase 5. Both Mermaid dialects and the PlantUML export draw only C4
 * elements. On an event storm that is not "nothing" — an actor is a `person` and
 * an external system is an `externalSystem`, so the supporting cast is drawn
 * while the event backbone, hotspots and opportunities are not.
 *
 * A diagram of the cast with no story is worse than an empty one: an empty file
 * says "nothing here", this one looks complete. Until a dialect can draw these,
 * the honest minimum is that the file says so.
 */

/** Mermaid comments with `%%`, PlantUML with `'`. */
export type NoticeMarker = "%%" | "'";

export interface UndrawnNoticeInput {
  readonly total: number;
  readonly drawn: number;
  readonly marker: NoticeMarker;
}

/**
 * One comment line when the drawing is partial, and nothing at all when it is
 * complete — a notice on every export would train people to ignore it.
 */
export const undrawnNotice = ({ total, drawn, marker }: UndrawnNoticeInput): string[] => {
  const undrawn = total - drawn;
  if (undrawn <= 0) return [];

  return [
    `${marker} ${undrawn} of ${total} nodes are not drawn in this format — it draws C4 elements only.`,
    `${marker} Every node is recorded in the metadata below, so re-importing restores the whole board.`,
  ];
};
