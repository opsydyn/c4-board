---
title: "ADR-003: MCP Integration Architecture"
---

# ADR-003: MCP Integration Architecture

**Status:** Proposed
**Date:** 2025-12-31
**Deciders:** Alan (Product Owner), Claude (Implementation)
**Related:** [ADR-001](001-postee-workspace-refactor.md), [ADR-002](002-postee-actor-model-refactor.md)

---

## Context

Postee currently supports HTTP request testing (similar to Postman/Insomnia). We need to add support for the **Model Context Protocol (MCP)**, an emerging standard for AI system integration introduced by Anthropic in November 2024.

### What is MCP?

MCP is a JSON-RPC 2.0 based protocol that standardizes how AI systems integrate with external tools, data sources, and systems. Unlike traditional REST APIs:

- **Stateful, bidirectional** sessions (not stateless request-response)
- **Dynamic discovery** of capabilities (servers advertise tools/resources/prompts)
- **Three core primitives:**
  - **Tools:** Functions the AI can invoke (e.g., `execute_query`, `create_file`)
  - **Resources:** Data entities exposed by servers (files, API responses, database records)
  - **Prompts:** Reusable message templates for guiding AI workflows
- **Multiple transports:** stdio (local servers), SSE (server-sent events), HTTP

### User Need

Users need a way to:
1. **Connect to MCP servers** via stdio/SSE/HTTP transports
2. **Discover capabilities** (list available tools, resources, prompts)
3. **Test interactions** (invoke tools, read resources, render prompts)
4. **Debug workflows** (view request/response history, replay operations)

