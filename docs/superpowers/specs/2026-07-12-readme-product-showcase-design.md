# README Product Showcase Design

**Date:** 2026-07-12

## Goal

Show the current `c4-board` experience near the top of the repository README using two reviewed native Tauri screenshots from the Event-Driven layout slice.

## Composition

Add a `Product Showcase` section after the introductory paragraphs and before `Current Status`.

1. Use `tests/__snapshots__/visual/tauri-layout/event-driven-desktop.png` to show the complete representative Event-Driven workspace.
2. Use `tests/__snapshots__/visual/tauri-layout/event-driven-bridges-detail-desktop.png` to show deterministic multi-bus bridge routing at a readable scale.

Each image receives a short product-oriented caption. The README references the tracked baseline files directly so the showcase cannot drift from reviewed native output and no duplicate image assets are added.

## Constraints

- Modify only `README.md` for the showcase implementation.
- Keep both screenshots at their native aspect ratio.
- Use repository-relative Markdown image paths that render on GitHub.
- Describe user value rather than visual-test mechanics.
- Do not add mobile/narrow screenshots or a larger gallery in this slice.

## Verification

- Confirm both referenced PNG paths exist.
- Run `git diff --check`.
- Inspect the rendered Markdown structure for heading order, alt text, captions, and links.
