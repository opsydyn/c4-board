import { style } from "@vanilla-extract/css";
import { componentsLayer } from "../../../styles/layers.css";
import { theme } from "../../../styles/theme.css";

export const tabBar = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      gap: theme.spacing["3"],
      marginBottom: theme.spacing["4"],
      borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
    },
  },
});

export const tab = style({
  "@layer": {
    [componentsLayer]: {
      position: "relative",
      transition: theme.transition.base,
      border: "none",
      background: "transparent",
      cursor: "pointer",
      padding: `${theme.spacing["3"]} ${theme.spacing["5"]}`,
      textTransform: "uppercase",
      letterSpacing: theme.typography.letterSpacing.wide,
      color: theme.color.foreground.secondary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.sm,

      ":hover": {
        backgroundColor: theme.color.background.surface,
        color: theme.color.foreground.primary,
      },

      ":focus": {
        outline: "none",
        color: theme.color.foreground.primary,
      },
    },
  },
});

export const tabActive = style({
  "@layer": {
    [componentsLayer]: {
      color: theme.color.foreground.primary,
      fontWeight: theme.typography.weight.medium,

      "::after": {
        position: "absolute",
        right: 0,
        bottom: "-1px",
        left: 0,
        boxShadow: theme.effect.glow.sm,
        backgroundColor: theme.color.interactive.primary,
        height: "2px",
        content: "\"\"",
      },
    },
  },
});
