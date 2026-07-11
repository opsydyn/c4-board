# Event-Driven Lane Geometry Design

**Date:** 2026-07-11  
**Status:** Approved for planning

## Objective

Replace the Event-Driven preset's generic Dagre placement with deterministic,
semantically meaningful geometry. The board must show publishers, event buses,
processors, and subscribers as bus-centred horizontal flow bands, while making
cross-bus processors visible as explicit bridges.

This slice delivers geometry, diagnostics, strategy routing, and automated
coverage. Native desktop and narrow-HUD visual baselines remain the following
slice so they capture stable geometry.

## Strategy Architecture

Add a synchronous custom `event-driven` strategy alongside the existing
Hexagonal, Hub-Spoke, and System Context strategies. Route the existing
`eventDriven` preset to `strategyId: "event-driven"` and register the strategy in
the synchronous strategy registry.

The strategy classifies top-level nodes with `inferEventDrivenRoles`, positions
those nodes from the exact returned assignments, and returns the assignments as
`LayoutResult.semanticRoles`. Child nodes retain their existing parent-relative
positions. Edges whose endpoints are not both top-level remain excluded from
placement and are reported through the shared hierarchy diagnostics.

## Visual Grammar

### Bus-Centred Bands

Each classified event bus owns one horizontal band. Bands stack vertically in
stable bus-ID order and share role columns:

`Publishers -> Event Bus -> Processors -> Subscribers`

Publishers align in the left column of the bus they publish to. Subscribers
align in the right column of the bus they consume from. Processors that consume
and continue event flow within one bus band occupy that band's processor column.

Multiple nodes in one role column stack vertically around the band's centre.
Measured node dimensions and configured node/rank spacing determine lane width,
band height, and node separation. Geometry is normalized into positive canvas
coordinates and uses the existing optional grid snap behavior.

### Cross-Bus Processor Bridges

A processor with exactly one source bus and one distinct destination bus sits
between those two bands as an explicit vertical bridge. Its horizontal position
uses the processor column; its vertical centre lies midway between the source
and destination band boundaries. Existing graph edges express the transition;
the strategy does not create synthetic nodes or edges.

A processor with multiple possible source buses or multiple possible destination
buses does not receive unstable bridge geometry. It stays in its deterministic
primary source band and receives an ambiguity diagnostic.

## Bus Affinity

Bus affinity comes only from direct graph relationships to classified event-bus
nodes:

- publisher affinity: outgoing edge to a bus;
- subscriber affinity: incoming edge from a bus;
- processor source affinity: incoming edge from a bus;
- processor destination affinity: outgoing edge to a bus.

When a node has multiple candidate buses, select its primary bus by highest
direct edge count and then lexicographically by bus ID. This stable rule applies
to publishers, subscribers, and non-bridge processors. Nodes with no bus affinity
remain role-classified but move to the review lane and receive an orphan-role
diagnostic.

## Supporting Lanes

Infrastructure and external dependencies occupy a shared support lane below all
bus bands. Unclassified nodes and role-classified nodes without usable bus
affinity occupy a separate review lane below support. Both lanes use measured
dimensions and stable ID ordering.

If no event bus is identified, all role-classified flow nodes use the review
lane. The strategy remains non-destructive and returns a warning instead of
falling back silently to Dagre.

## Analysis and Diagnostics

The strategy's analysis score reflects the ratio of confident Event-Driven role
assignments and whether at least one event bus is present.

Layout diagnostics include:

- a role-count summary for publishers, buses, processors, subscribers,
  infrastructure, external dependencies, and unclassified nodes;
- a warning when no event bus is identified;
- information when multiple buses produce multiple bands;
- warnings for publishers, processors, or subscribers without direct bus
  affinity;
- warnings for processors with ambiguous source or destination buses;
- semantic mismatch and low-confidence diagnostics from classification;
- shared hierarchy diagnostics for excluded child and hierarchy-crossing edges.

Diagnostics use stable node-ID ordering and do not mutate role assignments.

## Data Flow

1. Separate top-level nodes from child nodes and filter top-level edges.
2. Classify top-level nodes with `inferEventDrivenRoles`.
3. Build bus affinity from direct relationships to classified buses.
4. Create stable band, support-lane, review-lane, and bridge anchors.
5. Position top-level nodes by role, affinity, and bridge eligibility.
6. Normalize and optionally snap positions.
7. Combine positioned top-level nodes with unchanged child nodes.
8. Evaluate layout quality and return diagnostics plus semantic assignments.

## Testing

Use test-driven development with representative single-bus and multi-bus graphs.
Coverage must prove:

- publisher, bus, processor, and subscriber column ordering;
- vertically separated bus-centred bands;
- explicit placement of a one-source, one-destination cross-bus processor between
  its bands;
- ambiguous multi-bus processors remain in a primary band and receive a warning;
- infrastructure and external dependencies occupy the support lane;
- orphan and unclassified nodes occupy the review lane with diagnostics;
- no-bus graphs remain non-destructive and diagnostic;
- measured dimensions prevent node overlap;
- grid snapping and positive-canvas normalization;
- child-relative positions remain unchanged;
- reversing node and edge inputs returns identical positions and diagnostics;
- the preset and strategy registry resolve `eventDriven` to the custom strategy;
- the result returns the assignments that drove geometry.

## Non-Goals

- custom edge routing or synthetic bridge edges;
- native visual-baseline capture;
- Client-Server semantic geometry;
- changes to role inference or persistence;
- OPY/Rig pattern classification;
- user-authored custom layout definitions.
