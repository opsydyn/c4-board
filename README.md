# Tauri + Astro

This template should help get you started developing with Tauri and Astro.

![App Screenshot](./Screenshot-light.png#gh-light-mode-only)
![App Screenshot](./Screenshot-dark.png#gh-dark-mode-only)

## Getting started

First, make sure you have completed the [prerequisites](https://beta.tauri.app/guides/prerequisites/) to have a working development environment.

Then install the dependencies using the package manager of your choice:

```bash
npm install
# OR
pnpm install
```

Then to get started run:

```bash
npm run tauri dev
# OR
pnpm tauri dev
```

to build your app run

```bash
npm run tauri build
# OR
pnpm tauri build
```

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).

## Release installs

Desktop release install notes live in [docs/release-installation.md](docs/release-installation.md).

If you are testing an unsigned macOS build and Gatekeeper blocks launch with "developer cannot be verified", see the macOS section there for the local quarantine-removal workaround.

Maintainers: Apple signing and notarization setup is documented in [.github/apple-signing.md](.github/apple-signing.md).

## OPY

OPY documentation lives in [docs/opy/README.md](docs/opy/README.md).

That handbook covers:

- floating widget modes, snapping, and orb controls
- commands like `/add`, `/diagram`, and `/review`
- action modes and policy boundaries
- grounded diagnostics, citations, plans, apply, checkpoints, and restore
