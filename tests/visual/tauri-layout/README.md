# Tauri Layout Captures

These captures exercise the real Tauri WKWebView, native window sizing, ELK worker,
React Flow renderer, and layout preview drawer together.

1. Start the desktop app with the named non-persistent fixture:

```sh
C4_VISUAL_FIXTURE=event-driven bun tauri dev
```

2. Open **ELK Layered** in the layout preview drawer. The harness leaves the
   diagram ID empty, so save and autosave cannot alter the fixture or user data.
3. Capture both viewport profiles:

```sh
bun run visual:tauri:capture -- --scenario event-driven --viewport desktop
bun run visual:tauri:capture -- --scenario event-driven --viewport narrow
```

Disposable captures are written to `.artifacts/tauri-layout/`. Inspect them before
promoting intentional output to a tracked baseline:

```sh
bun run visual:tauri:capture -- --scenario event-driven --viewport desktop --update-baseline
```

Repeat for `client-server`. The command refuses unknown scenarios and validates
the native window dimensions before writing a file, preventing mislabeled baselines.
