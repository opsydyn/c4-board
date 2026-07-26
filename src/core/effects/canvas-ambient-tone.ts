/**
 * The wash the board carries, so which mode you are in is visible without
 * reading the switcher.
 *
 * ADR-016. Storm gets its own, alongside C4's green and DDD's amber, at the same
 * subtlety — the tint is a background cue, not a statement.
 *
 * Pure: extracted from the container so the rule is testable and not a third
 * conditional buried in a three-thousand-line component.
 */

import type { NodeDomain } from "./node-operations";

export type CanvasAmbientTone = NodeDomain | "azure";

export interface CanvasToneInput {
  readonly domain: NodeDomain;
  readonly isAzurePanelOpen: boolean;
}

export const canvasToneFor = ({ domain, isAzurePanelOpen }: CanvasToneInput): CanvasAmbientTone =>
  // Azure wins: while its panel is open that is what you are looking at,
  // whatever the board underneath happens to be.
  isAzurePanelOpen ? "azure" : domain;
