```markdown
# plan: integrate Effect & XState into the ops-noir C4 app

## 🎯 goal
move from simple hooks → **typed, composable, reactive runtime** using:
- **Effect** for local-first logic (IO, persistence, licensing, DB ops)
- **XState** for UI / workflow state (canvas, dialogs, commands)

we’ll separate **pure business logic (effect)** from **interaction logic (xstate)**.

---

## 🧩 architecture overview

```

Astro (UI shell)
└─ React Islands (ReactFlow, Panels)
├─ XState machines (UI + UX control)
└─ Effect services (domain logic, persistence)
├─ ProjectStore (Yjs + DB sync)
├─ LicenseService (verify, cache)
├─ ExportService (SVG/PDF)
├─ SettingsService (read/write config)
└─ LogService (structured events)

```

- XState orchestrates user flows (open/save/export/license dialogs).
- Effect handles side effects (file IO, crypto, DB).
- Rust commands provide the bridge for Effects that need native power.

---

## ⚙️ 1. folder structure

```

/app
/src
/ui
/machines        # xstate machines
/components       # reactflow nodes, panels
/core
/effects          # effect-ts modules
/adapters         # tauri bridge, yjs binding
/types            # schema + zod syncs

````

---

## 🧠 2. XState usage

each major domain interaction = a machine:

| machine | states | notes |
|----------|---------|-------|
| **canvasMachine** | idle → editing → exporting | controls ReactFlow canvas, triggers effects |
| **licenseMachine** | idle → entering → verifying → verified/invalid | handles Lemon Squeezy key check |
| **projectMachine** | new → open → saving → saved | ties UI to DB snapshots |
| **settingsMachine** | reading → editing → persisted | for config + theme toggle |

machines communicate via events (`sendParent`, `context.effect`).

---

## ⚗️ 3. Effect usage

each module defines its own **Service Layer**, injected via Effect Context.

| service | methods | side effects |
|----------|----------|--------------|
| **ProjectService** | `load(id)`, `save(model)`, `export(path)` | fs (tauri) |
| **LicenseService** | `verify(key)`, `cache(result)` | crypto (tauri) |
| **DBService** | `insert`, `query`, `migrate` | sqlite (rust) |
| **YjsService** | `sync`, `snapshot` | browser IndexedDB |
| **LoggerService** | `info`, `warn`, `error` | tauri log / console |

each returns `Effect<Env, Error, Result>`.

---

### example effect module

```ts
// core/effects/license.ts
import { Effect } from "effect";
import { invoke } from "@tauri-apps/api/tauri";
import { License } from "@schema/license";

export const verifyLicense = (data: License) =>
  Effect.tryPromise({
    try: () =>
      invoke<boolean>("verify_license", {
        data: JSON.stringify(data),
        sigB64: data.sig,
        pubB64: import.meta.env.PUBLIC_KEY,
      }),
    catch: (err) => new Error(`verify failed: ${err}`),
  });
````

---

## 🔄 4. XState + Effect pattern

combine them cleanly:

```ts
import { assign, createMachine } from "xstate";
import * as LicenseFX from "../core/effects/license";

export const licenseMachine = createMachine({
  id: "license",
  initial: "idle",
  context: { key: "", result: null as null | boolean },
  states: {
    idle: { on: { ENTER: "verifying" } },
    verifying: {
      invoke: {
        id: "verify",
        src: (ctx) => LicenseFX.verifyLicense({ ...ctx }),
        onDone: { target: "verified", actions: assign({ result: (_) => true }) },
        onError: { target: "invalid", actions: assign({ result: (_) => false }) },
      },
    },
    verified: {},
    invalid: {},
  },
});
```

---

## 🧱 5. tauri command mapping

rust provides the IO functions that Effect modules call through `invoke`.

```rust
#[tauri::command]
fn read_file(path: String) -> Result<String, String> { std::fs::read_to_string(path).map_err(|e| e.to_string()) }
#[tauri::command]
fn write_file(path: String, data: String) -> Result<(), String> { std::fs::write(path, data).map_err(|e| e.to_string()) }
#[tauri::command]
fn verify_license(data: String, sig_b64: String, pub_b64: String) -> Result<bool, String> { /* ed25519 verify */ }
```

---

## 📡 6. local DB integration (Effect-layer)

```ts
import { Effect } from "effect";
import { invoke } from "@tauri-apps/api/tauri";

export const saveProject = (id: string, data: string) =>
  Effect.tryPromise({
    try: () => invoke("save_project", { id, data }),
    catch: (err) => new Error(String(err)),
  });
```

---

## 🧩 7. runtime composition

main entry builds environment:

```ts
import { Layer } from "effect";
import * as LicenseFX from "./core/effects/license";
import * as ProjectFX from "./core/effects/project";

