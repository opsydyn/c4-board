/**
 * Which mode the board opens in.
 *
 * `currentDomain` was a hardcoded `"c4"` in the canvas machine's initial context
 * and was never written anywhere, so leaving the board for Postee and returning
 * always landed in C4 — even from a storm. The panel toggles beside it have
 * persisted in settings all along; the mode was the one piece of board state
 * that did not.
 *
 * Reading it back is deliberately strict. A settings row can hold a domain
 * written by a newer build, or a value edited by hand, and neither should leave
 * the board with a mode it cannot render. Anything unrecognised is C4, which is
 * where the board opened before this existed.
 */

import { isDiagramDomain, type NodeDomain } from "./node-operations";

/** Where the board opens when nothing usable has been stored. */
export const DEFAULT_BOARD_DOMAIN: NodeDomain = "c4";

/**
 * No trimming, no case folding. These values are written by this app, so a
 * near-miss means a write bug — and quietly accepting `" C4 "` would hide it.
 */
export const resolveBoardDomain = (persisted: unknown): NodeDomain =>
  isDiagramDomain(persisted) ? persisted : DEFAULT_BOARD_DOMAIN;
