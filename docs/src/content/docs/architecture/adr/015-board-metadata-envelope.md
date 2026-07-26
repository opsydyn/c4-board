---
title: "ADR-015: Board Metadata Envelope for Diagram Exports"
---

# ADR-015: Board Metadata Envelope for Diagram Exports

**Status**: Proposed
**Date**: 2026-07-26
**Deciders**: Alan P Currie
**Technical Story**: A shared export should land on another user's board the way it left this one.
It does not: the round trip carries four of sixteen node fields, and a DDD board exports as nothing.

**Supersedes**: the "no position metadata in the C4 dialect" decision in
[ADR-014](./014-mermaid-c4-export-and-preview.md).

## Context

### Problem Statement

ADR-014 called the flowchart dialect "lossless" and built the C4 dialect around not being able to
match it. Both claims were wrong in the same way — the metadata is a **c4-board** concern, not a
Mermaid one, and Mermaid ignores `%%` comments entirely. Nothing ever stopped the C4 dialect
carrying the same data. The reasoning was "the importer does not parse C4", which treated a thing
this codebase controls as a fixed constraint.

### What actually survives an export and re-import

`NodeData` has sixteen fields. Four make the trip:

| Preserved | Lost |
| --------- | ---- |
| `label`, `description`, `technology`, `c4Type` | `dddType`, `subdomainType`, `integrationType`, `couplingProfile`, `couplingScoreMode`, `couplingOverrides`, `iconId`, `layoutRole`, `aggregateRoot`, `invariants`, `ubiquitousLanguage`, `createdAt` |
| node position and size, via `%% @pos` | |
| edge metadata, via `%% @ovl` | edge `layoutRoute`, `layoutAudit` |

So the balanced coupling model, ownership and layout roles, and the entire DDD vocabulary are
dropped when a board is shared.

### A DDD board exports to nothing

`getNodeC4Type` returns `null` for a node carrying `dddType` and no `c4Type`, and both Mermaid
exporters filter those out before writing a line. A DDD board therefore exports as a diagram with no
elements — data loss at export time, before any question of import arises.

### The existing metadata is also fragile to read

`%% @pos` is positional: the parser attaches it to `parsedNodes[parsedNodes.length - 1]`, so it
depends on the comment following its element and on nothing else having been emitted in between.
Type comes from inferring a C4 kind from a Mermaid *shape*, and technology and description are
recovered by regex-scraping `<em>` and `<small>` out of an HTML label. Each of those is a guess
about a rendering rather than a record of the data.

## Decision

**Emit one metadata envelope, carried identically by every dialect, and read it in preference to
inferring anything from the drawing.**

```
%% @c4b:v1 {"kind":"node","id":"api","c4Type":"container","x":760,"y":2140,"w":220,"h":120,
            "data":{"label":"Payments API","technology":"Rust","couplingProfile":…}}
%% @c4b:v1 {"kind":"edge","id":"e1","source":"user","target":"api","label":"settles via","data":{…}}
%% @c4b:v1 {"kind":"board","viewport":{"x":0,"y":0,"zoom":1}}
```

- **Every dialect emits it.** Flowchart and C4 both. A user sharing either gets the same board back,
  which is the point the previous design missed.
- **Every node is recorded**, including ones no dialect can draw. A DDD board renders empty and
  still round-trips, because the envelope is the record and the drawing is a view of it.
- **Complete payloads.** The whole of `NodeData` and `EdgeData` travels, so adding a field to the
  model does not silently stop it being shared.
- **A block at the end, not interleaved.** Each record names its own id, so parsing no longer
  depends on a comment sitting immediately after the element it describes.
- **Versioned.** `@c4b:v1` so a later format change is detectable rather than a mystery.
- **Inert.** Mermaid and PlantUML both ignore their comment syntax, so nothing about the rendered
  diagram changes.

### The importer prefers the envelope, and keeps the old readers