export const AppLayer = Layer.mergeAll(LicenseFX.Layer, ProjectFX.Layer);
```

xstate machines use `useSelector` or `useService` hooks to interact with these layers.

---

## 🧪 8. dev/test strategy

| layer           | test style                        |
| --------------- | --------------------------------- |
| Effect modules  | run with mocked tauri invocations |
| XState machines | xstate/test plan                  |
| integration     | spawnEffect + machine together    |
| rust commands   | cargo test per command            |

---

## 🚀 9. milestones

| week | deliverable                              |
| ---- | ---------------------------------------- |
| 1    | effect scaffolding + tauri commands stub |
| 2    | xstate machines for license + canvas     |
| 3    | persistence + autosave working           |
| 4    | svg/pdf export + polish                  |
| 5    | updater + signed builds                  |

---

## ✅ 10. principles

### **FUNCTIONAL CORE, IMPERATIVE SHELL** ⭐

This is the **foundational architecture pattern** for the entire app:

**Functional Core (Effect):**
- Pure business logic with no side effects in the code itself
- All domain operations return `Effect<Env, Error, Result>`
- Composable, testable, type-safe
- Examples: validation, transformation, business rules
- Lives in `core/effects/`

**Imperative Shell (XState + Tauri):**
- Orchestrates when/how to run effects
- Manages user interaction flows
- Bridges to native I/O via Tauri commands
- Examples: state machines, UI handlers, file system calls
- Lives in `ui/machines/` and `src-tauri/`

**The Boundary:**
```
┌─────────────────────────────────────────────┐
│  IMPERATIVE SHELL (XState + Tauri)          │
│  • User clicks "Save"                       │
│  • Machine transitions to "saving" state    │
│  • Invokes Effect from core                 │
├─────────────────────────────────────────────┤
│  FUNCTIONAL CORE (Effect)                   │
│  • Pure function: saveProject(model)        │
│  • Returns Effect<void, Error, void>        │
│  • Contains NO: DOM, fetch, invoke, etc.    │
├─────────────────────────────────────────────┤
│  IMPERATIVE SHELL (Tauri Runtime)           │
│  • Effect.runPromise() executes Effect      │
│  • Tauri invoke() writes to filesystem      │
│  • Returns success/error to XState          │
│  • Machine transitions to "saved" or "error"│
└─────────────────────────────────────────────┘
```

**Other Principles:**
* ui = stateless + reactive
* every async call wrapped in `Effect`
* all workflows declarative via `XState`
* everything runs offline, deterministically

---

## 📁 references

* [Effect documentation](https://effect.website/)
* [XState docs](https://xstate.js.org/)
* [Tauri command guide](https://tauri.app/)
* [Yjs docs](https://docs.yjs.dev/)

---

## 📊 Postee Database Schema

Postee is an HTTP client tool (Postman-like) with environment variable management.

### Database Migrations

Located in `src-tauri/migrations/`:
- **008_create_postee_tables.sql** - Creates all Postee tables
- **009_seed_postee_environments.sql** - Seeds default environments (Development, Staging, Production)

### Schema Overview

```
postee_collections
├── id (TEXT, PK)
├── name (TEXT)
├── description (TEXT)
├── sort_order (INTEGER)
├── created_at (INTEGER)
└── updated_at (INTEGER)

postee_requests
├── id (TEXT, PK)
├── collection_id (TEXT, FK → postee_collections)
├── name (TEXT)
├── method (TEXT) -- GET, POST, PUT, etc.
├── url (TEXT)
├── description (TEXT)
├── favorite (INTEGER)
├── sort_order (INTEGER)
├── created_at (INTEGER)
└── updated_at (INTEGER)

postee_request_headers
├── id (INTEGER, PK AUTOINCREMENT)
├── request_id (TEXT, FK → postee_requests)
├── key (TEXT)
├── value (TEXT)
├── is_enabled (INTEGER)
└── sort_order (INTEGER)

postee_request_bodies
├── request_id (TEXT, PK, FK → postee_requests)
├── mode (TEXT) -- 'raw', 'json', 'form'
├── raw (TEXT)
└── form_values (TEXT)

postee_environments ⭐
├── id (TEXT, PK)
├── name (TEXT) -- e.g., "Development", "Staging"
├── description (TEXT)
├── is_default (INTEGER) -- 1 for default environment
├── created_at (INTEGER)
└── updated_at (INTEGER)

postee_environment_variables ⭐
├── id (INTEGER, PK AUTOINCREMENT)
├── environment_id (TEXT, FK → postee_environments)
├── key (TEXT) -- e.g., "API_BASE_URL", "API_KEY"
├── value (TEXT)
├── is_secret (INTEGER) -- 1 for masked/secret values
├── is_enabled (INTEGER) -- 1 for active variables
├── sort_order (INTEGER)
├── created_at (INTEGER)
├── updated_at (INTEGER)
└── UNIQUE(environment_id, key)

postee_history
├── id (TEXT, PK)
├── request_id (TEXT, FK → postee_requests)
├── request_snapshot (TEXT) -- JSON snapshot of request
├── response_status (INTEGER)
├── response_time_ms (INTEGER)
├── response_size_bytes (INTEGER)
├── error_message (TEXT)
└── executed_at (INTEGER)
```

### Environment Variables Feature

**Flow:**
1. User selects an environment (Development/Staging/Production)
2. User adds variables with key-value pairs
3. Variables can be marked as "secret" (masked in UI)
4. Variables can be enabled/disabled without deletion
5. Variables use `{{varName}}` syntax in requests
6. ConfigProvider resolves variables at runtime using Effect Config module

**Implementation:**
- **UI**: `EnvironmentEditor` component (React Aria)
- **State**: XState machine in `postee.machine.ts`
- **Effects**: `config-provider.ts` using Effect Config
- **Database**: SQLite via Tauri commands

**Variable Resolution:**
```typescript
// In request URL
const url = "{{BASE_URL}}/api/users";
// Resolves to: "https://api.dev.example.com/api/users"

// In headers
Authorization: Bearer {{API_KEY}}
// Resolves to: "Bearer dev-api-key-12345"
```

**See also:**
- [src/core/effects/postee/config-provider.ts](src/core/effects/postee/config-provider.ts) - Effect Config integration
- [src/ui/components/postee/EnvironmentEditor.tsx](src/ui/components/postee/EnvironmentEditor.tsx) - UI component

```
```
