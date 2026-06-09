import { style } from "@vanilla-extract/css";
import { componentsLayer } from "../../../styles/layers.css";
import { theme } from "../../../styles/theme.css";

export const responseViewerContainer = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing["3"],
      clipPath: theme.clipPath.base,
      border: `1px solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.surface,
      padding: theme.spacing["4"],
    },
  },
});

export const responseViewerHeader = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexWrap: "wrap",
      gap: theme.spacing["4"],
      borderBottom: `1px solid ${theme.color.border.secondary}`,
      paddingBottom: theme.spacing["3"],
      color: theme.color.foreground.secondary,
      fontSize: theme.typography.size.sm,
    },
  },
});

export const responseViewerContent = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing["2"],
    },
  },
});

export const toggleButton = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing["2"],
      transition: "color 0.2s ease",
      border: "none",
      backgroundColor: "transparent",
      cursor: "pointer",
      padding: `${theme.spacing["2"]} 0`,
      textAlign: "left",
      color: theme.color.foreground.primary,
      fontSize: theme.typography.size.sm,

      ":hover": {
        color: theme.color.interactive.primary,
      },
    },
  },
});

export const baselineButton = style({
  "@layer": {
    [componentsLayer]: {
      transition: theme.transition.fast,
      clipPath: theme.clipPath.sm,
      border: "1px solid #88C0D0",
      background: "transparent",
      cursor: "pointer",
      padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
      textTransform: theme.typography.textTransform.uppercase,
      color: "#88C0D0",
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,

      ":hover": {
        boxShadow: theme.effect.glow.sm,
        backgroundColor: "rgba(136, 192, 208, 0.1)",
      },
    },
  },
});

export const baselineButtonActive = style({
  "@layer": {
    [componentsLayer]: {
      transition: theme.transition.fast,
      clipPath: theme.clipPath.sm,
      border: "1px solid #88C0D0",
      background: "#88C0D0",
      cursor: "pointer",
      padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
      textTransform: theme.typography.textTransform.uppercase,
      color: "#0a0a0a",
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,

      ":hover": {
        boxShadow: theme.effect.glow.sm,
        backgroundColor: "#9fd8e8",
      },
    },
  },
});

export const clearButton = style({
  "@layer": {
    [componentsLayer]: {
      transition: theme.transition.fast,
      clipPath: theme.clipPath.sm,
      border: `1px solid ${theme.color.status.critical}`,
      background: "transparent",
      cursor: "pointer",
      padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
      textTransform: theme.typography.textTransform.uppercase,
      color: theme.color.status.critical,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,

      ":hover": {
        boxShadow: theme.effect.glow.sm,
        backgroundColor: "rgba(255, 107, 107, 0.1)",
      },
    },
  },
});
