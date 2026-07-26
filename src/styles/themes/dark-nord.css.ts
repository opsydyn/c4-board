/**
 * Dark Theme (Terminal Aesthetic)
 *
 * Implements the theme contract with retro terminal colors.
 * WCAG AAA compliant with 7:1+ contrast ratios.
 */

import { createTheme } from "@vanilla-extract/css";
import { themeContract } from "../theme.contract.css";

export const darkTheme = createTheme(themeContract, {
  color: {
    background: {
      base: "#111111", // Console black
      surface: "#0f0f0f", // Panel black
      raised: "#1a1a1a", // Elevated elements
      input: "#0a0a0a", // Input backgrounds
      inputFocus: "#0f0f0f", // Focused input
      hover: "#1a1a1a", // Hover state
      selected: "#212529", // Selected state
    },

    foreground: {
      primary: "#E5E9F0", // Nord6 - Snow Storm (bright white)
      secondary: "#D8DEE9", // Nord5 - light gray
      tertiary: "#88C0D0", // Nord8 - muted cyan
      disabled: "#4C566A", // Nord3 - dark gray
    },

    interactive: {
      primary: "#81A1C1", // Nord9 - tactical blue
      hover: "#88C0D0", // Nord8 - lighter blue
      active: "#5E81AC", // Nord10 - darker blue
      focus: "#88C0D0", // Nord8 - cyan focus
    },

    semantic: {
      // C4 Architecture elements
      person: "#88C0D0", // Nord8 - cyan for people
      system: "#A3BE8C", // Nord14 - tactical green for systems
      external: "#D08770", // Nord12 - amber for external
      container: "#81A1C1", // Nord9 - blue for containers
      component: "#B48EAD", // Nord15 - purple for components
      relationship: "#4C566A", // Nord3 - dim gray for connections

      // DDD Strategic elements
      boundedContext: "#818cf8", // Indigo-400
      aggregate: "#34d399", // Emerald-400
      domainEvent: "#fbbf24", // Amber-400

      // DDD Tactical elements
      entity: "#60a5fa", // Blue-400
      valueObject: "#22d3ee", // Cyan-400
      domainService: "#f472b6", // Pink-400
      repository: "#94a3b8", // Slate-400
      factory: "#fb923c", // Orange-400

      // DDD Application elements
      command: "#f87171", // Red-400
      query: "#2dd4bf", // Teal-400
      applicationService: "#a78bfa", // Violet-400

      // DDD Infrastructure elements
      integrationEvent: "#e879f9", // Fuchsia-400
      acl: "#a3e635", // Lime-400
      saga: "#fb7185", // Rose-400
      esEvent: "#fb923c", // Orange-400 — the backbone
      esHotspot: "#f43f5e", // Rose-500 — disagreement, risk
      esActor: "#fde68a", // Amber-200 — pale yellow, as on a wall
      esExternalSystem: "#f9a8d4", // Pink-300
      esOpportunity: "#a3e635", // Lime-400
      esBoard: "#a78bfa", // Violet-400
    },

    status: {
      ready: "#A3BE8C", // Nord14 - green (operational)
      caution: "#D08770", // Nord12 - amber (warning)
      critical: "#BF616A", // Nord11 - red (error)
      selected: "#81A1C1", // Nord9 - cyan (focus)
    },

    grid: "#2a2a2a", // Grid line color

    border: {
      primary: "#81A1C1", // Nord9 - tactical blue borders
      secondary: "#4C566A", // Nord3 - subtle gray
      focus: "#88C0D0", // Nord8 - cyan focus

      // C4 node borders
      person: "#88C0D0", // Nord8 - cyan
      system: "#A3BE8C", // Nord14 - green
      external: "#D08770", // Nord12 - amber
      container: "#81A1C1", // Nord9 - blue
      component: "#B48EAD", // Nord15 - purple

      // DDD Strategic borders
      boundedContext: "#818cf8",
      aggregate: "#34d399",
      domainEvent: "#fbbf24",

      // DDD Tactical borders
      entity: "#60a5fa",
      valueObject: "#22d3ee",
      domainService: "#f472b6",
      repository: "#94a3b8",
      factory: "#fb923c",

      // DDD Application borders
      command: "#f87171",
      query: "#2dd4bf",
      applicationService: "#a78bfa",

      // DDD Infrastructure borders
      integrationEvent: "#e879f9",
      acl: "#a3e635",
      saga: "#fb7185",
    },

    surface: {
      // C4 node backgrounds
      person: "#2E3440", // Nord0 - dark tint
      system: "#2E3440", // Nord0 - dark tint
      external: "#2E3440", // Nord0 - dark tint
      container: "#2E3440", // Nord0 - dark tint
      component: "#2E3440", // Nord0 - dark tint
      containerSelected: "#3B4252", // Nord1 - slightly lighter

      // DDD Strategic backgrounds
      boundedContext: "rgba(129, 140, 248, 0.08)",
      aggregate: "rgba(52, 211, 153, 0.08)",
      domainEvent: "rgba(251, 191, 36, 0.08)",

      // DDD Tactical backgrounds
      entity: "rgba(96, 165, 250, 0.08)",
      valueObject: "rgba(34, 211, 238, 0.08)",
      domainService: "rgba(244, 114, 182, 0.08)",
      repository: "rgba(148, 163, 184, 0.08)",
      factory: "rgba(251, 146, 60, 0.08)",

      // DDD Application backgrounds
      command: "rgba(248, 113, 113, 0.08)",
      query: "rgba(45, 212, 191, 0.08)",
      applicationService: "rgba(167, 139, 250, 0.08)",

      // DDD Infrastructure backgrounds
      integrationEvent: "rgba(232, 121, 249, 0.08)",
      acl: "rgba(163, 230, 53, 0.08)",
      saga: "rgba(251, 113, 133, 0.08)",

      // UI overlays - semantic rgba values for compositing
      overlay: "rgba(46, 52, 64, 0.95)", // Nord0 with opacity
      elevated: "rgba(59, 66, 82, 0.98)", // Nord1 with opacity
      base: "rgba(36, 41, 51, 0.92)", // Darker base surface
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
