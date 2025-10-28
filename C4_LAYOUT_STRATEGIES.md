# C4 Architecture - Auto-Layout Strategies

## Overview

C4 modeling has distinct diagram types (Context, Container, Component, Code) with different structural patterns. This document defines Dagre layout strategies optimized for each C4 level and common architectural patterns.

## C4 Diagram Levels

### 1. System Context Diagram (Level 1)
**Purpose**: Show how your system fits in the world
**Elements**: Your system (center) + external systems + users
**Pattern**: Center-focused with radial relationships

### 2. Container Diagram (Level 2)
**Purpose**: Show high-level technology choices
**Elements**: Containers (apps, databases, file systems)
**Pattern**: Layered architecture or service mesh

### 3. Component Diagram (Level 3)
**Purpose**: Show components within a container
**Elements**: Components (classes, services, modules)
**Pattern**: Layered, modular, or hexagonal

### 4. Code Diagram (Level 4)
**Purpose**: Show class/component implementation
**Elements**: Classes, interfaces, relationships
**Pattern**: Dependency graph or package hierarchy

---

## Proposed Dagre Layout Presets

### **Current Presets** (Already Implemented)

```typescript
const TACTICAL_PRESETS = {
  command: { direction: "TB", rankSpacing: 120, nodeSpacing: 80 },
  dataFlow: { direction: "LR", rankSpacing: 120, nodeSpacing: 100 },
  dependencies: { direction: "BT", rankSpacing: 120, nodeSpacing: 80 },
  compact: { direction: "TB", nodeSpacing: 50, rankSpacing: 80 },
  presentation: { direction: "TB", nodeSpacing: 100, rankSpacing: 160 },
};
```

---

## **New C4-Optimized Presets**

### 1. **System Context Layout** (Level 1)
**Use Case**: Radial layout with main system at center

```typescript
systemContext: {
  direction: "TB",
  rankSpacing: 200,
  nodeSpacing: 120,
  // Group by: Internal system (rank 0), external systems (rank 1), users (rank 2)
}
```

**Algorithm**:
- Identify the main system (only non-external system)
- Place at top/center
- External systems on second rank
- Users/actors on third rank
- Wide horizontal spacing for clarity

**Visual**:
```
         [Main System]
            /    \
   [Ext Sys 1]  [Ext Sys 2]
      /              \
 [User 1]         [User 2]
```

---

### 2. **Layered Architecture** (Level 2)
**Use Case**: N-tier architecture (Presentation → Business → Data)

```typescript
layered: {
  direction: "TB",
  rankSpacing: 150,
  nodeSpacing: 100,
  // Strict layering: UI containers → Service containers → Database containers
}
```

**Algorithm**:
- Group containers by layer (presentation, business, data)
- Enforce strict top-down flow
- No backwards edges
- Equal horizontal spacing per layer

**Visual**:
```
[Web UI]    [Mobile UI]     ← Presentation
     \         /
   [API Gateway]             ← Business Logic
      /      \
[Database] [Cache]           ← Data Layer
```

---

### 3. **Microservices Mesh** (Level 2)
**Use Case**: Service-oriented architecture with many interconnections

```typescript
microservices: {
  direction: "LR",
  rankSpacing: 180,
  nodeSpacing: 100,
  // Left-to-right flow: Gateway → Services → Data stores
}
```

**Algorithm**:
- API Gateway/Load Balancer on left
- Service containers in middle columns
- Data stores on right
- Group services by domain

**Visual**:
```
           [Service 1] → [DB 1]
              ↗    ↘
[Gateway] →           → [Cache]
              ↘    ↗
           [Service 2] → [DB 2]
```

---

### 4. **Hexagonal/Ports-Adapters** (Level 3)
**Use Case**: Hexagonal architecture with core and adapters

```typescript
hexagonal: {
  direction: "TB",
  rankSpacing: 140,
  nodeSpacing: 90,
  // Core components at center, adapters around edges
}
```

**Algorithm**:
- Core domain components in center rank
- Input adapters (controllers, handlers) on top
- Output adapters (repositories, clients) on bottom
- Symmetrical layout

**Visual**:
```
[REST API]  [GraphQL]     ← Input Adapters
        \      /
    [Domain Logic]        ← Core
        /      \
  [DB Repo] [Email]       ← Output Adapters
```

---

### 5. **Event-Driven Flow** (Level 2)
**Use Case**: Event sourcing, message queues, pub/sub

```typescript
eventDriven: {
  direction: "LR",
  rankSpacing: 200,
  nodeSpacing: 120,
  // Publishers → Queue/Broker → Subscribers
}
```

**Algorithm**:
- Publishers on left
- Message brokers/queues in middle
- Subscribers on right
- Group by event topic

**Visual**:
```
[Producer 1] →              → [Consumer 1]
                [EventBus]
[Producer 2] →              → [Consumer 2]
```

---

### 6. **Dependency Graph** (Level 3/4)
**Use Case**: Show module dependencies (already exists as "dependencies")

```typescript
dependencyTree: {
  direction: "BT",
  rankSpacing: 100,
  nodeSpacing: 80,
  // Leaf dependencies at bottom, dependents flow upward
}
```

**Visual**:
```
      [App Controller]        ← Top-level
          /      \
  [UserService]  [AuthService]
         |           |
    [Database]  [JWT Library]  ← Dependencies
```

---

### 7. **Client-Server Tiers** (Level 1/2)
**Use Case**: Traditional 3-tier web applications