This enables testing MCP servers during development, similar to how Postee tests HTTP APIs. Reference implementation: [MCP Inspector](https://github.com/modelcontextprotocol/inspector).

### Technical Constraints

**Must adhere to project architecture:**
- ✅ **Functional Core, Imperative Shell** (ADR-001)
- ✅ **Effect-TS** for business logic (pure functions, typed errors)
- ✅ **XState Actor Model** for state management (ADR-002)
- ✅ **TDD with Red-Green-Blue cycle** (mandatory for all features)
- ✅ **Bun** as package manager (not npm/pnpm)
- ✅ **SQLite** for persistence (same DB as Postee HTTP)
- ✅ **Vanilla Extract** for tactical CSS styling

**Protocol Requirements:**
- Support all three MCP transports (stdio, SSE, HTTP)
- Handle bidirectional communication (server-initiated notifications)
- Manage multiple concurrent server connections
- Support JSON-RPC 2.0 message format
- Handle capability negotiation (initialize handshake)

---

## Decision

We will implement MCP support as a **separate workspace** within Postee, following the established Functional Core, Imperative Shell pattern with these key architectural decisions:

### 1. Separate Workspace (Not Mixed with HTTP)

**Decision:** Create a new `/mcp` route with dedicated UI, separate from HTTP collections.

**Rationale:**
- Clean separation of concerns (HTTP vs MCP are different protocols)
- Easier to develop independently (no risk of breaking HTTP features)
- Simpler mental model for users (toggle between HTTP and MCP modes)
- Can share components (Monaco editor, TabBar) without coupling state

**Implementation:**
- New Astro page: `/src/pages/mcp.astro`
- New machine: `/src/ui/machines/mcp.machine.ts`
- New components: `/src/ui/components/mcp/*`
- Navigation link in PosteeWorkspace sidebar or top-level nav

### 2. Transport-Agnostic Core with Stdio-First Implementation

**Decision:** Abstract transport layer with stdio as the first implementation, followed by SSE and HTTP.

**Transport Priority:**
1. **Stdio** (Phase 1) - Most common, simplest to test locally
2. **SSE** (Phase 3) - Enables remote cloud MCP servers
3. **HTTP** (Phase 3) - Standard JSON-RPC over HTTP

**Rationale:**
- Stdio covers 80% of development use cases (npx/node local servers)
- Establishes patterns for other transports
- Can test end-to-end without external dependencies
- SSE/HTTP reuse stdio abstractions

**Implementation:**
```typescript
// Core interface (transport-agnostic)
interface MCPClientDriver {
  connect(serverId, transport): Effect<Capabilities, Error>;
  sendRequest(serverId, request): Effect<Response, Error>;
  disconnect(serverId): Effect<void, never>;
}

// Transport implementations
sendRequest: (serverId, request) =>
  Effect.gen(function* () {
    const transport = getTransport(serverId);
    return yield* MCPTransportType.$match(transport, {
      Stdio: ({ command, args }) => sendStdioRequest(serverId, request),
      SSE: ({ url }) => sendSSERequest(serverId, request),
      HTTP: ({ url }) => sendHTTPRequest(serverId, request),
    });
  })
```

### 3. Actor Model for Connection Lifecycle

**Decision:** Use XState's actor model with spawned child machines for each server connection (per ADR-002).

**Architecture:**
- **Parent machine** (`mcp.machine.ts`): Orchestrates workspace, manages servers list
- **Child actors** (`mcp-connection.machine.ts`): One per server, manages connection lifecycle

**Rationale:**
- Each connection has independent state (connecting, connected, error)
- Can connect/disconnect servers without affecting others
- Scales to N concurrent servers (spawn N actors)
- Easier to test in isolation (mock individual connections)
- Follows existing ADR-002 pattern

**States:**
```
Parent (mcp.machine.ts):
  initialising → ready

Child (mcp-connection.machine.ts):
  disconnected → connecting → connected
                            → error → reconnecting
```

### 4. SQLite Persistence (Not Config Files)

**Decision:** Store all MCP state in SQLite database (same as Postee HTTP).

**Tables:**
- `mcp_servers` - Connection configs (transport type, command/URL, status)
- `mcp_tools` - Discovered tools (name, inputSchema, server FK)
- `mcp_resources` - Discovered resources (URI, mimeType, server FK)
- `mcp_prompts` - Discovered prompts (name, arguments, server FK)
- `mcp_history` - Execution log (operation type, request/response snapshots, metrics)

**Rationale:**
- ✅ **Persistence** across app restarts (user expectations)
- ✅ **History tracking** critical for debugging MCP workflows
- ✅ **Consistency** with existing Postee pattern (same DB)
- ✅ **Future features** enabled (sync, export, search)
- ✅ **Relational integrity** (foreign keys, cascades)

**Trade-off:** Could use `.mcp.json` config files (simpler initially), but:
- ❌ No history tracking
- ❌ No relational queries (e.g., "find all tools from server X")
- ❌ Manual sync/persistence logic

### 5. Effect-TS for All Business Logic

**Decision:** All MCP logic lives in Effect services (Functional Core), with Tauri commands only doing I/O (Imperative Shell).

**Functional Core:**
```typescript
// /src/core/effects/mcp/client.ts
export const listTools = (
  serverId: MCPServerId
): Effect.Effect<ReadonlyArray<MCPTool>, MCPTransportError, MCPClient> =>
  Effect.gen(function* () {
    const client = yield* MCPClient;
    const response = yield* client.sendRequest(serverId, {
      jsonrpc: "2.0",
      id: nanoid(),
      method: "tools/list",
    });

    // Parse and validate (pure logic)
    return parseToolsResponse(response);
  });
```

**Imperative Shell:**
```rust
// /src-tauri/src/mcp/stdio.rs
#[tauri::command]
pub async fn mcp_stdio_request(
    state: State<'_, MCPProcessManager>,
    server_id: String,
    request: JSONRPCRequest,
) -> Result<JSONRPCResponse, String> {
    // Pure I/O: write to stdin, read from stdout
}
```

**Rationale:**
- ✅ **Testable** without mocking I/O (pure functions)
- ✅ **Type-safe** error channel (`Effect<T, E>`)
- ✅ **Composable** (chain Effects with `flatMap`, `catchTag`)
- ✅ **Follows ADR-001** Functional Core pattern

### 6. Branded Types for Compile-Time Safety

**Decision:** Use Effect's `Brand` to create distinct ID types (MCPServerId, MCPToolId, etc.).

**Example:**
```typescript
// types.ts
export type MCPServerId = string & Brand.Brand<"MCPServerId">;
export const MCPServerId = Brand.nominal<MCPServerId>();

export type MCPToolId = string & Brand.Brand<"MCPToolId">;
export const MCPToolId = Brand.nominal<MCPToolId>();

// ❌ This won't compile:
const toolId: MCPToolId = MCPServerId("server-123");

// ✅ This is required:
const toolId: MCPToolId = MCPToolId("tool-456");
```

**Rationale:**
- ✅ **Prevents ID mixing** at compile time (no passing wrong ID type)
- ✅ **Self-documenting** function signatures
- ✅ **Zero runtime cost** (brands are erased after compilation)

### 7. Tagged Enums for Sum Types

**Decision:** Use `Data.taggedEnum` for transport types, connection status, operation types.

**Example:**
```typescript
export const MCPTransportType = Data.taggedEnum<{
  Stdio: { command: string; args: string[]; env?: Record<string, string> };
  SSE: { url: string };
  HTTP: { url: string };
}>();

// Pattern matching (exhaustive)
const result = MCPTransportType.$match(transport, {
  Stdio: ({ command, args }) => `Running ${command} ${args.join(" ")}`,
  SSE: ({ url }) => `Connected to ${url}`,
  HTTP: ({ url }) => `POST to ${url}`,
});
```

**Rationale:**
- ✅ **Type-safe** pattern matching (compiler ensures all cases handled)
- ✅ **No boolean blindness** (explicit state vs `isConnected: boolean`)
- ✅ **Payload support** (each variant can carry different data)

### 8. Phased Implementation (Incremental TDD)

**Decision:** Implement in 4 phases over 6-8 weeks, following Red-Green-Blue TDD for every feature.

**Phases:**
1. **Phase 1** (3 weeks): Stdio transport + Tools only
2. **Phase 2** (1-2 weeks): Resources + Prompts
3. **Phase 3** (1-2 weeks): SSE + HTTP transports
4. **Phase 4** (2-3 weeks): Polish (styling, error recovery, optimization)

**TDD Workflow:**
- **RED:** Write failing test
- **GREEN:** Minimal implementation to pass
- **BLUE:** Refactor to align with Functional Core pattern
- **Commit at GREEN** (each passing test is a checkpoint)

**Rationale:**
- ✅ **Incremental value** (working stdio client in 3 weeks)
- ✅ **Risk mitigation** (prove architecture early)
- ✅ **Quality built-in** (100% test coverage from day one)

---

## Consequences

### Positive

✅ **Architecture alignment:** Follows all existing ADRs (Functional Core, Actor Model, TDD)

✅ **Type safety:** Branded types + tagged enums prevent entire classes of bugs

✅ **Testability:** Effect services are 100% testable without mocking I/O

✅ **Scalability:** Actor model supports unlimited concurrent server connections

✅ **Maintainability:** Clean separation (core logic vs I/O, HTTP vs MCP)

✅ **User experience:** Separate workspace keeps HTTP and MCP workflows clear

✅ **Future-proof:** Transport abstraction makes adding new transports trivial

### Negative

❌ **Complexity:** Effect-TS has learning curve for contributors unfamiliar with functional programming

❌ **Boilerplate:** Branded types, tagged enums require more upfront typing

❌ **Timeline:** 6-8 weeks is significant investment (but phased delivery mitigates risk)

❌ **Database migrations:** More tables to maintain, schema changes require migrations

### Neutral

⚖️ **Separate workspace:** Simplifies architecture but requires navigation between HTTP/MCP

⚖️ **Stdio-first:** Delays SSE/HTTP support but establishes patterns correctly

⚖️ **SQLite persistence:** More robust than config files but requires migration infrastructure

---

## Alternatives Considered

### Alternative 1: Unified HTTP + MCP Workspace

**Approach:** MCP servers appear as special collection types alongside HTTP requests.

**Rejected because:**
- ❌ Mixed mental model (HTTP vs MCP have different interaction patterns)
- ❌ Higher coupling risk (shared state machines)
- ❌ Harder to test (can't isolate MCP from HTTP)

### Alternative 2: HTTP-First Transport Implementation

**Approach:** Start with HTTP transport instead of stdio.

**Rejected because:**
- ❌ Most MCP servers use stdio (npx pattern)
- ❌ Harder to test (requires external HTTP server)
- ❌ Less common in development workflows

### Alternative 3: Config File Persistence (.mcp.json)

**Approach:** Store server configs in JSON files instead of SQLite.

**Rejected because:**
- ❌ No history tracking (critical for debugging)
- ❌ No relational queries (hard to find "all tools from server X")
- ❌ Manual sync logic (when to write file?)
- ❌ Doesn't follow Postee pattern (HTTP uses SQLite)

### Alternative 4: Monolithic Machine (No Actor Model)

**Approach:** Single machine with boolean flags for connection state.

**Rejected because:**
- ❌ Violates ADR-002 (Actor Model for independent state)
- ❌ Boolean blindness (no explicit connection states)
- ❌ Doesn't scale (hard to manage N concurrent connections)
- ❌ Harder to test (can't mock individual connections)

### Alternative 5: Monaco Only (No JSON Schema Forms)

**Approach:** Always use Monaco JSON editor for tool arguments (no auto-generated forms).

**Accepted for MVP, but:**
- ⚠️ Less user-friendly than auto-generated forms
- ⚠️ Requires users to know JSON Schema
- ✅ But: Simpler to implement, can add forms in Phase 4

---

## Implementation Plan

### Phase 1: Foundation (Stdio Only) - 3 Weeks

**Week 1: Core Types + Database**
- [ ] Migration 013: Create mcp_servers, mcp_tools, mcp_resources, mcp_prompts, mcp_history tables
- [ ] `/src/core/effects/mcp/types.ts`: Branded types, tagged enums, errors
- [ ] Tests for type safety (branded ID mixing should fail compilation)

**Week 2: Effect Services + Tauri Commands**
- [ ] `/src/core/effects/mcp/client.ts`: MCPClient service interface
- [ ] `/src/core/effects/mcp/transports/stdio.ts`: Stdio transport implementation
- [ ] `/src-tauri/src/mcp/stdio.rs`: Process spawning, JSON-RPC over stdin/stdout
- [ ] Tests: Mock MCPClient layer, test listTools/callTool

**Week 3: State Machines + UI**
- [ ] `/src/ui/machines/mcp.machine.ts`: Parent orchestrator
- [ ] `/src/ui/machines/mcp-connection.machine.ts`: Child connection actor
- [ ] `/src/ui/components/mcp/MCPWorkspace.tsx`: Main container
- [ ] `/src/ui/components/mcp/MCPServerList.tsx`: Sidebar
- [ ] `/src/ui/components/mcp/MCPToolInvoker.tsx`: Tool testing UI
- [ ] `/src/pages/mcp.astro`: Route integration
- [ ] Tests: Machine state transitions, component rendering

**Deliverable:** Working stdio MCP client with tool invocation

### Phase 2-4: See Plan File

See `/Users/alan/.claude/plans/hidden-prancing-twilight.md` for detailed breakdown of Phases 2-4.

---

## References

- [Model Context Protocol Specification (2024-11-05)](https://spec.modelcontextprotocol.io/specification/2024-11-05/)
- [MCP Inspector (Reference Implementation)](https://github.com/modelcontextprotocol/inspector)
- [MCP Transport Specification](https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/transports/)
- [Effect-TS Documentation](https://effect.website/)
- [XState v5 Documentation](https://statelyai.com/docs)
- [ADR-001: Postee Workspace Refactor](001-postee-workspace-refactor.md)
- [ADR-002: Postee Actor Model Refactor](002-postee-actor-model-refactor.md)

---

## Approval

**Status:** Proposed (awaiting approval)

**Next Steps:**
1. Review this ADR with team
2. Address any concerns or questions
3. Update status to "Accepted" when approved
4. Begin Phase 1 implementation with TDD

**Questions for Review:**
- Do we need to support MCP protocol version negotiation, or hard-code 2024-11-05?
- Should MCP workspace share environments with HTTP workspace?
- Tactical styling in Phase 1 or Phase 4?