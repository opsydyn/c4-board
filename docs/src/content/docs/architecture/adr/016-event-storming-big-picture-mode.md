---
title: "ADR-016: Event Storming Mode (Big Picture)"
---

# ADR-016: Event Storming Mode (Big Picture)

**Status**: Proposed
**Date**: 2026-07-26
**Deciders**: Alan P Currie
**Technical Story**: DDD mode can approximate an event storm and gets it wrong in the ways that
matter — no timeline, no hotspots, and colours that say something else.

## Context

### Problem Statement

Event Storming is the workshop that usually precedes the modelling this app already supports. Today
it can only be faked in DDD mode, and the fake breaks down in three places that are not cosmetic.

### What DDD mode already gives you

Fourteen palette items, and the overlap with Event Storming is real:

| Event Storming sticky | Today |
| --------------------- | ----- |
| Domain Event | `ADD::DOMAIN EVENT` |
| Command | `ADD::COMMAND` |
| Aggregate | `ADD::AGGREGATE` |
| Policy / Reaction | `SAGA` — adjacent, not the same |
| Read Model | `QUERY` — adjacent, not the same |
| Actor | only C4 `person`, in the other mode |
| External System | only C4 `externalSystem`, in the other mode |
| **Hotspot** | absent |
| Opportunity / pivotal event | absent |

So roughly half the vocabulary exists, two core stickies are in the wrong mode, and the one that
carries most of a workshop's value is missing.

### Three gaps that are not vocabulary

1. **An event storm is a timeline; this app lays out graphs.** Every preset — `contextMap`,
   `domainModel`, `subdomain` — is dagre ranking by dependency. Run it on a storm and you get a
   dependency tree, which is precisely the shape Event Storming exists to avoid drawing.

2. **The colours are the language.** Practitioners read a wall by colour before reading a word. The
   semantic tokens here follow DDD conventions: `aggregate` is emerald where a storm expects pale
   yellow. Events happen to be amber, near enough to orange; nothing else lines up.

3. **Hotspots are the point.** The rotated red sticky marking disagreement or ignorance is usually
   the most valuable thing to come out of a session. There is nowhere to put one.

Swimlanes and phase boundaries are also inexpressible, which rules out the format outright.

### Big Picture only

Big Picture and Process Modelling want different things. Process Modelling enforces a
Command → Aggregate → Event → Policy chain and needs structure this ADR deliberately does not build.
Big Picture is looser and mostly narrative: events along a timeline, with the people, systems and
unknowns around them. It is also the session people run first.

Scoping to Big Picture keeps the vocabulary small — **five stickies, not fourteen** — because
commands, aggregates and policies belong to the later format. Process Modelling is a roadmap item.

### What it costs to add a domain

`domain` is a discriminator threaded through the machine, palette, layouts, colours, persistence and
the OPY chat, and it is CHECK-constrained in SQLite in two places:

```sql
-- 011_add_ddd_support.sql
domain TEXT NOT NULL DEFAULT 'c4' CHECK(domain IN ('c4', 'ddd'))
-- 019_create_opy_chat_tables.sql
domain TEXT NOT NULL CHECK (domain IN ('c4', 'ddd'))
```

Both need a migration before any UI exists. The theme contract is also a contract: a new semantic
colour must be filled in by all three themes — `dark`, `dark-nord`, `light` — or the build fails,
which is the behaviour we want.

## Decision

**Add `eventStorming` as a third diagram domain, scoped to the Big Picture format: a timeline of
events, the actors and systems around them, and the hotspots that come out of arguing about it.**

### Five stickies

| Sticky | Colour | Purpose |
| ------ | ------ | ------- |
| **Domain Event** | orange | The backbone. Past tense, on the timeline. |
| **Hotspot** | red | Disagreement, ignorance, risk. Rotated, so it reads as an interrupt. |
| **Actor** | small yellow | The person or role a part of the story belongs to. |
| **External System** | pink | Something outside the boundary that participates. |
| **Opportunity** | green | Where value or improvement was spotted. |

Commands, aggregates, read models and policies are **not** in this mode. They are the Process
Modelling vocabulary, and offering them here invites a half-built process model that satisfies
neither format.

A domain event can be marked **pivotal**, which draws a phase boundary through the timeline. That is
a flag on an event rather than a sixth sticky, because that is what it is.

### Timeline layout, not dependency layout

A new preset ranks strictly left to right by position on the timeline rather than by edges, with
swimlanes as rows. Edges are annotation in this format, not structure, so the layout must not derive
order from them — which is exactly what the existing presets do.

Ordering comes from each event's own place on the timeline, so dragging a sticky earlier means it is
earlier. That is how the workshop works, and any layout that re-derives order from connections will
fight the user.

### Colours are contract tokens, not decoration

Five new semantic tokens, filled in by all three themes. The values follow the Event Storming
convention rather than this app's DDD palette, because the convention is what a practitioner reads.
Where the conventional colour clashes with the terminal aesthetic, the *hue* is preserved and the
saturation adjusted — an orange event must stay recognisably orange.

