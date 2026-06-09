/**
 * Shared Diagram Types
 *
 * Common types used across C4 and DDD domains.
 * Enables diagrams to contain elements from multiple modeling approaches.
 */

import * as S from "effect/Schema";
import { C4Element } from "./c4";
import { DDDElement } from "./ddd";

/**
 * Diagram Domain
 * Specifies which modeling approach(es) the diagram uses
 */
export const DiagramDomain = S.Union(
  S.Literal("c4"), // Pure C4 architecture modeling
  S.Literal("ddd"), // Pure Domain-Driven Design modeling
  S.Literal("mixed"), // Hybrid diagrams with both C4 and DDD elements
);

export type DiagramDomain = S.Schema.Type<typeof DiagramDomain>;

/**
 * Multi-Domain Diagram
 * Can contain elements from both C4 and DDD modeling approaches
 */
export const Diagram = S.Struct({
  id: S.String,
  name: S.String.pipe(S.minLength(1)),
  description: S.optional(S.String),
  domain: DiagramDomain,
  elements: S.Array(S.Union(C4Element, DDDElement)), // Can contain both!
  createdAt: S.String, // Consider Schema.DateFromString for stricter validation
  updatedAt: S.String,
});

export type Diagram = S.Schema.Type<typeof Diagram>;

/**
 * Diagram Level (C4-specific)
 * For backwards compatibility with existing C4 diagrams
 */
export const DiagramLevel = S.Union(
  S.Literal("context"),
  S.Literal("container"),
  S.Literal("component"),
  S.Literal("code"),
);

export type DiagramLevel = S.Schema.Type<typeof DiagramLevel>;
