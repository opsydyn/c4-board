# 🎛️ TACTICAL UI TRANSFORMATION PLAN
## Berkeley Graphics / Military Console Aesthetic

> **Mission**: Transform C4 Board into full military/engineering console UI

---

## 📋 PHASE 1: CORE DESIGN TOKENS UPGRADE

### ✅ Already Have:
- Berkeley Mono in font stack
- Dark theme with grid aesthetic
- Glow effects foundation
- Clip paths for angled corners

### 🔧 Need to Add/Update:

#### **1.1 Tactical Color Palette** *(Nord Arctic + Military)*
```typescript
semantic: {
  // OPERATIONAL STATUS
  ready: "#A3BE8C",      // Green - normal/ready (Nord14)
  caution: "#D08770",    // Amber - caution/unknown (Nord12)
  critical: "#BF616A",   // Red - error/critical (Nord11)
  selected: "#81A1C1",   // Cyan - focus (Nord9)

  // C4 ELEMENTS (keep existing but rename)
  person: "#00ffff",     // Cyan
  system: "#A3BE8C",     // Change to tactical green
  external: "#D08770",   // Tactical amber
  container: "#81A1C1",  // Tactical blue
  component: "#B48EAD",  // Tactical purple (Nord15)
  relationship: "#666666", // Dim gray
}

background: {
  base: "#111111",       // Console black
  surface: "#0f0f0f",    // Panel

 black
  raised: "#1a1a1a",     // Elevated
  grid: "#2a2a2a",       // 1px grid lines
}
```

#### **1.2 Typography Stack - Engineering Typeface**
```typescript
family: {
  mono: "'Berkeley Mono', 'JetBrains Mono', 'Söhne Mono', 'Input Mono', ui-monospace, monospace",
  sans: "'Berkeley Mono', 'JetBrains Mono', monospace", // USE MONO EVERYWHERE
}

// Add uppercase transform utility
textTransform: {
  uppercase: "uppercase",
  none: "none",
}

// Add tracking
letterSpacing: {
  tight: "-0.05em",
  normal: "0",
  wide: "0.05em",
  wider: "0.1em",
  engineering: "0.15em", // NEW - for tactical labels
}
```

#### **1.3 Border/Edge Styles**
```typescript
border: {
  style: {
    solid: "solid",
    dashed: "dashed",        // NEW - for grid lines
    dotted: "dotted",        // NEW - for inactive
    double: "double",        // NEW - for emphasis
  }
}
```

---

## 📋 PHASE 2: COMPONENT REDESIGN

### **2.1 Search Box → TACTICAL SEARCH CONSOLE**

**Before**: Rounded, modern input
**After**: Angular console input with status indicators

```typescript
// SearchBox.css.ts updates:
{
  border: "2px solid #A3BE8C",
  borderRadius: "0",                    // NO ROUNDING
  clipPath: theme.clipPath.sm,          // Angled corners
  textTransform: "uppercase",
  letterSpacing: theme.typography.letterSpacing.engineering,
  fontFamily: theme.typography.family.mono,

  "::before": {
    content: "'>>'",                    // Terminal prompt
    position: "absolute",
    left: "8px",
  }
}
```

**Add status badges:**
```
┌─ SEARCH ──────────────────┐
│ >> _                      │
│ ▸ RESULTS: 3 NODES        │
└───────────────────────────┘
```

### **2.2 Toolbar → TACTICAL CONTROL PANEL**

**Layout**: Horizontal console strip with sectors

```
┌─ FILE ────┬─ ADD NODE ──────────────┬─ STATUS ───┐
│ NEW  SAVE │ PERS SYS EXT CONT COMP │ ●RDY Δt:12s│
└───────────┴─────────────────────────┴────────────┘
```

**Button styling:**
- Remove icons, use **ABBREV TEXT ONLY**
- `PERS`, `SYS`, `EXT`, `CONT`, `COMP`
- Add state indicators: `[PERS]` = ready, `<PERS>` = armed, `!PERS!` = error

### **2.3 Canvas → GRID RADAR DISPLAY**

**Background:**
```typescript
background: {
  image: "linear-gradient(#2a2a2a 1px, transparent 1px),
          linear-gradient(90deg, #2a2a2a 1px, transparent 1px)",
  size: "20px 20px",          // Grid spacing
}
```

**Add HUD overlay:**
```
┌────────────────────────────────────────┐
│ DIAGRAM: PROD-ARCH-v2.1  T+00:14:37   │
│ NODES:12  EDGES:18  Δt:124ms          │
└────────────────────────────────────────┘
```

### **2.4 Nodes → FLOWCHART BOXES**

**Person Node:**
```
┌──────────────┐
│   [PERSON]   │
│  John Doe    │
│ ─────────── │
│  USER │ L1  │
└──────────────┘
```

**System Node:**
```
╔═══════════════╗
║    SYSTEM     ║
║ API Gateway   ║
╠═══════════════╣
║ gRPC │ 12ms  ║
╚═══════════════╝
```

**Styling:**
- Remove border-radius → 0
- Use double borders for emphasis
- Monospace text only
- Uppercase labels
- Status LEDs: `●` green = ready, `◐` amber = caution, `○` gray = unknown

