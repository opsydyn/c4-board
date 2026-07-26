---
title: "ADR-014: Mermaid C4 Export and Rendered Preview"
---

# ADR-014: Mermaid C4 Export and Rendered Preview

**Status**: Proposed
**Date**: 2026-07-26
**Deciders**: Alan P Currie
**Technical Story**: The PlantUML exporter emits real C4 macros. The Mermaid exporter emits a
flowchart with shape approximations, and the export modal shows only code — so a user cannot tell
whether what they are about to paste renders at all.

## Context

### Problem Statement

Two gaps, related but distinct.

**The Mermaid export is not C4.** `export-plantuml-c4.ts` includes `C4_Container.puml` and emits
`Person()`, `System()`, `Container()`, `Rel()`. `export-mermaid.ts` emits `flowchart TB` and encodes
C4 element types as *shapes*:

| C4 type | Mermaid flowchart shape | Meaning to a reader |
| ------- | ----------------------- | ------------------- |
| `person` | `([stadium])` | none — a convention only this app knows |
| `system` | `[rectangle]` | none |
| `externalSystem` | `[[subroutine]]` | none |
| `container` | `[(cylinder)]` | reads as a datastore, which is wrong |
| `component` | `{{hexagon}}` | none |

Technology and description are concatenated into a single label with `<br/><em>` and `<small>`
rather than passed as the arguments Mermaid C4 defines. A reader of the exported file sees an
undifferentiated flowchart; the C4 semantics exist only in this codebase's head.

**The export modal shows code and nothing else.** Mermaid's C4 support is explicitly experimental —
"the syntax and properties can change in future releases" — so text that looks correct may not
render. There is no way to find out without leaving the app.

### The flowchart export is not a mistake, and must not be replaced

It is the **lossless** format. It carries round-trip metadata that `import-mermaid.ts` reads back:

```
    n_abc["Payments"]
    %% @pos(320,180,220,120)
    n_abc -->|"settles"| n_def
    %% @ovl: protocol=https, style=sync, latency=40
    %% ReactFlow Viewport: {"x":0,"y":0,"zoom":1}
```

Mermaid C4 cannot carry that, because **it has no layout algorithm at all** — the documentation
states shape positioning follows statement order. A C4 export is therefore a one-way, share-oriented
artifact. Replacing the flowchart export with it would silently destroy the import path.

So this is not "fix the Mermaid exporter". It is "add a second Mermaid dialect with a different
purpose", and say which is which.

### What Mermaid C4 actually supports

From the specification, and worth writing down because the limitations shape the design:

- Diagram types: `C4Context`, `C4Container`, `C4Component`, `C4Dynamic`, `C4Deployment`.
- Elements: `Person`, `Person_Ext`, `System`, `System_Ext`, `Container(alias, label, techn, descr)`,
  `Component(...)`, `Boundary(alias, label, type)`.
- Relationships: `Rel(from, to, label, techn)`, `BiRel`, and directional `Rel_U/D/L/R`.
- **Not supported**: sprites, tags, links, legends, and the `Lay_*` layout statements.
- Marked experimental.

The element signatures map cleanly onto existing node data — `label`, `technology`, `description`
are already separate fields, and are only merged into one string because flowchart has nowhere else
to put them.

### Preview costs a dependency

`mermaid@11.16.0` is 79.7 MB unpacked across 1171 files, with 21 direct dependencies including
`cytoscape`, `d3` and `dagre-d3-es` — the last of which duplicates the `dagre` already used for
auto-layout. Nothing else in the app renders Mermaid, so this is a new dependency bought solely for
preview.

## Decision

**Add a Mermaid C4 dialect alongside the existing flowchart export, and render a live preview of
whichever dialect is selected, with Mermaid loaded only when a preview is opened.**

### Two dialects, named by purpose

The export modal gains a dialect choice. The wording matters more than the mechanism, because the
difference is not cosmetic:

| Dialect | Emits | Round-trips | Use |
| ------- | ----- | ----------- | --- |
| **Flowchart** (default) | `flowchart TB` + `@pos`/`@ovl` comments | yes, via `import-mermaid.ts` | backup, moving a board between installs |
| **C4** (experimental) | `C4Context`/`C4Container`/`C4Component` | no — layout is not expressible | sharing in Markdown, GitHub, docs |

Default stays flowchart. Anyone exporting today gets what they get now.

### C4 emission maps fields to arguments, not to a label

```
C4Container
  Person(user, "Operator", "Runs the board")
  System_Ext(idp, "Identity Provider", "SSO")
  Container(api, "Payments API", "Rust + Axum", "Settles transactions")
  Rel(user, api, "settles via", "HTTPS")
```

`technology` becomes the `techn` argument and `description` the `descr` argument. The diagram type is
chosen from the elements present — `C4Component` if any component exists, else `C4Container` if any
container does, else `C4Context` — because Mermaid's element vocabulary differs per diagram type.

> **Superseded by [ADR-015](./015-board-metadata-envelope.md).** The reasoning below treated the
> importer as a fixed constraint when it is not, and Mermaid ignores `%%` comments, so nothing
> prevented the C4 dialect carrying the same metadata. Both dialects now emit a shared envelope.

Per-node position metadata is **not** emitted. The C4 dialect is not an import path and
`import-mermaid.ts` is not extended to parse it, so `@pos` comments would be dead weight that reads
like a round-trip guarantee. A header comment states the loss instead, and points at the flowchart
dialect for anyone who wanted a backup.

