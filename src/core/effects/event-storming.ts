/**
 * The Big Picture Event Storming vocabulary.
 *
 * ADR-016. Five stickies, not fourteen: commands, aggregates, read models and
 * policies are Process Modelling vocabulary, and offering them in a Big Picture
 * board invites a half-built process model that satisfies neither format.
 *
 * Three of the five reuse types that already exist. An event storm's event *is* a
 * domain event and its actor *is* a person — reusing them means a storm can
 * become a DDD model later without retyping the board, and keeps the type CHECK
 * from growing synonyms. Only `hotspot` and `opportunity` have no equivalent.
 *
 * The colours are the language. A practitioner reads a wall by colour before
 * reading a word, so each sticky carries its own token and the values follow the
 * Event Storming convention rather than this app's DDD palette.
 *
 * Part of the functional core: no side effects.
 */

import type { NodeType } from "./node-operations";

/** The types this mode introduces. The rest it borrows. */
export const EVENT_STORMING_TYPES = ["hotspot", "opportunity"] as const;

export type EventStormingType = (typeof EVENT_STORMING_TYPES)[number];

export const isEventStormingType = (value: unknown): value is EventStormingType =>
  typeof value === "string" && (EVENT_STORMING_TYPES as ReadonlyArray<string>).includes(value);

export interface EventStormingSticky {
  readonly type: NodeType;
  readonly label: string;
  /** Key into the theme's semantic colours, one per sticky. */
  readonly colourToken: string;
  readonly hint: string;
}

/**
 * Ordered as the palette shows them. Event first: the timeline is made of events
 * and everything else hangs off them.
 */
export const EVENT_STORMING_STICKIES: ReadonlyArray<EventStormingSticky> = [
  {
    type: "domainEvent",
    label: "EVENT",
    colourToken: "esEvent",
    hint: "Something that happened, in the past tense.",
  },
  {
    type: "hotspot",
    label: "HOTSPOT",
    colourToken: "esHotspot",
    hint: "Disagreement, a question, or something nobody knows.",
  },
  {
    type: "person",
    label: "ACTOR",
    colourToken: "esActor",
    hint: "The person or role this part of the story belongs to.",
  },
  {
    type: "externalSystem",
    label: "EXTERNAL SYSTEM",
    colourToken: "esExternalSystem",
    hint: "Something outside the boundary that takes part.",
  },
  {
    type: "opportunity",
    label: "OPPORTUNITY",
    colourToken: "esOpportunity",
    hint: "Where value or an improvement was spotted.",
  },
];

export const eventStormingStickyFor = (type: string): EventStormingSticky | undefined =>
  EVENT_STORMING_STICKIES.find((sticky) => sticky.type === type);

/**
 * A pivotal event divides the timeline into phases. It is a property of an event
 * rather than a sixth sticky — a pivotal hotspot would mean nothing.
 */
export const canBePivotal = (type: string): boolean => type === "domainEvent";
