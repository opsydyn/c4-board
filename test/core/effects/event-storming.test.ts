import {
  canBePivotal,
  EVENT_STORMING_STICKIES,
  eventStormingStickyFor,
  isEventStormingType,
} from "@/core/effects/event-storming";
import { describe, expect, it } from "vitest";

/**
 * ADR-016 Phase 2. The Big Picture vocabulary.
 *
 * Five stickies, not fourteen. Commands, aggregates, read models and policies
 * are Process Modelling vocabulary; offering them here invites a half-built
 * process model that satisfies neither format, so their absence is asserted
 * rather than left to discipline.
 *
 * Three of the five reuse types that already exist — an event storm's event *is*
 * a domain event, and its actor *is* a person — so a storm can become a DDD model
 * later without retyping anything. Only the two with no equivalent are new.
 */

describe("EVENT_STORMING_STICKIES", () => {
  it("is the five Big Picture stickies, event first", () => {
    // Event first because it is the backbone: the timeline is made of events and
    // everything else hangs off them.
    expect(EVENT_STORMING_STICKIES.map((sticky) => sticky.label)).toEqual([
      "EVENT",
      "HOTSPOT",
      "ACTOR",
      "EXTERNAL SYSTEM",
      "OPPORTUNITY",
    ]);
  });

  it("does not offer Process Modelling vocabulary", () => {
    const types = EVENT_STORMING_STICKIES.map((sticky) => sticky.type);

    for (const excluded of ["command", "aggregate", "query", "saga", "readModel", "policy"]) {
      expect(types, `${excluded} belongs to Process Modelling`).not.toContain(excluded);
    }
  });

  it("reuses the types a storm shares with the models it becomes", () => {
    const byLabel = (label: string) => EVENT_STORMING_STICKIES.find((sticky) => sticky.label === label)?.type;

    expect(byLabel("EVENT")).toBe("domainEvent");
    expect(byLabel("ACTOR")).toBe("person");
    expect(byLabel("EXTERNAL SYSTEM")).toBe("externalSystem");
  });

  it("adds only the two stickies with no existing equivalent", () => {
    expect(
      EVENT_STORMING_STICKIES.filter((sticky) => isEventStormingType(sticky.type))
        .map((sticky) => sticky.type),
    ).toEqual(["hotspot", "opportunity"]);
  });

  it("gives every sticky its own colour token", () => {
    const tokens = EVENT_STORMING_STICKIES.map((sticky) => sticky.colourToken);

    // The colours are the language: a practitioner reads a wall by colour before
    // reading a word, so no two stickies may share one.
    expect(new Set(tokens).size).toBe(EVENT_STORMING_STICKIES.length);
  });
});

describe("isEventStormingType", () => {
  it("recognises the types this mode introduces", () => {
    expect(isEventStormingType("hotspot")).toBe(true);
    expect(isEventStormingType("opportunity")).toBe(true);
  });

  it("does not claim the types it borrows", () => {
    // These belong to C4 and DDD; a storm uses them, it does not own them.
    for (const shared of ["domainEvent", "person", "externalSystem"]) {
      expect(isEventStormingType(shared), `${shared} is not an ES-only type`).toBe(false);
    }
  });

  it("rejects anything else", () => {
    for (const value of ["aggregate", "", null, undefined, 7]) {
      expect(isEventStormingType(value)).toBe(false);
    }
  });
});

describe("canBePivotal", () => {
  /**
   * A pivotal event divides the timeline into phases. It is a property of an
   * event, not a sixth sticky — marking a hotspot "pivotal" would mean nothing.
   */
  it("applies to events", () => {
    expect(canBePivotal("domainEvent")).toBe(true);
  });

  it("does not apply to anything else on the board", () => {
    for (const type of ["hotspot", "person", "externalSystem", "opportunity"]) {
      expect(canBePivotal(type), `${type} cannot be pivotal`).toBe(false);
    }
  });
});

describe("eventStormingStickyFor", () => {
  it("finds the sticky a node type belongs to", () => {
    expect(eventStormingStickyFor("hotspot")?.label).toBe("HOTSPOT");
    expect(eventStormingStickyFor("domainEvent")?.label).toBe("EVENT");
  });

  it("returns nothing for a type this mode does not draw", () => {
    expect(eventStormingStickyFor("aggregate")).toBeUndefined();
  });
});

describe("colour tokens", () => {
  /**
   * ADR-016. The contract makes a missing token a build error, but only for the
   * theme that forgot it — and a token defined nowhere is invisible. This asserts
   * every sticky's token exists in every theme, so adding a sixth sticky and
   * forgetting a theme fails here rather than rendering it transparent.
   */
  it("is defined by every theme for every sticky", async () => {
    const { readFileSync } = await import("node:fs");

    const themes = ["dark", "dark-nord", "light"].map((name) => ({
      name,
      source: readFileSync(`src/styles/themes/${name}.css.ts`, "utf8"),
    }));

    for (const sticky of EVENT_STORMING_STICKIES) {
      for (const theme of themes) {
        expect(theme.source, `${theme.name} has no ${sticky.colourToken}`)
          .toMatch(new RegExp(`${sticky.colourToken}:\\s*"#[0-9a-fA-F]{3,8}"`));
      }
    }
  });

  it("is declared in the contract, which is what makes a theme fail without it", async () => {
    const { readFileSync } = await import("node:fs");
    const contract = readFileSync("src/styles/theme.contract.css.ts", "utf8");

    for (const sticky of EVENT_STORMING_STICKIES) {
      expect(contract, `contract has no ${sticky.colourToken}`)
        .toMatch(new RegExp(`${sticky.colourToken}:\\s*null`));
    }
  });
});
