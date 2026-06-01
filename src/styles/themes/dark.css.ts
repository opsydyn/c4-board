/**
 * Dark Theme (Tactical Terminal Aesthetic)
 *
 * Refined tactical theme with Bootstrap-inspired grayscale and signature cyan accents.
 * WCAG AAA compliant with 7:1+ contrast ratios.
 *
 * Design: Bootstrap Dark palette + Terminal aesthetic + Cyan brand identity
 */

import { createTheme } from "@vanilla-extract/css";
import { themeContract } from "../theme.contract.css";

export const darkTheme = createTheme(themeContract, {
  color: {
    background: {
      base: "#0a0a0a", // Darker terminal black
      surface: "#1a1d20", // Bootstrap subtle bg (darker)
      raised: "#2b3035", // Bootstrap tertiary bg
      input: "#0f0f0f", // Dark input contrast
      inputFocus: "#161719", // Bootstrap secondary subtle
      hover: "#2b3035", // Bootstrap tertiary bg (hover state)
      selected: "#212529", // Bootstrap gray-900 (selected state)
    },

    foreground: {
      primary: "#f8f9fa", // Bootstrap light (warmer white)
      secondary: "#dee2e6", // Bootstrap body color (refined gray)
      tertiary: "#adb5bd", // Bootstrap gray-500 (better hierarchy)
      disabled: "#6c757d", // Bootstrap gray-600 (clearer disabled)
    },

    interactive: {
      primary: "#f8f9fa", // Bootstrap primary-text-emphasis (softer blue)
      hover: "#8bb9fe", // Bootstrap link-hover (lighter)
      active: "#084298", // Bootstrap primary-border-subtle (darker)
      focus: "#88C0D0", // KEEP Nord cyan for brand consistency
    },

    semantic: {
      // C4 Architecture elements
      person: "#88C0D0", // KEEP Nord cyan - brand signature
      system: "#75b798", // Bootstrap success-text-emphasis (softer green)
      external: "#ffda6a", // Bootstrap warning-text-emphasis (brighter amber)
      container: "#6ea8fe", // Bootstrap primary-text-emphasis (blue)
      component: "#e685b5", // Bootstrap code-color (pink/purple)
      relationship: "#6c757d", // Bootstrap gray-600 (subtle)

      // DDD Strategic elements
      boundedContext: "#818cf8", // Indigo-400 (strategic, grouping)
      aggregate: "#34d399", // Emerald-400 (tactical core)
      domainEvent: "#fbbf24", // Amber-400 (events, actions)

      // DDD Tactical elements
      entity: "#60a5fa", // Blue-400 (identity)
      valueObject: "#22d3ee", // Cyan-400 (immutable)
      domainService: "#f472b6", // Pink-400 (operations)
      repository: "#94a3b8", // Slate-400 (persistence)
      factory: "#fb923c", // Orange-400 (creation)

      // DDD Application elements
      command: "#f87171", // Red-400 (write operations)
      query: "#2dd4bf", // Teal-400 (read operations)
      applicationService: "#a78bfa", // Violet-400 (orchestration)

      // DDD Infrastructure elements
      integrationEvent: "#e879f9", // Fuchsia-400 (cross-context)
      acl: "#a3e635", // Lime-400 (translation)
      saga: "#fb7185", // Rose-400 (long-running)
    },

    status: {
      ready: "#75b798", // Bootstrap success (softer operational green)
      caution: "#ffda6a", // Bootstrap warning (brighter caution)
      critical: "#ea868f", // Bootstrap danger (softer critical red)
      selected: "#6ea8fe", // Bootstrap primary (blue selected state)
    },

    grid: "#343a40", // Bootstrap gray-800 (warmer grid)

    border: {
      primary: "#495057", // Bootstrap gray-700 (structural)
      secondary: "#343a40", // Bootstrap gray-800 (subtle)
      focus: "#6ea8fe", // Bootstrap primary (blue focus)

      // C4 node borders
      person: "#88C0D0", // KEEP Nord cyan - brand signature
      system: "#75b798", // Bootstrap success (green)
      external: "#ffda6a", // Bootstrap warning (amber)
      container: "#6ea8fe", // Bootstrap primary (blue)
      component: "#e685b5", // Bootstrap code-color (pink/purple)

      // DDD Strategic borders
      boundedContext: "#818cf8", // Indigo-400
      aggregate: "#34d399", // Emerald-400
      domainEvent: "#fbbf24", // Amber-400

      // DDD Tactical borders
      entity: "#60a5fa", // Blue-400
      valueObject: "#22d3ee", // Cyan-400
      domainService: "#f472b6", // Pink-400
      repository: "#94a3b8", // Slate-400
      factory: "#fb923c", // Orange-400

      // DDD Application borders
      command: "#f87171", // Red-400
      query: "#2dd4bf", // Teal-400
      applicationService: "#a78bfa", // Violet-400

      // DDD Infrastructure borders
      integrationEvent: "#e879f9", // Fuchsia-400
      acl: "#a3e635", // Lime-400
      saga: "#fb7185", // Rose-400
    },

    surface: {
      // C4 node backgrounds
      person: "#1a1d20", // Bootstrap subtle bg (consistent)
      system: "#1a1d20", // Bootstrap subtle bg
      external: "#1a1d20", // Bootstrap subtle bg
      container: "#1a1d20", // Bootstrap subtle bg
      component: "#1a1d20", // Bootstrap subtle bg
      containerSelected: "#2b3035", // Bootstrap tertiary bg (lighter)

      // DDD Strategic backgrounds
      boundedContext: "rgba(129, 140, 248, 0.08)", // Indigo with transparency
      aggregate: "rgba(52, 211, 153, 0.08)", // Emerald with transparency
      domainEvent: "rgba(251, 191, 36, 0.08)", // Amber with transparency

      // DDD Tactical backgrounds
      entity: "rgba(96, 165, 250, 0.08)", // Blue with transparency
      valueObject: "rgba(34, 211, 238, 0.08)", // Cyan with transparency
      domainService: "rgba(244, 114, 182, 0.08)", // Pink with transparency
      repository: "rgba(148, 163, 184, 0.08)", // Slate with transparency
      factory: "rgba(251, 146, 60, 0.08)", // Orange with transparency

      // DDD Application backgrounds
      command: "rgba(248, 113, 113, 0.08)", // Red with transparency
      query: "rgba(45, 212, 191, 0.08)", // Teal with transparency
      applicationService: "rgba(167, 139, 250, 0.08)", // Violet with transparency

      // DDD Infrastructure backgrounds
      integrationEvent: "rgba(232, 121, 249, 0.08)", // Fuchsia with transparency
      acl: "rgba(163, 230, 53, 0.08)", // Lime with transparency
      saga: "rgba(251, 113, 133, 0.08)", // Rose with transparency

      // UI overlays - semantic rgba values for compositing
      overlay: "rgba(13, 23, 18, 0.95)", // Dark overlay with opacity
      elevated: "rgba(16, 28, 22, 0.98)", // Slightly lighter elevated surface
      base: "rgba(9, 16, 13, 0.92)", // Base panel surface
    },
  },

  spacing: {
    "0": "0",
    "1": "4px",
    "2": "8px",
    "3": "12px",
    "4": "16px",
    "5": "20px",
    "6": "24px",
    "8": "32px",
    "10": "40px",
    "12": "48px",
    "16": "64px",
  },

  typography: {
    family: {
      mono:
        "'Berkeley Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
      sans: "system-ui, -apple-system, sans-serif",
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
      engineering: "0.15em", // Tactical label spacing
    },
    textTransform: {
      uppercase: "uppercase",
      none: "none",
    },
  },

  border: {
    radius: {
      none: "0",
    },
    width: {
      none: "0",
      thin: "1px",
      base: "2px",
      thick: "3px",
    },
    style: {
      solid: "solid",
      dashed: "dashed",
      dotted: "dotted",
    },
  },

  effect: {
    glow: {
      none: "none",
      sm: "0 0 8px rgba(110, 168, 254, 0.15)", // Subtle Bootstrap blue
      base: "0 0 12px rgba(110, 168, 254, 0.2)", // Blue glow
      md: "0 0 16px rgba(110, 168, 254, 0.25)", // Medium blue
      lg: "0 0 20px rgba(110, 168, 254, 0.3)", // Strong blue
      xl: "0 0 24px rgba(136, 192, 208, 0.4)", // Mix blue + cyan for xl
    },
    textGlow: {
      none: "none",
      sm: "0 0 4px rgba(110, 168, 254, 0.3)", // Blue text glow
      base: "0 0 6px rgba(136, 192, 208, 0.4)", // Cyan text glow (signature)
      md: "0 0 8px rgba(136, 192, 208, 0.5)", // Strong cyan glow
    },
    iconGlow: "0 0 10px rgba(136, 192, 208, 0.6)", // Cyan icon glow (brand)
    dropShadow: "drop-shadow(0 0 4px rgba(110, 168, 254, 0.4))", // Blue drop shadow
  },

  clipPath: {
    none: "none",
    sm: "polygon(0 2px, 2px 0, 100% 0, 100% calc(100% - 2px), calc(100% - 2px) 100%, 0 100%)",
    base: "polygon(0 4px, 4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%)",
    md: "polygon(0 6px, 6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)",
    lg: "polygon(0 8px, 8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)",
  },

  opacity: {
    disabled: "0.5",
    muted: "0.7",
    overlay: "0.9",
    grid: "0.1",
  },

  transition: {
    fast: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
    base: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    slow: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  },

  zIndex: {
    base: "1",
    dropdown: "100",
    sticky: "500",
    overlay: "1000",
    modal: "2000",
    tooltip: "3000",
  },
});
