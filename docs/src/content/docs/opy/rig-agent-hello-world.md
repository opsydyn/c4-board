---
title: "Rig Agent Hello World"
---

# Rig Agent Hello World

This adds a minimal Rust-powered `rig-core` agent command and a UI trigger in Settings.

Example key value intentionally omitted. Do not commit real API keys.

## Runtime Wiring

1. Rust command: `rig_agent_hello` in `src-tauri/src/ai_agent.rs`
2. Tauri registration: `src-tauri/src/lib.rs`
3. Effect runtime wrapper: `src/core/effects/ai-agent.runtime.ts`
4. UI test panel: `src/ui/components/settings/SettingsPanel.tsx` (`AI Agent (Rig)`)

## Required API Key

Preferred path:

1. Open `/settings`
2. Go to `AI Agent`
3. Enter `OpenAI API Key` (stored in `app_settings` as `openAiApiKey`)

Fallback path (environment variables):

1. `OPSYDYN_OPENAI_API_KEY`
2. `OPENAI_API_KEY`

Runtime lookup order:

1. Settings DB key (`openAiApiKey`)
2. Environment variables

## Quick Test

1. Open `/settings`
2. Go to `AI Agent`
3. Pick model + prompt
4. Click `RUN HELLO AGENT`
5. Confirm response text appears in the card
