/**
 * SearchBox Styles
 */

import { style } from "@vanilla-extract/css";
import { componentsLayer } from "../../styles/layers.css";
import { theme } from "../../styles/theme.css";

export const searchContainer = style({
  "@layer": {
    [componentsLayer]: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      minWidth: "280px",
    },
  },
});

export const searchInputWrapper = style({
  "@layer": {
    [componentsLayer]: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      width: "100%",
    },
  },
});

export const searchIcon = style({
  "@layer": {
    [componentsLayer]: {
      position: "absolute",
      left: theme.spacing["3"],
      display: "flex",
      alignItems: "center",
      pointerEvents: "none",
      color: theme.color.foreground.tertiary,
    },
  },
});

export const searchInput = style({
  "@layer": {
    [componentsLayer]: {
      transition: theme.transition.base,
      clipPath: theme.clipPath.sm,
      outline: "none",
      border: `${theme.border.width.base} solid ${theme.color.semantic.person}`, // ANGULAR - no rounding
      borderRadius: theme.border.radius.none, // Angled corners
      backgroundColor: theme.color.background.input,
      padding: `${theme.spacing["2"]} ${theme.spacing["3"]} ${theme.spacing["2"]} ${theme.spacing["10"]}`,
      width: "100%",
      textTransform: theme.typography.textTransform.uppercase,
      letterSpacing: theme.typography.letterSpacing.engineering, // MONOSPACE ONLY
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono, // UPPERCASE
      fontSize: theme.typography.size.sm, // TACTICAL SPACING

      "::placeholder": {
        textTransform: theme.typography.textTransform.uppercase,
        color: theme.color.foreground.tertiary,
      },

      ":focus": {
        borderColor: theme.color.status.ready,
        boxShadow: `0 0 12px ${theme.color.status.ready}66`, // Tactical glow
        backgroundColor: theme.color.background.inputFocus,
      },
    },
  },
});

export const resultsDropdown = style({
  "@layer": {
    [componentsLayer]: {
      position: "absolute",
      zIndex: theme.zIndex.overlay,
      top: "calc(100% + 4px)",
      right: 0,
      left: 0,
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.base} solid ${theme.color.status.ready}`, // ANGULAR
      borderRadius: theme.border.radius.none, // Angled corners
      boxShadow: `0 0 20px ${theme.color.status.ready}33`, // Tactical glow
      backgroundColor: theme.color.background.surface,
      maxHeight: "400px",
      overflowY: "auto",
    },
  },
});

export const resultItem = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      alignItems: "flex-start",
      gap: theme.spacing["3"],
      transition: theme.transition.fast,
      borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
      cursor: "pointer",
      padding: theme.spacing["3"],

      ":last-child": {
        borderBottom: "none",
      },

      ":hover": {
        backgroundColor: theme.color.background.raised,
      },
    },
  },
});

export const resultBadge = style({
  "@layer": {
    [componentsLayer]: {
      flexShrink: 0,
      clipPath: theme.clipPath.sm, // ANGULAR
      borderRadius: theme.border.radius.none, // Angled corners
      padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
      textTransform: theme.typography.textTransform.uppercase,
      letterSpacing: theme.typography.letterSpacing.engineering, // ENGINEERING SPACING
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
      fontWeight: theme.typography.weight.medium, // MONOSPACE
    },
  },
});

export const resultContent = style({
  "@layer": {
    [componentsLayer]: {
      flex: 1,
      minWidth: 0,
    },
  },
});

export const resultLabel = style({
  "@layer": {
    [componentsLayer]: {
      marginBottom: theme.spacing["1"],
      overflow: "hidden",
      textTransform: theme.typography.textTransform.uppercase,
      textOverflow: "ellipsis",
      letterSpacing: theme.typography.letterSpacing.wide,
      whiteSpace: "nowrap",
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono, // MONOSPACE
      fontSize: theme.typography.size.sm, // UPPERCASE
      fontWeight: theme.typography.weight.semibold, // TACTICAL
    },
  },
});

export const resultDescription = style({
  "@layer": {
    [componentsLayer]: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      color: theme.color.foreground.secondary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs, // MONOSPACE
    },
  },
});

export const emptyState = style({
  "@layer": {
    [componentsLayer]: {
      padding: theme.spacing["6"],
      textAlign: "center",
      color: theme.color.foreground.tertiary,
      fontSize: theme.typography.size.sm,
    },
  },
});

export const kbd = style({
  "@layer": {
    [componentsLayer]: {
      display: "inline-block",
      clipPath: theme.clipPath.sm,
      marginLeft: theme.spacing["2"],
      border: `${theme.border.width.thin} solid ${theme.color.status.ready}`, // ANGULAR
      borderRadius: theme.border.radius.none, // Angled corners
      backgroundColor: theme.color.background.raised,
      padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
      textTransform: theme.typography.textTransform.uppercase,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
    },
  },
});
