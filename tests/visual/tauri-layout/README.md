# Tauri Layout Captures

These captures exercise the real Tauri WKWebView, native window sizing, ELK worker,
React Flow renderer, and layout preview drawer together.

1. Start the desktop app with the named non-persistent fixture:

```sh
C4_VISUAL_FIXTURE=event-driven bun tauri dev
```

`event-driven` is now the custom Event-Driven representative fixture and replaces
the former ELK baseline. Use `event-driven-bridges` to exercise the deterministic
cross-bus bridge paths:

```sh
C4_VISUAL_FIXTURE=event-driven-bridges bun tauri dev
```

2. The harness opens the fixture's intended layout preview automatically. It leaves the
   diagram ID empty, so save and autosave cannot alter the fixture or user data.
3. Capture both viewport profiles:

```sh
bun run visual:tauri:capture -- --scenario event-driven --viewport desktop
bun run visual:tauri:capture -- --scenario event-driven --viewport narrow
```

Capture the bridge fixture with the same viewport profiles:

```sh
bun run visual:tauri:capture -- --scenario event-driven-bridges --viewport desktop
bun run visual:tauri:capture -- --scenario event-driven-bridges --viewport narrow
```

Disposable captures are written to `.artifacts/tauri-layout/`. Inspect them before
promoting intentional output to a tracked baseline:

```sh
bun run visual:tauri:capture -- --scenario event-driven --viewport desktop --update-baseline
```

The capture command selects the fixture process, uses macOS Accessibility APIs
to set an exact native window size, waits for WKWebView to repaint, and verifies
both the CoreGraphics window and captured PNG dimensions. Grant Accessibility
and Screen Recording access to the terminal host running the command. If more
than one `c4-board` process exists, pass `--pid <c4-board-pid>`. When the window
is already at the required size, pass `--skip-resize` to bypass Accessibility
resizing and avoid another compositor cycle.

The Event-Driven scenarios are `event-driven` and `event-driven-bridges`. Repeat for
`client-server`, `hexagonal-inferred`, and `hexagonal-corrected`. The command refuses
unknown scenarios and validates the native window dimensions before writing a file,
preventing mislabeled baselines.
