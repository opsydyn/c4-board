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

```
```