When `@c4b` records are present they are authoritative. When they are not — every file exported
before this — the existing `@pos`, `@ovl` and `ReactFlow Viewport` parsing runs exactly as now.
Files already in people's hands keep working.

### What this does not do

The drawing still shows only what a dialect can express. A DDD board's Mermaid output remains an
empty diagram; the envelope means the *data* survives, not that Mermaid grows DDD notation.
Rendering non-C4 nodes is a separate question.

## Consequences

### Positive

- A shared board arrives intact, including coupling, ownership, icons and DDD vocabulary.
- Both dialects round-trip, so choosing C4 for readability no longer costs the layout.
- Import stops inferring type from shape and scraping fields out of HTML labels.
- Adding a field to `NodeData` no longer silently drops it from every export.

### Negative

- Exports get longer, by roughly one line per element. In a share-oriented dialect that is noise,
  albeit noise no renderer displays.
- A second format to keep working: the legacy readers stay for files already exported.
- The envelope encodes internal shapes, so a rename in `NodeData` is now a format concern. The
  version tag is what makes that manageable.

### Neutral

- PlantUML can carry the same envelope with `'` comments. Worth doing for consistency, but the
  Mermaid dialects are what prompted this.

## Alternatives Considered

| Alternative | Why not |
| ----------- | ------- |
| **Add `@pos` to C4 only** | Fixes the reported case and none of the others. The coupling model and DDD nodes stay lost, and it means touching this again. |
| **Extend the interleaved `@pos`/`@ovl` scheme** | Keeps the positional fragility, and needs a new comment kind per field added. |
| **A sidecar `.json` file** | Complete and clean, but a shared diagram becomes two files, and one of them will go missing. |
| **Encode metadata in element labels** | Visible in the rendered diagram, which defeats the purpose. |

## Migration Plan

1. **Phase 1 — Envelope.** `board-metadata.ts` in the functional core: encode and decode, versioned,
   with tests over the full `NodeData`/`EdgeData` surface. No wiring.
2. **Phase 2 — Emit.** Both Mermaid dialects append the block. Legacy comments stay for now, so a
   file exported today still reads on an older build.
3. **Phase 3 — Read.** Importer prefers the envelope and falls back to the legacy readers, including
   for the C4 dialect, which becomes importable.
4. **Phase 4 — Proving it.** A board carrying every field, exported and re-imported through both
   dialects, compared field by field. Legacy fixtures still import.

## Testing Strategy

**MANDATORY**: Red-Green-Blue per CLAUDE.md.

1. Every `NodeData` field survives an encode/decode cycle, asserted against the type rather than a
   hand-listed subset, so a new field fails the test until it is carried.
2. Every `EdgeData.metadata` field survives.
3. Nodes no dialect can draw — DDD — are recorded and restored.
4. Both dialects produce an envelope, and the same board through either yields the same records.
5. A file with no envelope still imports via `@pos`/`@ovl`.
6. An envelope with an unknown version is refused with a message naming the version, not ignored.
7. A malformed record is refused rather than partially applied.
8. The rendered statements are unchanged by the envelope's presence.

## Success Metrics

| Metric | Before | After | Status |
| ------ | ------ | ----- | ------ |
| `NodeData` fields surviving a share | 4 of 16 | 16 of 16 | Proposed |
| DDD nodes surviving a share | 0 | all | Proposed |
| Dialects that round-trip | flowchart only | both | Proposed |
| Import inferring type from shape | yes | only for legacy files | Proposed |

## References

- [ADR-014](./014-mermaid-c4-export-and-preview.md) — the dialects, and the decision this supersedes
- [`export-mermaid.ts`](/src/core/effects/export-mermaid.ts) — `@pos` and `@ovl` as they stand
- [`import-mermaid.ts`](/src/core/effects/import-mermaid.ts) — shape inference and label scraping
- [`node-operations.ts`](/src/core/effects/node-operations.ts) — the sixteen fields
