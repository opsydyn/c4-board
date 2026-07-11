# Tauri Layout Captures

These captures exercise the real Tauri WKWebView, native window sizing, ELK worker,
React Flow renderer, and layout preview drawer together.

1. Start the desktop app with `bun tauri dev`.
2. Load the named fixture state and open **ELK Layered** in the layout preview drawer.
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
