import { style } from "@vanilla-extract/css";
import { componentsLayer } from "../../styles/layers.css";
import { theme } from "../../styles/theme.css";

export const searchInputContainer = style({
  "@layer": {
    [componentsLayer]: {
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
      width: "100%",
    },
  },
});

export const searchIcon = style({
  "@layer": {
    [componentsLayer]: {
      position: "absolute",
      left: theme.spacing["3"],
      pointerEvents: "none",
      color: theme.color.foreground.secondary,
      fontSize: theme.typography.size.sm,
    },
  },
});

export const searchInputField = style({
  "@layer": {
    [componentsLayer]: {
      transition: "all 0.2s ease",
      clipPath: theme.clipPath.base,
      outline: "none",
      border: `1px solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.input,
      padding: `${theme.spacing["2"]} ${theme.spacing["10"]} ${theme.spacing["2"]} ${theme.spacing["8"]}`,
      width: "100%",
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.sans,
      fontSize: theme.typography.size.sm,

      "::placeholder": {
        color: theme.color.foreground.tertiary,
      },

      ":focus": {
        borderColor: theme.color.interactive.primary,
        backgroundColor: theme.color.background.surface,
      },
    },
  },
});

export const clearButton = style({
  "@layer": {
    [componentsLayer]: {
      position: "absolute",
      right: theme.spacing["2"],
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      transition: "all 0.2s ease",
      clipPath: theme.clipPath.sm,
      border: "none",
      backgroundColor: "transparent",
      cursor: "pointer",
      padding: 0,
      width: "24px",
      height: "24px",
      color: theme.color.foreground.secondary,
      fontSize: theme.typography.size.sm,

      ":hover": {
        backgroundColor: theme.color.background.inputFocus,
        color: theme.color.foreground.primary,
      },
    },
  },
});
