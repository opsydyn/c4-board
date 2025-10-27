# Sub-Flows Implementation Complete

## Overview

ReactFlow sub-flows have been successfully integrated into the C4 Canvas application, enabling hierarchical node organization with parent-child relationships.

## Features Implemented

### 1. Parent-Child Relationships

**Universal Nesting** ⭐:

- Containers can contain **ANY node type**: Person, System, External System, Component, or another Container
- All node types support parent-child relationships
- Child nodes maintain relative positions to their parent
- Truly flexible sub-flow architecture

**Smart Node Creation**:

- When a container is selected, **any** node you add is automatically placed **inside** the container:
  - **Person** → Can be added to containers (e.g., users within a system boundary)
  - **System** → Can be added to containers (e.g., subsystems within an application)
  - **External System** → Can be added to containers (e.g., third-party services in a deployment zone)
  - **Container** → Can be nested within containers (e.g., microservices in a platform)
  - **Component** → Can be added to containers (e.g., classes in a module)
- If no container is selected, nodes are created at the top level

### 2. Visual Enhancements

**Selection Styling** ([src/ui/components/nodes/styles.css.ts](src/ui/components/nodes/styles.css.ts)):
- Selected nodes display tactical cyan border (`theme.color.status.selected`)
- Dual-layer glow effect (20px + 40px)
- 3% scale increase for emphasis
- Elevated background color

**MiniMap** ([src/ui/components/C4Canvas.tsx](src/ui/components/C4Canvas.tsx:120-151)):
- Bottom-right tactical minimap
- Color-coded by node type (Person=Cyan, System=Green, etc.)
- Selected nodes highlighted with cyan stroke
- Angular design matching tactical aesthetic

### 3. Layout Intelligence

**Hierarchical Layout** ([src/core/effects/layout.ts](src/core/effects/layout.ts)):
- Auto-layout only affects **top-level nodes**
- Child nodes maintain their relative positions within parents
- Layout functions filter out child nodes before running Dagre
- Edges between top-level nodes only are considered for layout

**Selected Layout**:
- Only layouts selected **top-level nodes**
- Ignores child nodes in selection (they move with their parent)

## How to Use

### Creating Nested Structures

1. **Add a Container**: Click "Add Container" button
2. **Select the Container**: Click on the container node (it will glow cyan)
3. **Add ANY Node Type**: Click any "Add" button - the node will be added **inside** the selected container:
   - "Add Person" → Person inside container
   - "Add System" → System inside container
   - "Add External" → External system inside container
   - "Add Container" → Nested container
   - "Add Component" → Component inside container
4. **Deselect**: Click the canvas background to add nodes at the top level again

### Visual Cues

- **Selected nodes**: Cyan border with tactical glow
- **Container nodes**: Resizable with dashed borders
- **Child nodes**: Positioned relative to parent, move with parent

### Layout Commands

- **⌘L (Layout All)**: Arranges top-level nodes only, preserves child relative positions
- **⌘⇧L (Layout Selected)**: Arranges selected top-level nodes

## Technical Implementation

### Canvas Machine ([src/ui/machines/canvas.machine.ts](src/ui/machines/canvas.machine.ts))

**Component Creation (lines 186-203)**:
```typescript
addComponent: assign({
  nodes: ({ context }) => {
    const selectedNode = context.selectedNodeId
      ? context.nodes.find((n) => n.id === context.selectedNodeId)
      : null;

    const isParentContainer = selectedNode?.type === "container";

    const newNode: Node = {
      id: `component-${context.nodeCounter}`,
      type: "component",
      position: isParentContainer
        ? { x: 20, y: 60 } // Inside container
        : { x: 100, y: 100 }, // Top-level
      ...(isParentContainer && {
        parentId: selectedNode.id,
        extent: "parent",
        expandParent: true,
      }),
    };
  }
}),
```

### Layout Logic ([src/core/effects/layout.ts](src/core/effects/layout.ts))

**Key Changes**:
- Filter nodes: `const topLevelNodes = nodes.filter(node => !node.parentId)`
- Filter edges: Only include edges between top-level nodes
- Return: `[...layoutedTopLevelNodes, ...childNodes]`

### ReactFlow Configuration ([src/ui/components/C4Canvas.tsx](src/ui/components/C4Canvas.tsx))

**Properties**:
- `snapGrid={[20, 20]}` - Tactical 20px grid
- `nodesDraggable` - Enable dragging
- `nodesConnectable` - Enable connections
- `elementsSelectable` - Enable selection

## C4 Model Alignment

This implementation follows C4 model principles:

- **Containers** = Applications, databases, file systems
- **Components** = Classes, interfaces, objects, functions
- **Nesting** = Components live inside Containers
- **Hierarchy** = Containers can contain Containers (microservices, modules)

## Example Use Cases

### Deployment Zones with Universal Nesting ⭐

```text
Container: "AWS Cloud"
  ├─ Container: "Production VPC"
  │   ├─ System: "Load Balancer"
  │   ├─ Container: "Kubernetes Cluster"
  │   │   ├─ Container: "User Service"
  │   │   │   ├─ Component: "User API"
  │   │   │   └─ Component: "User Repository"
  │   │   └─ Container: "Payment Service"
  │   │       ├─ Component: "Payment Processor"
  │   │       └─ External System: "Stripe API"
  │   └─ System: "Database Cluster"
  └─ Person: "DevOps Team" (has access to cloud)
```

### Microservices Architecture

```text
Container: "API Gateway"
  ├─ Component: "Authentication Service"
  ├─ Component: "Rate Limiter"
  └─ Component: "Router"

Container: "User Service"
  ├─ Container: "User API"
  │   ├─ Component: "User Controller"
  │   └─ Component: "User Repository"
  └─ Container: "User Database"
```

### Enterprise System Boundaries

```text
Container: "Corporate Network"
  ├─ Person: "Employees" (within network)
  ├─ System: "Active Directory"
  ├─ Container: "DMZ"
  │   ├─ System: "Public Web Server"
  │   └─ External System: "CDN"
  └─ Container: "Internal Applications"
      ├─ System: "ERP System"
      └─ System: "CRM System"
```

## Files Modified

1. **[src/ui/machines/canvas.machine.ts](src/ui/machines/canvas.machine.ts)** - Parent-child logic in **ALL** node creation actions (Person, System, External, Container, Component)
2. **[src/core/effects/layout.ts](src/core/effects/layout.ts)** - Hierarchical layout support (filters child nodes)
3. **[src/ui/components/C4Canvas.tsx](src/ui/components/C4Canvas.tsx)** - MiniMap + ReactFlow config (20px grid)
4. **[src/ui/components/nodes/styles.css.ts](src/ui/components/nodes/styles.css.ts)** - Enhanced selection styling (tactical cyan glow)

## Next Steps (Future Enhancements)

- [ ] Context menu to "Add Child" to containers
- [ ] Drag-and-drop nodes into containers
- [ ] Auto-layout children within parent containers
- [ ] Collapse/expand containers
- [ ] Visual indicators showing parent-child relationships

---

**Status**: ✅ Complete and tested
**Tactical Aesthetic**: ✅ Maintained throughout
**C4 Model Compliance**: ✅ Aligned with C4 principles
