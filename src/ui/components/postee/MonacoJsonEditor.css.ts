import { globalStyle, style } from "@vanilla-extract/css";
import { componentsLayer } from "../../../styles/layers.css";
import { theme } from "../../../styles/theme.css";

export const monacoEditorContainer = style({
  "@layer": {
    [componentsLayer]: {
      position: "relative",
      width: "100%",
    },
  },
});

export const monacoEditorWrapper = style({
  "@layer": {
    [componentsLayer]: {
      clipPath: theme.clipPath.base,
      border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.surface,
      overflow: "hidden",

      // Monaco editor specific overrides
      ":focus-within": {
        borderColor: theme.color.border.focus,
        boxShadow: theme.effect.glow.sm,
      },
    },
  },
});

export const actionBar = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexWrap: "wrap",
      gap: theme.spacing["3"],
      marginBottom: theme.spacing["4"],
    },
  },
});

export const actionButton = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing["3"],
      transition: theme.transition.base,
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.thin} ${theme.border.style.solid} ${theme.color.semantic.person}`,
      backgroundColor: "transparent",
      cursor: "pointer",
      padding: `${theme.spacing["4"]} ${theme.spacing["6"]}`,
      textTransform: theme.typography.textTransform.uppercase,
      letterSpacing: theme.typography.letterSpacing.wide,
      color: theme.color.semantic.person,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.weight.medium,
      ":hover": {
        boxShadow: theme.effect.glow.sm,
        backgroundColor: theme.color.semantic.person,
        color: theme.color.background.base,
      },
      ":active": {
        transform: "translateY(1px)",
      },
    },
  },
});

// Monaco editor decorations for {{variables}}
globalStyle(".postee-variable-decoration", {
  border: "1px solid rgba(165, 214, 167, 0.3)",
  borderRadius: "3px",
  backgroundColor: "rgba(165, 214, 167, 0.15)",
  padding: "0 2px",
});

globalStyle(".postee-variable-icon::before", {
  opacity: 0.7,
  marginRight: "2px",
  color: "#A5D6A7",
  fontWeight: "bold",
  content: "\"$\"",
});
