import { style } from "@vanilla-extract/css";
import { componentsLayer } from "../../../styles/layers.css";
import { theme } from "../../../styles/theme.css";

export const headersContainer = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing["2"],
    },
  },
});

export const headerRow = style({
  "@layer": {
    [componentsLayer]: {
      display: "grid",
      gridTemplateColumns: "auto 1fr 2fr auto",
      alignItems: "center",
      gap: theme.spacing["2"],
    },
  },
});

export const headerCheckbox = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      width: "20px",
      height: "20px",

      // React Aria checkbox styling
      "::before": {
        display: "block",
        transition: theme.transition.base,
        clipPath: theme.clipPath.sm,
        border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
        backgroundColor: theme.color.background.input,
        width: "16px",
        height: "16px",
        content: "\"\"",
      },
      // '[data-selected]::before': {
      // 	backgroundColor: theme.color.interactive.primary,
      // 	borderColor: theme.color.interactive.primary,
      // },

      // ":hover::before": {
      // 	borderColor: theme.color.border.primary,
      // },
    },
  },
});

export const headerInput = style({
  "@layer": {
    [componentsLayer]: {
      transition: theme.transition.base,
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.input,
      padding: `0 ${theme.spacing["2"]}`,
      height: "32px",
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.sm,

      ":focus": {
        outline: "none",
        borderColor: theme.color.border.focus,
        boxShadow: theme.effect.glow.sm,
      },
    },
  },
});

export const headerDeleteButton = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: theme.transition.base,
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
      backgroundColor: "transparent",
      cursor: "pointer",
      width: "32px",
      height: "32px",
      color: theme.color.status.critical,

      ":hover": {
        borderColor: theme.color.status.critical,
        backgroundColor: theme.color.status.critical,
        color: theme.color.background.base,
      },
    },
  },
});

export const headerAddButton = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing["2"],
      transition: theme.transition.base,
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
      backgroundColor: "transparent",
      cursor: "pointer",
      padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
      width: "fit-content",
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.sm,

      ":hover": {
        boxShadow: theme.effect.glow.sm,
        backgroundColor: theme.color.background.surface,
      },
    },
  },
});
