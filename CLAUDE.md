# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Tauri v2 + Astro** desktop application template that combines:
- **Frontend**: Astro with SSG (Static Site Generation) using React
- **Backend**: Tauri v2 (Rust-based) for native desktop capabilities
- **Styling**: Vanilla Extract for type-safe CSS-in-JS

## Development Commands

### Running the Application
```bash
# Development mode (starts both Astro dev server and Tauri)
npm run tauri dev
# or
pnpm tauri dev

# The dev server runs on http://localhost:4321/
# Tauri automatically loads this URL via tauri.conf.json
```

### Building
```bash
# Build for production (runs type checking, Astro build, then Tauri build)
npm run tauri build
# or
pnpm tauri build

# Frontend-only build with type checking
npm run build

# Type checking only
npm run astro check
```

### Linting
```bash
# Run ESLint
npx eslint .

# ESLint is configured in eslint.config.ts with:
# - TypeScript support
# - React plugin
# - Vanilla Extract specific linting for *.css.ts files
```

### Astro Commands
```bash
# Preview production build
npm run preview

# Run Astro CLI directly
npm run astro [command]
```

### Testing
```bash
# Run tests once (CI mode)
npm run test:run

# Run tests in watch mode (development)
npm run test:watch
# or
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npx vitest run src/ui/machines/canvas.machine.test.ts
```

**Test Philosophy:**
- Tests focus on the **Functional Core** (Effect services)
- XState machines are tested via integration tests
- 100% type-safe tests using TypeScript
- Use Vitest for fast, modern testing

## Architecture

### **Core Principle: Functional Core, Imperative Shell** ⭐

This codebase strictly follows the **Functional Core, Imperative Shell** pattern:

**Functional Core (Effect-TS):**
- All business logic lives in `src/core/effects/`
- Pure functions that return `Effect<Env, Error, Result>`
- **Contains ZERO side effects directly in code**: no `invoke()`, `fetch()`, `localStorage`, DOM access
- Includes: validation, transformation, serialization, business rules
- **100% testable** without mocking I/O

**Imperative Shell (XState + Tauri):**
- State machines in `src/ui/machines/` orchestrate **when** to run effects
- Tauri commands in `src-tauri/src/` provide **how** to do I/O
- React components are pure views of state
- Side effects only at the boundaries

**Example Flow:**
```
User Action (React)
  → XState Machine (orchestration)
  → Effect Service (pure logic)
  → Tauri Command (I/O)
  → Rust (native operation)
  → Effect resolves
  → Machine transitions
  → React re-renders
```

**When writing new code:**
- Business logic? → Create an Effect in `core/effects/`
- User flow? → Create an XState machine in `ui/machines/`
- Native I/O? → Create a Tauri command in `src-tauri/`
- UI? → Create a React component (reads state, sends events)

### Frontend-Backend Communication

The application uses **Tauri Commands** for IPC (Inter-Process Communication):

1. **Rust Side** ([src-tauri/src/lib.rs](src-tauri/src/lib.rs)):
   - Define commands with `#[tauri::command]` macro
   - Register handlers in `tauri::Builder` using `invoke_handler!` macro
   - Example: `greet` command takes a string and returns a formatted greeting

2. **Frontend Side** ([src/components/Greet.tsx](src/components/Greet.tsx)):
   - Import `invoke` from `@tauri-apps/api/core`
   - Call commands: `await invoke("command_name", { param: value })`
   - Commands return Promises

### Component Framework Strategy

This template uses **React** exclusively for simplicity (KISS principle):

- **Astro Integration**: Configured in [astro.config.mts](astro.config.mts) with `@astrojs/react`
- **JSX Transform**: React 19's automatic JSX transform (no need to import React)
- **Component Hydration**: Use Astro's client directives (e.g., `client:visible`, `client:only="react"`) to control when components become interactive
- **State Management**: XState for UI flows, React hooks (`useState`, `useCallback`) for local component state

### Styling System

**Vanilla Extract with Contract-Based Theming**:

- **Type-Safe CSS**: Write styles in `*.css.ts` files with full TypeScript support
- **Theme Contract**: All themes implement a type-safe contract ([src/styles/theme.contract.css.ts](src/styles/theme.contract.css.ts))
- **CSS Layers**: Predictable cascade control with `@layer` ([src/styles/layers.css.ts](src/styles/layers.css.ts))
- **Semantic Tokens**: Design tokens named by purpose, not value
- **Pattern**: Import `theme` and use semantic tokens:
  ```typescript
  import { theme } from '@/styles/theme.css';

  const myStyle = style({
    "@layer": {
      [componentsLayer]: {
        color: theme.color.foreground.primary,
        backgroundColor: theme.color.background.surface,
        padding: theme.spacing["4"],
      },
    },
  });
  ```
- **Global Styles**: Imported in [src/layouts/Layout.astro](src/layouts/Layout.astro) via `global.css.ts`
- **ESLint Integration**: Special linting rules apply to `*.css.ts` files (see [eslint.config.ts](eslint.config.ts))
- **Full Documentation**: See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) for complete design system documentation

### Project Structure

```
├── src/                      # Astro frontend source
│   ├── components/          # React components
│   ├── ui/                  # C4 canvas application
│   │   ├── components/      # Canvas UI components
│   │   ├── machines/        # XState machines
│   │   └── nodes/           # Custom ReactFlow nodes
│   ├── core/                # Functional core
│   │   ├── effects/         # Effect-TS services (coming)
│   │   └── schema/          # Zod schemas
│   ├── layouts/             # Astro layouts
│   ├── pages/               # Astro pages (routes)
│   └── styles/              # Vanilla Extract styles (*.css.ts)
├── src-tauri/               # Rust/Tauri backend
│   ├── src/
│   │   ├── lib.rs          # Main Tauri app logic & commands
│   │   └── main.rs         # Entry point
│   ├── Cargo.toml          # Rust dependencies
│   └── tauri.conf.json     # Tauri configuration
└── public/                  # Static assets
```

## Key Configuration Files

- **[tauri.conf.json](src-tauri/tauri.conf.json)**: Defines dev server URL, build commands, window settings, and bundle configuration
- **[astro.config.mts](astro.config.mts)**: Astro configuration with React, Vanilla Extract, and optimization plugins
- **[Cargo.toml](src-tauri/Cargo.toml)**: Rust dependencies and release optimizations (LTO, size optimization)

## Dependencies of Note

- **State Management**: XState (`xstate`, `@xstate/react`) and Effect (`effect`, `@effect-atom/atom-react`)
- **Icons**: `@phosphor-icons/react`
- **Optimizations**: `@playform/compress` and `@playform/inline` for production builds
- **Flow Diagrams**: `@xyflow/react` and `dagre` for graph/flow visualizations

## Adding New Tauri Commands

1. Define the Rust function in [src-tauri/src/lib.rs](src-tauri/src/lib.rs) with `#[tauri::command]`
2. Add it to the `invoke_handler!` macro in the builder
3. Call from frontend using `invoke("command_name", { args })`

## Testing

Vitest is configured as a dev dependency but no test files exist yet. To add tests:
```bash
# Run tests
npx vitest
```