The diagram type is the first line, ahead of those comments: Mermaid documents comment syntax only
within the diagram body and says nothing about whether comments may precede the declaration.

### Preview is lazy, sandboxed, and honest about failure

- Loaded with a dynamic `import("mermaid")` when preview is first opened, so the dependency costs
  nothing for anyone who only copies code. `OpyCopilotPanel` already establishes this pattern.
- `securityLevel: "strict"`. Node labels are user-supplied and Mermaid renders HTML labels.
- Render failures are **shown**, with Mermaid's own parse error. C4 is experimental and will reject
  input the flowchart path accepts; a preview that silently blanks would be worse than none.
- Bundled locally, never a CDN — the app is a desktop app and must work offline.

### The export surface stays a pure core plus a thin view

`exportC4ToMermaidC4` joins `exportC4ToMermaid` in `src/core/effects/` as a pure function over nodes
and edges. The modal chooses a dialect and renders; it computes nothing.

## Consequences

### Positive

- A Mermaid export a reader can interpret, matching the fidelity PlantUML already has.
- Users see whether their diagram renders before pasting it somewhere.
- The lossless flowchart path is untouched, and its purpose becomes explicit rather than implicit.
- Technology and description stop being an HTML blob inside a label.

### Negative

- A large dependency for one feature. Lazy loading defers the cost but does not remove it from the
  installer — roughly 1–2 MB on the `.dmg`.
- `dagre-d3-es` duplicates `dagre`. Two layout engines ship, used for different things.
- Mermaid C4 is experimental; a Mermaid upgrade can change its syntax and break exports. The
  experimental label in the UI is doing real work.
- A second dialect is a second thing to keep correct as node data evolves.

### Neutral

- Preview renders Mermaid's layout, not the board's. For the C4 dialect they will differ, and that
  is inherent — Mermaid C4 has no layout algorithm to preserve one.

## Alternatives Considered

| Alternative | Why not |
| ----------- | ------- |
| **Replace flowchart with C4** | Destroys the import path. `import-mermaid.ts` parses `@pos`/`@ovl` comments that C4 cannot carry, and Mermaid C4 has no layout at all. |
| **C4 export, no preview** | Cheapest, and leaves the experimental-syntax risk entirely with the user. The point of preview is that C4 output cannot be trusted to render. |
| **Preview by shelling out to a renderer** | No new npm dependency, but needs a binary on the user's machine, breaks offline, and makes the desktop bundle harder rather than easier. |
| **Render preview in a webview pointed at mermaid.live** | Sends the user's architecture to a third party. Not acceptable for a private board. |
| **Extend the flowchart export with C4 comments** | Keeps one format, but readers see a flowchart; the semantics stay invisible to anyone outside this app. |

## Migration Plan

1. **Phase 1 — C4 emitter.** `exportC4ToMermaidC4` in the functional core, with tests for element
   mapping, diagram-type selection, argument escaping, and the absence of a layout claim. No UI.
2. **Phase 2 — Dialect choice.** Export modal gains Flowchart/C4, flowchart default, C4 labelled
   experimental. Machine carries the dialect; the modal stays a view.
3. **Phase 3 — Preview.** Lazy `import("mermaid")`, `securityLevel: "strict"`, Code/Preview toggle,
   errors surfaced. Preview is opt-in per open, so the dependency stays unloaded otherwise.
4. **Phase 4 — Proving it.** Round-trip test that flowchart export → import reproduces positions;
   a test that the C4 dialect is *not* offered to the importer; manual check that a C4 export renders
   on GitHub.

## Testing Strategy

**MANDATORY**: Red-Green-Blue per CLAUDE.md.

1. Each C4 type maps to its element: person → `Person`, externalSystem → `System_Ext`, container →
   `Container`, component → `Component`.
2. `technology` and `description` land in `techn` and `descr`, not in the label.
3. Diagram type is chosen from the elements present, most specific first.
4. Quotes, newlines and commas in labels are escaped so the emitted file parses.
5. A board with no C4 nodes emits a valid empty diagram rather than malformed output.
6. Flowchart export is unchanged — the existing round-trip tests must still pass untouched.
7. The importer rejects C4 input rather than half-parsing it.
8. Preview renders in a component test with an injected fake renderer; the suite never imports the
   real Mermaid bundle.
9. A render failure shows the parse error rather than an empty frame.

The honest limit: whether Mermaid's own C4 renderer draws a *good* diagram is not testable here. That
is checked by hand, once, and recorded.

## Success Metrics

| Metric | Before | After | Status |
| ------ | ------ | ----- | ------ |
| Mermaid export carries C4 semantics | No — shapes only | Yes, as an option | Proposed |
| Technology/description in a Mermaid export | merged into one HTML label | separate macro arguments | Proposed |
| User can see the diagram before pasting | No | Yes | Proposed |
| Flowchart round-trip fidelity | positions preserved | unchanged | Proposed |
| Mermaid bundle loaded when only copying code | n/a | never | Proposed |

## References

- [Mermaid C4 syntax](https://mermaid.js.org/syntax/c4.html) — experimental status and limitations
- [`export-mermaid.ts`](/src/core/effects/export-mermaid.ts) — the flowchart dialect
- [`import-mermaid.ts`](/src/core/effects/import-mermaid.ts) — the round-trip that constrains it
- [`export-plantuml-c4.ts`](/src/core/effects/export-plantuml-c4.ts) — the C4 fidelity to match
- ADR-011 — the parallel-state pattern the modal's dialect/view toggles follow
