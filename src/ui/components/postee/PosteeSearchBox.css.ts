/**
 * PosteeSearchBox Styles - Postman-style search with tactical aesthetics
 */

import { style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";

export const searchContainer = style({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  marginBottom: theme.spacing["3"],
});

export const searchInputWrapper = style({
  position: "relative",
  display: "flex",
  alignItems: "center",
  width: "100%",
});

export const searchIcon = style({
  position: "absolute",
  zIndex: 1,
  left: theme.spacing["3"],
  display: "flex",
  alignItems: "center",
  pointerEvents: "none",
  color: theme.color.foreground.tertiary,
});

export const searchInput = style({
  transition: theme.transition.base,
  clipPath: theme.clipPath.sm,
  outline: "none",
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: theme.color.background.input,
  padding: `${theme.spacing["2"]} ${theme.spacing["3"]} ${theme.spacing["2"]} ${theme.spacing["10"]}`,
  width: "100%",
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,

  selectors: {
    "&::placeholder": {
      textTransform: theme.typography.textTransform.uppercase,
      color: theme.color.foreground.tertiary,
    },

    "&:focus": {
      borderColor: theme.color.border.focus,
      boxShadow: theme.effect.glow.sm,
      backgroundColor: theme.color.background.inputFocus,
    },
  },
});

export const resultsDropdown = style({
  position: "absolute",
  zIndex: 1000,
  top: "calc(100% + 4px)",
  right: 0,
  left: 0,
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
  boxShadow: theme.effect.glow.base,
  backgroundColor: theme.color.background.surface,
  maxHeight: "400px",
  overflowY: "auto",
});

export const resultItem = style({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing["3"],
  transition: theme.transition.fast,
  borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  cursor: "pointer",
  padding: theme.spacing["3"],

  selectors: {
    "&:last-child": {
      borderBottom: "none",
    },

    "&:hover": {
      backgroundColor: "rgba(18, 28, 24, 0.7)",
    },
  },
});

export const resultBadge = style({
  flexShrink: 0,
  clipPath: theme.clipPath.sm,
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
  fontWeight: theme.typography.weight.bold,
});

export const resultContent = style({
  flex: 1,
  minWidth: 0,
});

export const resultLabel = style({
  marginBottom: theme.spacing["1"],
  overflow: "hidden",
  textTransform: theme.typography.textTransform.uppercase,
  textOverflow: "ellipsis",
  letterSpacing: theme.typography.letterSpacing.wide,
  whiteSpace: "nowrap",
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
  fontWeight: theme.typography.weight.semibold,
});

export const resultDescription = style({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const emptyState = style({
  padding: theme.spacing["6"],
  textAlign: "center",
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
});