### **2.5 Edges → ORTHOGONAL DASHED LINES**

```typescript
edges: {
  type: "step",              // Orthogonal only
  style: {
    stroke: "#666666",
    strokeWidth: 1,
    strokeDasharray: "5,5",  // Dashed
  }
}
```

**Edge labels** (on hover):
```
┌─ LINK: API → USER-SVC
│  proto: gRPC
│  lat: 12ms
│  hops: 2
└────────────────────
```

### **2.6 Properties Panel → CONSOLE INSPECTOR**

```
┌─ INSP ────────────────────┐
│ NODE: API-GATEWAY         │
│ TYPE: SYSTEM              │
│ ────────────────────────  │
│ LABEL: API Gateway        │
│ TECH:  gRPC               │
│ DESC:  Entry point        │
│ ────────────────────────  │
│ CONN:  3 IN  │  2 OUT     │
│ STAT:  ●RDY  │  Δ0.12s   │
└───────────────────────────┘
```

---

## 📋 PHASE 3: INTERACTION PATTERNS

### **3.1 Keyboard-First Navigation**
- `ESC` = deselect / close
- `TAB` = cycle nodes
- `←↑→↓` = pan canvas
- `CTRL-S` = save
- `CTRL-N` = new board
- `CTRL-F` = focus search
- `1-5` = add node type shortcuts

### **3.2 State Indicators**
- `STBY` = idle
- `ARM` = ready to execute
- `EXEC` = executing
- `ACK` = acknowledged
- `ERR` = error state

### **3.3 Console Feedback**
**Add event log overlay:**
```
┌─ LOG ─────────────────────┐
│ 09:43:21 NODE[SYS] ADD OK │
│ 09:43:19 SAVE ACK         │
│ 09:43:15 CONN[3→5] EST    │
└───────────────────────────┘
```

---

## 📋 PHASE 4: IMPLEMENTATION CHECKLIST

### **Step 1: Update Theme Tokens**
- [ ] Add tactical color palette to `dark.css.ts`
- [ ] Add `textTransform` to theme contract
- [ ] Add `border.style` variants
- [ ] Update semantic colors to military palette
- [ ] Add grid background color

### **Step 2: Update Typography**
- [ ] Force Berkeley Mono everywhere (remove sans fallback)
- [ ] Add uppercase transform utility class
- [ ] Update letter-spacing for engineering style
- [ ] Remove all rounded borders (set to 0)

### **Step 3: Redesign Components**
- [ ] SearchBox → tactical console input
- [ ] Toolbar → control panel layout
- [ ] Nodes → flowchart boxes with ASCII borders
- [ ] Edges → orthogonal dashed lines
- [ ] Properties Panel → inspector console

### **Step 4: Add HUD Elements**
- [ ] Canvas overlay with diagram stats
- [ ] Event log sidebar (collapsible)
- [ ] Status indicators in toolbar
- [ ] Mission time clock (T+HH:MM:SS)

### **Step 5: Interaction Polish**
- [ ] Hover = blinking cursor `_`
- [ ] Click = console beep sound (optional)
- [ ] Selection = glow halo (green)
- [ ] Focus = cyan border pulse

### **Step 6: Grid & Background**
- [ ] 1px grid lines on canvas (#2a2a2a)
- [ ] Optional: radar sweep animation on load
- [ ] Optional: CRT scanline effect (subtle)

---

## 🎨 QUICK WINS (Do First)

1. **Kill all border-radius** → Set everything to `0` or `clipPath`
2. **Uppercase everything** → All labels, buttons, text
3. **Mono font only** → Remove sans-serif fallback
4. **Tactical colors** → Replace bright neon with Nord palette
5. **ASCII borders** → Use `═`, `║`, `┌`, `┐`, etc. in labels
6. **Grid background** → Add to canvas immediately

---

## 📐 DESIGN SYSTEM TOKENS SUMMARY

### New Theme Contract Additions:
```typescript
// Add to theme.contract.css.ts
{
  color: {
    status: {
      ready: null,      // Green
      caution: null,    // Amber
      critical: null,   // Red
    },
    grid: null,         // Grid line color
  },
  typography: {
    textTransform: {
      uppercase: null,
      none: null,
    },
  },
  border: {
    style: {
      solid: null,
      dashed: null,
      dotted: null,
    },
  },
}
```

---

## 🚀 EXECUTION PLAN

### Sprint 1: Foundation (2-3 hours)
- Update theme tokens
- Remove all border-radius
- Force uppercase + mono
- Tactical color palette

### Sprint 2: Components (3-4 hours)
- Redesign nodes with ASCII
- Update toolbar layout
- Console-style panels
- Grid background

### Sprint 3: Polish (2-3 hours)
- HUD overlays
- Event log
- Keyboard shortcuts
- Interaction feedback

---

**Total Estimated Time**: 7-10 hours
**Difficulty**: Medium (mostly styling, no complex logic)
**Impact**: 🔥🔥🔥 MAXIMUM TACTICAL AESTHETIC ACHIEVED

---

Ready to execute? Which phase should we tackle first?
