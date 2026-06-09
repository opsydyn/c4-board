/**
 * OVLLegend Styles - OPSYDYN Visual Language component
 *
 * Matches the aesthetic of BalancedMudChart with terminal-inspired design
 * Uses @vanilla-extract/css-utils for dynamic, constraint-based calculations
 */

import { style } from "@vanilla-extract/css";
import { calc } from "@vanilla-extract/css-utils";
import { componentsLayer } from "../../styles/layers.css";
import { theme } from "../../styles/theme.css";

export const ovlLegendCard = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing["4"],
      clipPath: theme.clipPath.base,
      border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
      backgroundColor: theme.color.background.surface,
      padding: theme.spacing["4"],
      fontFamily: theme.typography.family.mono,
    },
  },
});

export const ovlLegendHeader = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: theme.spacing["3"],
      borderBottom: `1px solid ${theme.color.border.secondary}`,
      paddingBottom: theme.spacing["3"],
    },
  },
});

export const ovlLegendHeaderText = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flex: 1,
      flexDirection: "column",
      gap: theme.spacing["1"],
    },
  },
});

export const ovlLegendToggleButton = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing["1"],
      transition: `all ${theme.transition.base}`,
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.raised,
      cursor: "pointer",
      padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
      textTransform: theme.typography.textTransform.uppercase,
      letterSpacing: theme.typography.letterSpacing.wide,
      color: theme.color.foreground.secondary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,

      ":hover": {
        borderColor: theme.color.interactive.primary,
        boxShadow: theme.effect.glow.sm,
        backgroundColor: theme.color.background.surface,
        color: theme.color.interactive.primary,
      },
    },
  },
});

export const ovlLegendTitle = style({
  "@layer": {
    [componentsLayer]: {
      margin: 0,
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      color: theme.color.foreground.primary,
      fontSize: theme.typography.size.md,
      fontWeight: 700,
    },
  },
});

export const ovlLegendSubtitle = style({
  "@layer": {
    [componentsLayer]: {
      margin: 0,
      lineHeight: 1.4,
      color: theme.color.foreground.tertiary,
      fontSize: theme.typography.size.xs,
    },
  },
});

export const ovlLegendCanvas = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing["6"],
    },
  },
});

export const ovlLegendSection = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing["3"],
    },
  },
});

export const ovlLegendSectionTitle = style({
  "@layer": {
    [componentsLayer]: {
      position: "relative",
      transition: `all ${theme.transition.base}`,
      margin: 0,
      borderLeft: `${calc.multiply(theme.border.width.base, 1.5)} solid ${theme.color.interactive.primary}`,
      paddingLeft: theme.spacing["2"],
      textTransform: "uppercase",
      letterSpacing: "0.3px",
      color: theme.color.foreground.secondary,
      fontSize: theme.typography.size.sm,
      fontWeight: 600,

      ":hover": {
        color: theme.color.foreground.primary,
      },
    },
  },
});

export const ovlLegendGrid = style({
  "@layer": {
    [componentsLayer]: {
      display: "grid",
      // Dynamic grid with calc-based minimum column width
      gridTemplateColumns: `repeat(auto-fit, minmax(${calc.multiply(theme.spacing["16"], 3)}, 1fr))`,
      gap: theme.spacing["3"],
      // Smooth layout shifts
      transition: `gap ${theme.transition.base}`,
    },
  },
});

export const ovlLegendItem = style({
  "@layer": {
    [componentsLayer]: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing["1"],
      transition: `all ${theme.transition.base}`,
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.base,
      padding: theme.spacing["2"],
      overflow: "hidden",

      // Subtle lift effect on hover using calc
      ":hover": {
        transform: `translateY(${calc.negate(theme.spacing["1"])})`,
        borderColor: theme.color.interactive.primary,
        boxShadow: theme.effect.glow.sm,
        backgroundColor: theme.color.background.surface,
      },
    },
  },
});

export const ovlLegendLabel = style({
  "@layer": {
    [componentsLayer]: {
      color: theme.color.foreground.tertiary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
    },
  },
});

export const ovlLegendBadge = style({
  "@layer": {
    [componentsLayer]: {
      position: "relative",
      display: "inline-block",
      transition: `all ${theme.transition.base}`,
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.raised,
      // Calc-based padding for precise vertical rhythm
      padding: `${calc.divide(theme.spacing["2"], 2)} ${theme.spacing["2"]}`,
      color: theme.color.foreground.secondary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,

      ":hover": {
        transform: "scale(1.02)",
        borderColor: theme.color.interactive.primary,
        // Subtle scale using calc
        boxShadow: theme.effect.glow.sm,
        color: theme.color.foreground.primary,
      },
    },
  },
});

export const ovlLegendRow = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexWrap: "wrap",
      gap: theme.spacing["2"],
    },
  },
});

export const ovlLegendGroup = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      alignItems: "center",
      // Dynamic gap using calc for responsive spacing
      gap: calc.add(theme.spacing["2"], theme.spacing["1"]),
      transition: `all ${theme.transition.base}`,
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.base,
      padding: theme.spacing["2"],

      ":hover": {
        gap: calc.multiply(theme.spacing["2"], 2),
        borderColor: theme.color.interactive.primary,
        // Subtle expand on hover
        backgroundColor: theme.color.background.surface,
      },
    },
  },
});

export const ovlLegendCompact = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing["3"],
      padding: theme.spacing["2"],
    },
  },
});

export const ovlLegendCompactRow = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: theme.spacing["3"],
    },
  },
});

export const ovlLegendCompactLabel = style({
  "@layer": {
    [componentsLayer]: {
      minWidth: "80px",
      textTransform: theme.typography.textTransform.uppercase,
      letterSpacing: theme.typography.letterSpacing.wide,
      color: theme.color.foreground.tertiary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
    },
  },
});