```typescript
clientServer: {
  direction: "TB",
  rankSpacing: 180,
  nodeSpacing: 120,
  // Client tier → Server tier → Database tier
}
```

**Visual**:
```
[Browser]  [Mobile App]     ← Client Tier
       \      /
    [Web Server]             ← Server Tier
         |
    [Database]               ← Data Tier
```

---

### 8. **Hub-Spoke / Star Pattern** (Level 2)
**Use Case**: Central integration hub with satellite services

```typescript
hubSpoke: {
  direction: "TB",
  rankSpacing: 160,
  nodeSpacing: 100,
  // Central hub at top, spokes radiate downward
}
```

**Algorithm**:
- Find node with most connections (hub)
- Place at center/top
- Distribute connected nodes radially
- Equal spacing around hub

**Visual**:
```
        [Integration Hub]
       /    |    \    \
  [CRM] [ERP] [Billing] [Auth]
```

---

### 9. **Pipeline / Sequential Flow** (Level 2/3)
**Use Case**: Data pipelines, ETL processes, build pipelines

```typescript
pipeline: {
  direction: "LR",
  rankSpacing: 160,
  nodeSpacing: 80,
  // Strict left-to-right sequential stages
}
```

**Visual**:
```
[Extract] → [Transform] → [Validate] → [Load]
```

---

### 10. **Deployment Zones** (Level 2)
**Use Case**: Group containers by deployment environment/region

```typescript
deploymentZones: {
  direction: "TB",
  rankSpacing: 200,
  nodeSpacing: 140,
  // Group by: Edge → Public Cloud → Private Cloud → On-Premise
}
```

**Visual**:
```
[CDN] [WAF]                  ← Edge
    |
[Load Balancer]              ← Public DMZ
    |
[App Servers] [Cache]        ← Private Network
    |
[Database]                   ← Data Center
```

---

## Smart Layout Selection

### Auto-Detect Layout Based on Graph Structure

```typescript
function detectBestLayout(nodes: Node[], edges: Edge[]): LayoutPreset {
  const personNodes = nodes.filter(n => n.type === 'person');
  const externalNodes = nodes.filter(n => n.type === 'externalSystem');
  const containerNodes = nodes.filter(n => n.type === 'container');
  const componentNodes = nodes.filter(n => n.type === 'component');

  // System Context: Many external systems + users
  if (externalNodes.length > 3 && personNodes.length > 0) {
    return 'systemContext';
  }

  // Layered: Containers with hierarchical flow
  if (containerNodes.length > 5 && hasLayeredStructure(nodes, edges)) {
    return 'layered';
  }

  // Microservices: Many containers with mesh connections
  if (containerNodes.length > 6 && hasHighConnectivity(edges)) {
    return 'microservices';
  }

  // Components: Mostly components, suggest hexagonal
  if (componentNodes.length > 8) {
    return 'hexagonal';
  }

  // Pipeline: Linear chain
  if (isLinearChain(edges)) {
    return 'pipeline';
  }

  // Default to command hierarchy
  return 'command';
}
```

---

## Advanced Layout Features

### 1. **Swimlanes** (Manual grouping)
Group nodes into vertical/horizontal lanes:
- By deployment zone (Dev, Staging, Prod)
- By bounded context (DDD)
- By team ownership

### 2. **Clustering**
Group related nodes visually:
- Microservices by domain
- Components by module
- Systems by vendor

### 3. **Rank Constraints**
Force specific nodes to same rank:
- All databases at bottom
- All user-facing systems at top
- Gateway/proxy systems in middle

### 4. **Edge Routing**
- **Orthogonal** (90° angles) - for tactical diagrams ✅ Already done
- **Curved** - for organic flow
- **Bundled** - for complex graphs

---

## Implementation Priority

### Phase 1 (Essential - Immediate)
- [x] Command hierarchy (done)
- [x] Data flow L→R (done)
- [ ] **Layered architecture** ⭐
- [ ] **Microservices mesh** ⭐
- [ ] **System context radial** ⭐

### Phase 2 (Valuable - Next Sprint)
- [ ] Hexagonal/Ports-Adapters
- [ ] Event-driven flow
- [ ] Client-Server tiers
- [ ] Pipeline sequential

### Phase 3 (Nice-to-Have)
- [ ] Hub-Spoke pattern
- [ ] Deployment zones
- [ ] Smart auto-detect layout
- [ ] Custom swimlanes

---

## UI Design Mockup

### Layout Picker Menu
```
┌─────────────────────────────┐
│ AUTO-LAYOUT                 │
├─────────────────────────────┤
│ Quick Layouts               │
│  • Command Hierarchy   ⌘1   │
│  • Data Flow          ⌘2   │
│  • Layered (3-tier)   ⌘3   │
│  • Microservices      ⌘4   │
│  • System Context     ⌘5   │
├─────────────────────────────┤
│ Advanced                    │
│  • Hexagonal                │
│  • Event-Driven             │
│  • Pipeline                 │
│  • Hub-Spoke                │
│  • Compact                  │
│  • Presentation             │
├─────────────────────────────┤
│ ✨ Smart Auto-Detect        │
└─────────────────────────────┘
```

---

## References

- **C4 Model**: https://c4model.com/
- **Dagre Wiki**: https://github.com/dagrejs/dagre/wiki
- **ReactFlow Layouting**: https://reactflow.dev/learn/layouting
- **Software Architecture Patterns**: Martin Fowler, Clean Architecture

---

**Next Steps**: Implement Phase 1 layouts (Layered, Microservices, System Context) with keyboard shortcuts.
