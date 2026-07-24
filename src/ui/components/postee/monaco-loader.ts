/**
 * Loads Monaco through Vite's module graph instead of Monaco's AMD loader.
 *
 * @monaco-editor/react defaults to fetching `loader.js` at runtime and pulling the
 * editor in as AMD modules, which means shipping a copy of `monaco-editor/min/vs`
 * as static assets. Handing it the ESM build via `loader.config({ monaco })` makes
 * `loader.init()` resolve from the bundled instance immediately — no runtime fetch,
 * no asset copy, and no coupling to the AMD export shape (which changed between
 * monaco 0.54 and 0.55 and silently stalled the editor at its loading state).
 *
 * The Postee workspace renders with `client:only="react"`, so this module only
 * ever evaluates in the browser.
 */

import { loader } from "@monaco-editor/react";
// Import the package root (`esm/vs/editor/editor.main.js`). Narrower entry points
// look tempting — this workspace only speaks `json`, core `plaintext`, and the
// Monarch grammar registered for `postee-graphql` — but importing
// `editor.api.js` plus the JSON contribution is NOT equivalent: the namespace
// MonacoJsonEditor reads, `languages.json`, is assigned only by editor.main.js
// (`monacoApi.languages.json = ...`). The contribution module alone just exports
// `jsonDefaults`, leaving `monaco.languages.json` undefined at runtime.
import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

declare global {
  interface Window {
    MonacoEnvironment?: monaco.Environment;
  }
}

/**
 * Monaco runs its language services in web workers. Vite compiles each worker
 * entry via `?worker`, so they are emitted as ordinary build outputs.
 *
 * JSON is the only configured language service (see MonacoJsonEditor); the GraphQL
 * editor registers Monarch and completion providers on the main thread, so it needs
 * no worker of its own.
 */
window.MonacoEnvironment = {
  getWorker: (_workerId, label) => (label === "json" ? new jsonWorker() : new editorWorker()),
};

loader.config({ monaco });

export const configurePosteeMonaco = (): void => {};
