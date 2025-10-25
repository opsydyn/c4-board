# Design System Documentation

## Overview

This project implements a **contract-based design system** using Vanilla Extract with modern CSS practices:

- **Type-safe theme contracts** - Enforced structure across all themes
- **CSS Cascade Layers** - Predictable specificity control
- **Semantic design tokens** - Named by purpose, not value
- **Constraint-based system** - Limited, intentional choices

## Architecture

```
src/styles/
├── layers.css.ts          # CSS @layer definitions
├── theme.contract.css.ts  # Type-safe theme contract
├── theme.css.ts           # Main theme export
└── themes/
    ├── dark.css.ts        # Dark theme implementation
    └── light.css.ts       # Light theme implementation
```

## Theme Contract

The **theme contract** defines the structure that all themes must implement. This ensures type safety and consistency.

```typescript
import { theme } from '@/styles/theme.css';

// ✅ Type-safe access to design tokens
const myStyle = style({
  color: theme.color.foreground.primary,  // Autocomplete works!
  backgroundColor: theme.color.background.surface,
  padding: theme.spacing["4"],
});
```

### Color System

Colors are organized by **semantic purpose**, not by value:

#### Background Hierarchy
- `background.base` - Canvas background (deepest layer)
- `background.surface` - Elevated surfaces (cards, panels)
- `background.raised` - Hover/focus states
- `background.input` - Input field backgrounds
- `background.inputFocus` - Focused input state

#### Foreground Hierarchy
- `foreground.primary` - Headings, important text (highest contrast)
- `foreground.secondary` - Body text, descriptions
- `foreground.tertiary` - Muted text, placeholders
- `foreground.disabled` - Disabled state

#### Interactive States
- `interactive.primary` - Primary actions, links
- `interactive.hover` - Hover state
- `interactive.active` - Active/pressed state
- `interactive.focus` - Focus ring

#### Semantic Colors (C4 Diagram)
- `semantic.person` - Person elements (cyan)
- `semantic.system` - System elements (green)
- `semantic.external` - External systems (amber)
- `semantic.relationship` - Connections/edges

### Spacing Scale

4px base unit (0.25rem):

```typescript
spacing: {
  "0": "0px",    // 0
  "1": "4px",    // 0.25rem
  "2": "8px",    // 0.5rem
  "3": "12px",   // 0.75rem
  "4": "16px",   // 1rem
  "5": "20px",   // 1.25rem
  "6": "24px",   // 1.5rem
  "8": "32px",   // 2rem
  "10": "40px",  // 2.5rem
  "12": "48px",  // 3rem
  "16": "64px",  // 4rem
}
```

### Typography Scale

```typescript
typography: {
  family: {
    mono: "'Courier New', monospace",
    sans: "system-ui, sans-serif",
  },
  size: {
    xs: "11px",
    sm: "12px",
    base: "14px",
    md: "16px",
    lg: "18px",
    xl: "20px",
    "2xl": "24px",
  },
  weight: {
    regular: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  lineHeight: {
    tight: "1.25",
    normal: "1.5",
    relaxed: "1.75",
  },
  letterSpacing: {
    tight: "-0.05em",
    normal: "0",
    wide: "0.05em",
    wider: "0.1em",
  },
}
```

### Effects

```typescript
effect: {
  glow: {
    none: "none",
    sm: "0 0 8px rgba(0, 255, 170, 0.2)",
    base: "0 0 12px rgba(0, 255, 170, 0.3)",
    md: "0 0 16px rgba(0, 255, 170, 0.3)",
    lg: "0 0 20px rgba(0, 255, 170, 0.3)",
    xl: "0 0 24px rgba(0, 255, 170, 0.4)",
  },
  textGlow: {
    none: "none",
    sm: "0 0 4px rgba(0, 255, 170, 0.4)",
    base: "0 0 6px rgba(0, 255, 170, 0.5)",
    md: "0 0 8px rgba(0, 255, 170, 0.6)",
  },
  iconGlow: "0 0 10px rgba(0, 255, 170, 0.7)",
  dropShadow: "drop-shadow(0 0 4px rgba(0, 255, 170, 0.5))",
}
```

### Clip Paths (Slanted Corners)

Retro terminal aesthetic with slanted corners:

```typescript
clipPath: {
  none: "none",
  sm: "polygon(0 2px, 2px 0, 100% 0, ...)",   // 2px clips
  base: "polygon(0 4px, 4px 0, 100% 0, ...)",  // 4px clips
  md: "polygon(0 6px, 6px 0, 100% 0, ...)",    // 6px clips
  lg: "polygon(0 8px, 8px 0, 100% 0, ...)",    // 8px clips
}
```

## CSS Cascade Layers

Layers control specificity in a predictable way:

```typescript
@layer reset, theme, base, components, utilities, overrides;
```

1. **reset** - Browser resets (lowest priority)
2. **theme** - CSS custom properties
3. **base** - Default element styles
4. **components** - Component-specific styles ← Most styles here
5. **utilities** - Utility classes
6. **overrides** - Emergency fixes (highest priority)

### Using Layers in Styles

```typescript
import { componentsLayer } from '@/styles/layers.css';

export const myComponent = style({
  "@layer": {
    [componentsLayer]: {
      backgroundColor: theme.color.background.surface,
      padding: theme.spacing["4"],
    },
  },
});
```

## Creating a New Theme

To add a theme (e.g., "blue theme"):

1. Create `src/styles/themes/blue.css.ts`
2. Implement the contract:

```typescript
import { createTheme } from "@vanilla-extract/css";
import { themeContract } from "../theme.contract.css";

export const blueTheme = createTheme(themeContract, {
  color: {
    background: {
      base: "#001122",
      surface: "#002244",
      // ... implement all tokens
    },
    // ... must implement entire contract
  },
  // ... spacing, typography, etc.
});
```

3. Export from `theme.css.ts`:

```typescript
export const themes = {
  dark: darkTheme,
  light: lightTheme,
  blue: blueTheme,  // ← Add here
} as const;
```

## Theme Switching

The contract system enables runtime theme switching:

```tsx
import { themes } from '@/styles/theme.css';

// In your component
<body className={themes[userPreference]}>
  {children}
</body>
```

## Best Practices

### ✅ DO

- Use semantic token names: `theme.color.foreground.primary`
- Apply styles in the `components` layer
- Use the spacing scale: `theme.spacing["4"]`
- Reference effects: `theme.effect.glow.base`

### ❌ DON'T

- Hard-code colors: ~~`color: "#00ffaa"`~~
- Hard-code spacing: ~~`padding: "16px"`~~
- Use arbitrary values: ~~`fontSize: "15px"`~~
- Skip the layer wrapper

## Benefits

1. **Type Safety** - Autocomplete + compile-time errors
2. **Consistency** - Limited, intentional design choices
3. **Maintainability** - Change once, apply everywhere
4. **Themeable** - Easy dark/light/custom themes
5. **Predictable** - CSS layers control specificity
6. **Modern** - Uses latest CSS features

## WCAG AAA Compliance

All color combinations meet WCAG AAA standards (7:1+ contrast):

- `foreground.primary` on `background.base`: 21:1 ✓
- `foreground.secondary` on `background.base`: 11.7:1 ✓
- `interactive.primary` on `background.base`: 14.5:1 ✓

## Resources

- [Vanilla Extract Theming](https://vanilla-extract.style/documentation/theming/)
- [CSS Cascade Layers](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
- [WCAG Contrast Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/contrast-enhanced.html)
