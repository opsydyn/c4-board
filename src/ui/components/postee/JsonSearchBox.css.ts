import { globalStyle, style } from "@vanilla-extract/css";
import { componentsLayer } from "../../../styles/layers.css";
import { theme } from "../../../styles/theme.css";

export const searchContainer = style({
  "@layer": {
    [componentsLayer]: {
      position: "relative",
      marginBottom: theme.spacing["2"],
      width: "100%",
    },
  },
});

export const searchInputWrapper = style({
  "@layer": {
    [componentsLayer]: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      gap: theme.spacing["2"],
      transition: theme.transition.base,
      clipPath: theme.clipPath.base,
      border: `${theme.border.width.thin} ${theme.border.style.solid} ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.surface,
      padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
      ":focus-within": {
        borderColor: theme.color.semantic.person,
        boxShadow: theme.effect.glow.sm,
      },
    },
  },
});

export const searchIcon = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      alignItems: "center",
      color: theme.color.foreground.secondary,
    },
  },
});

export const searchInput = style({
  "@layer": {
    [componentsLayer]: {
      flex: 1,
      outline: "none",
      border: theme.border.width.none,
      backgroundColor: "transparent",
      textTransform: theme.typography.textTransform.uppercase,
      letterSpacing: theme.typography.letterSpacing.wide,
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.sm,
      "::placeholder": {
        color: theme.color.foreground.tertiary,
      },
    },
  },
});

export const resultsDropdown = style({
  "@layer": {
    [componentsLayer]: {
      position: "absolute",
      zIndex: theme.zIndex.dropdown,
      top: `calc(100% + ${theme.spacing["1"]})`,
      right: 0,
      left: 0,
      clipPath: theme.clipPath.base,
      border: `${theme.border.width.thin} ${theme.border.style.solid} ${theme.color.semantic.person}`,
      boxShadow: theme.effect.glow.md,
      backgroundColor: theme.color.surface.overlay,
      maxHeight: "300px",
      overflowY: "auto",
    },
  },
});

export const resultItem = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      alignItems: "flex-start",
      gap: theme.spacing["2"],
      transition: theme.transition.base,
      borderBottom: `${theme.border.width.thin} ${theme.border.style.solid} ${theme.color.border.secondary}`,
      cursor: "pointer",
      padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
      ":hover": {
        backgroundColor: theme.color.surface.elevated,
      },
      ":last-child": {
        borderWidth: theme.border.width.none,
      },
    },
  },
});

export const lineNumber = style({
  "@layer": {
    [componentsLayer]: {
      display: "inline-block",
      flexShrink: 0,
      clipPath: theme.clipPath.sm,
      backgroundColor: theme.color.semantic.person,
      padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
      minWidth: "40px",
      textAlign: "center",
      color: theme.color.background.base,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
      fontWeight: theme.typography.weight.bold,
    },
  },
});

export const resultContent = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flex: 1,
      flexDirection: "column",
      gap: theme.spacing["1"],
      minWidth: 0,
    },
  },
});

export const resultText = style({
  "@layer": {
    [componentsLayer]: {
      lineHeight: theme.typography.lineHeight.normal,
      whiteSpace: "pre-wrap",
      wordBreak: "break-all",
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.sm,
    },
  },
});

globalStyle(`${resultText} mark`, {
  clipPath: theme.clipPath.sm,
  backgroundColor: theme.color.semantic.person,
  padding: `${theme.spacing["0"]} ${theme.spacing["1"]}`,
  color: theme.color.background.base,
  fontWeight: theme.typography.weight.bold,
});

export const emptyState = style({
  "@layer": {
    [componentsLayer]: {
      padding: `${theme.spacing["4"]} ${theme.spacing["3"]}`,
      textAlign: "center",
      letterSpacing: theme.typography.letterSpacing.wider,
      color: theme.color.foreground.tertiary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.sm,
    },
  },
});

export const kbd = style({
  "@layer": {
    [componentsLayer]: {
      display: "inline-block",
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.thin} ${theme.border.style.solid} ${theme.color.border.primary}`,
      backgroundColor: theme.color.surface.elevated,
      padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
      lineHeight: theme.typography.lineHeight.tight,
      color: theme.color.foreground.secondary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
    },
  },
});