### Exports carry the data, not the drawing

The metadata envelope (ADR-015) carries arbitrary `NodeData`, so event storms round-trip through
export and import immediately, with no work.

The Mermaid and PlantUML exports will draw **nothing**, because both filter to C4 types — the same
position DDD boards are in today. This ADR does not change that. Teaching the flowchart dialect to
draw non-C4 nodes is a separate decision affecting DDD equally, and bundling it here would make this
change about exports rather than about Event Storming.

## Consequences

### Positive

- The workshop that precedes C4 and DDD modelling happens in the same tool as its output.
- Hotspots become first-class, so the most valuable output of a session is captured rather than lost.
- A timeline layout is reusable by Process Modelling later.
- `domain` stops being a two-value assumption, which it never really was.

### Negative

- A third domain to keep working across the machine, persistence, OPY, exports and layout. Every
  future feature now asks "and what does this mean for event storms?"
- Two CHECK constraints to migrate, on tables holding real user data.
- Three themes to extend for every new token.
- Event storms export as an empty drawing until the export question is answered separately.

### Neutral

- Process Modelling stays on the roadmap. This ADR makes it cheaper by establishing the domain, the
  timeline layout and the colour discipline, and harder to ignore, because a Big Picture board will
  invite people to add commands.

## Alternatives Considered

| Alternative | Why not |
| ----------- | ------- |
| **Extend DDD mode with hotspots and actors** | No migration and less code, but it leaves fourteen DDD stickies in a workshop that wants five, keeps the dependency layout, and keeps DDD colours. It makes the fake more convincing rather than fixing it. |
| **Both formats at once** | Process Modelling needs chain enforcement and a stricter layout. Building both means doing neither properly, and Big Picture is the session people run first. |
| **A separate app or page** | Loses the reason to do this at all: an event storm's output should become the C4 and DDD models beside it. |
| **A free-form sticky canvas with no semantics** | Cheap, and gives up the thing this app is for. Untyped stickies cannot become a model later. |

## Migration Plan

1. **Phase 1 — Domain.** Migration widening both CHECK constraints, `DiagramDomain` gains
   `eventStorming`, and the machine, persistence and OPY chat accept it. No new node types; proves
   the discriminator widens safely before anything depends on it.
2. **Phase 2 — Vocabulary.** The five node types, their semantic tokens across three themes, and the
   pivotal flag on domain events.
3. **Phase 3 — Timeline.** The layout preset, ranked by timeline position rather than edges, with
   swimlanes.
4. **Phase 4 — Palette and mode.** `MODE::STORM` beside C4 and DDD, palette wired, hotspot styling.
5. **Phase 5 — Proving it.** A real storm built in the app, exported, re-imported, and compared.
   Honest documentation of what a storm does and does not export.

## Testing Strategy

**MANDATORY**: Red-Green-Blue per CLAUDE.md.

1. The widened CHECK accepts the new domain and still rejects nonsense, tested against a copy of the
   real database rather than a fresh one.
2. A board in one domain never returns nodes from another.
3. Timeline layout orders by timeline position, and **ignores edges** — the property that separates
   it from every existing preset, so it is asserted directly.
4. A pivotal event produces a phase boundary; a non-pivotal one does not.
5. Every new semantic token is defined by all three themes. Asserted against the contract, so adding
   a token and forgetting a theme fails.
6. Hotspots survive an export and re-import through the envelope, in every format.
7. Switching modes does not silently drop nodes of another domain.
8. The Big Picture palette does not offer command, aggregate, read model or policy.

## Success Metrics

| Metric | Before | After | Status |
| ------ | ------ | ----- | ------ |
| Event Storming stickies available | 3 of 5, two in the wrong mode | 5 of 5 | Proposed |
| Hotspots | none | first-class | Proposed |
| Timeline layout | none | one preset | Proposed |
| Domains supported | 2 | 3 | Proposed |

## References

- Alberto Brandolini, *Introducing EventStorming* — the Big Picture format and its colour convention
- [`node-operations.ts`](/src/core/effects/node-operations.ts) — `NodeDomain`, `DDDType`
- [`layout.ts`](/src/core/effects/layout.ts) — the dependency presets a timeline cannot reuse
- [`011_add_ddd_support.sql`](/src-tauri/migrations/011_add_ddd_support.sql) — the first CHECK
- [`019_create_opy_chat_tables.sql`](/src-tauri/migrations/019_create_opy_chat_tables.sql) — the second
- [ADR-015](./015-board-metadata-envelope.md) — why storms round-trip for free

## Follow-Up ADRs

- ADR-NNN: Event Storming Process Modelling — the Command → Aggregate → Event → Policy chain, its
  enforcement, and whether Big Picture boards can be promoted into one.
- ADR-NNN: Drawing non-C4 nodes in the Mermaid and PlantUML exports, which affects DDD and Event
  Storming equally.
