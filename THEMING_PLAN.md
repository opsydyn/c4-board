# Re-Theming Plan: Bootstrap Dark → Tactical Military

## Current State Analysis

### Current Theme (Nord-based Tactical)
**Philosophy**: Berkeley Graphics terminal aesthetic with cyan glows
- **Background**: Pure black (#111111, #0f0f0f)
- **Primary accent**: Nord cyan (#88C0D0, #81A1C1)
- **Semantic colors**: Nord palette (green, amber, purple, cyan)
- **Effects**: Cyan glow effects (rgba(0, 255, 170))

### Bootstrap Dark Palette Analysis
**Philosophy**: Modern dark mode with grayscale foundation
- **Background**: Dark gray (#212529, #343a40, #2b3035)
- **Emphasis**: White-based (#fff, #dee2e6)
- **Semantic colors**: Blue-primary, complementary accents
- **Borders**: Mid-gray (#495057, #6c757d)

## Color Assessment & Strategy

### 🎯 What to Keep (Current Theme Strengths)
1. **Pure black backgrounds** - maintains tactical/terminal aesthetic
2. **Cyan glow effects** - signature Berkeley Graphics look
3. **High contrast ratios** - WCAG AAA compliance
4. **C4 semantic colors** - well-established visual language

### 🔄 What to Consider from Bootstrap
1. **Grayscale refinement**: Bootstrap's gray scale is more refined
   - `--bs-gray-600: #6c757d` - good for borders
   - `--bs-gray-700: #495057` - subtle borders
   - `--bs-gray-800: #343a40` - raised surfaces

2. **Emphasis system**: Bootstrap's emphasis colors provide hierarchy
   - Primary/secondary/tertiary text colors
   - Could improve readability

3. **Border colors**: More subtle than current theme
   - Current: Bright cyan (#81A1C1)
   - Bootstrap: Muted gray (#495057)
   - **Recommendation**: Use gray for structure, cyan for interaction

### 🎨 Proposed Color Mapping

#### Background Layers
```typescript
background: {
  base: "#0a0a0a",        // Darker than Bootstrap, maintain terminal look
  surface: "#1a1d20",     // Bootstrap's subtle bg (darker than #212529)
  raised: "#2b3035",      // Bootstrap's tertiary bg
  input: "#0f0f0f",       // Keep dark for contrast
  inputFocus: "#161719",  // Bootstrap's secondary subtle
}
```

#### Foreground Hierarchy
```typescript
foreground: {
  primary: "#f8f9fa",     // Bootstrap's light (vs current #E5E9F0)
  secondary: "#dee2e6",   // Bootstrap's body color (vs #D8DEE9)
  tertiary: "#adb5bd",    // Bootstrap's gray-500 (vs #88C0D0)
  disabled: "#6c757d",    // Bootstrap's gray-600 (vs #4C566A)
}
```
**Rationale**: Bootstrap's grays are warmer and more readable

#### Interactive Colors
```typescript
interactive: {
  primary: "#6ea8fe",     // Bootstrap's primary-text-emphasis (lighter blue)
  hover: "#8bb9fe",       // Bootstrap's link-hover
  active: "#084298",      // Bootstrap's primary-border-subtle (darker)
  focus: "#88C0D0",       // KEEP current cyan for consistency
}
```
**Rationale**: Bootstrap's blues are softer, but keep cyan focus for brand

#### Semantic (C4) Colors - KEEP CURRENT
```typescript
semantic: {
  person: "#88C0D0",      // Nord8 - cyan (KEEP)
  system: "#75b798",      // Bootstrap's success-text-emphasis (softer green)
  external: "#ffda6a",    // Bootstrap's warning-text-emphasis (brighter amber)
  container: "#6ea8fe",   // Bootstrap's primary-text-emphasis (blue)
  component: "#e685b5",   // Bootstrap's code-color (pink/purple)
  relationship: "#6c757d", // Bootstrap's gray (subtle)
}
```
**Rationale**: Use Bootstrap's semantic colors for softer look

#### Status Colors (Operational)
```typescript
status: {
  ready: "#75b798",       // Bootstrap's success (softer than Nord green)
  caution: "#ffda6a",     // Bootstrap's warning (brighter)
  critical: "#ea868f",    // Bootstrap's danger (softer red)
  selected: "#6ea8fe",    // Bootstrap's primary (blue vs cyan)
}
```

#### Border Colors
```typescript
border: {
  primary: "#495057",     // Bootstrap's gray-700 (vs bright #81A1C1)
  secondary: "#343a40",   // Bootstrap's gray-800 (subtle)
  focus: "#6ea8fe",       // Bootstrap's primary (vs cyan)
  person: "#88C0D0",      // KEEP cyan
  system: "#75b798",      // Bootstrap's success
  external: "#ffda6a",    // Bootstrap's warning
  container: "#6ea8fe",   // Bootstrap's primary
  component: "#e685b5",   // Bootstrap's code-color
}
```
**Rationale**: Structural borders softer, semantic borders match element colors

#### Grid Color
```typescript
grid: "#343a40",          // Bootstrap's gray-800 (vs #2a2a2a)
```
**Rationale**: Slightly warmer, better with gray borders

### 🌟 Glow Effects - ENHANCED
**Keep cyan glow brand identity** but make it more tactical:

```typescript
effect: {
  glow: {
    none: "none",
    sm: "0 0 8px rgba(110, 168, 254, 0.15)",   // Subtle blue
    base: "0 0 12px rgba(110, 168, 254, 0.2)", // Blue glow
    md: "0 0 16px rgba(110, 168, 254, 0.25)",
    lg: "0 0 20px rgba(110, 168, 254, 0.3)",
    xl: "0 0 24px rgba(136, 192, 208, 0.4)",   // Mix blue + cyan
  },
  textGlow: {
    none: "none",
    sm: "0 0 4px rgba(110, 168, 254, 0.3)",
    base: "0 0 6px rgba(136, 192, 208, 0.4)",  // Cyan for text
    md: "0 0 8px rgba(136, 192, 208, 0.5)",
  },
  iconGlow: "0 0 10px rgba(136, 192, 208, 0.6)", // Keep cyan
  dropShadow: "drop-shadow(0 0 4px rgba(110, 168, 254, 0.4))",
}
```

## Implementation Plan

### Phase 1: Foundation Colors ✅
1. Update background layers (darker + Bootstrap grays)
2. Update foreground hierarchy (Bootstrap grays)
3. Test contrast ratios (WCAG AAA)

### Phase 2: Interactive & Semantic
1. Update interactive colors (Bootstrap blues + cyan focus)
2. Update semantic C4 colors (Bootstrap palette)
3. Update status colors (softer operational states)

### Phase 3: Structure & Effects
1. Update border colors (gray structure, color accents)
2. Update grid color (warmer gray)
3. Refine glow effects (blue + cyan mix)

### Phase 4: Testing & Refinement
1. Visual test across all node types
2. Check contrast in all states (hover, focus, selected)
3. Verify readability in PropertiesPanel and Toolbar
4. Test edge label visibility

## Design Decisions Rationale

### ✅ Adopt from Bootstrap:
1. **Grayscale foundation**: Better readability, less eye strain
2. **Softer semantic colors**: Modern, less harsh than pure Nord
3. **Structural borders**: Gray for structure, color for meaning
4. **Warmer grays**: Better balance with dark backgrounds

### ❌ Reject from Bootstrap:
1. **Light gray backgrounds**: Too bright, lose terminal aesthetic
2. **Pure white emphasis**: Too harsh, #f8f9fa is better
3. **Rounded borders**: Keep sharp tactical edges
4. **Soft shadows**: Keep glow effects for brand identity

### 🔄 Hybrid Approach:
1. **Glow effects**: Mix Bootstrap blue with signature cyan
2. **Focus states**: Keep cyan for consistency
3. **Backgrounds**: Bootstrap structure + darker values
4. **Accents**: Bootstrap colors + Nord cyan for brand

## Expected Outcomes

### Visual Improvements:
- **More refined grayscale** → Better text hierarchy
- **Softer semantic colors** → Less visual fatigue
- **Better border contrast** → Clearer structure
- **Warmer overall tone** → More professional

### Brand Consistency:
- **Keep cyan signature** → Recognizable identity
- **Tactical aesthetic** → Sharp, focused interface
- **Terminal roots** → Dark, monospace, technical

### Accessibility:
- **Maintain WCAG AAA** → High contrast preserved
- **Better text readability** → Improved gray scale
- **Clear focus states** → Cyan remains prominent

## Migration Notes

### Breaking Changes:
- Border colors will be less bright (gray vs cyan)
- Semantic colors softer (may need testing for visibility)
- Background layers slightly different (test node overlays)

### Component Impact:
- **Node cards**: Softer borders, better text contrast
- **Toolbar**: Clearer button states with gray structure
- **PropertiesPanel**: Improved form contrast
- **Edges**: May need label color adjustment

### Rollback Plan:
- Current theme preserved in `themes/dark-nord.css.ts`
- Can switch via theme selector if issues arise
- Keep all glows as fallback

---

## Next Steps

1. ✅ Create this strategy document
2. ⏳ Implement Phase 1 (backgrounds + foregrounds)
3. ⏳ Test contrast and readability
4. ⏳ Implement Phase 2 (interactive + semantic)
5. ⏳ Test all component states
6. ⏳ Implement Phase 3 (structure + effects)
7. ⏳ Final visual polish and adjustments
8. ⏳ Update documentation

**Goal**: Refined, modern tactical aesthetic with better readability while preserving brand identity.
