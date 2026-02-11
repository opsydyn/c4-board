import { style } from "@vanilla-extract/css";
import { componentsLayer } from "../../styles/layers.css";
import { theme } from "../../styles/theme.css";
import { toolbarButton } from "./styles.css";

export const edgeEditorOverlay = style({
  "@layer": {
    [componentsLayer]: {
      boxSizing: "border-box",
      position: "fixed",
      zIndex: 1000,
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      padding: theme.spacing["6"],
    },
  },
});

export const edgeEditorDialog = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      clipPath: theme.clipPath.lg,
      border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
      boxShadow: theme.effect.glow.lg,
      backgroundColor: theme.color.background.base,
      width: "min(680px, 100%)",
      maxHeight: "calc(100vh - 3rem)",
      overflow: "hidden",
    },
  },
});

export const edgeEditorContent = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing["5"],
      padding: theme.spacing["6"],
      overflowY: "auto",
    },
  },
});

export const edgeEditorTitle = style({
  "@layer": {
    [componentsLayer]: {
      margin: 0,
      textTransform: theme.typography.textTransform.uppercase,
      letterSpacing: theme.typography.letterSpacing.wide,
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.lg,
    },
  },
});

export const edgeEditorField = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing["2"],
    },
  },
});

export const edgeEditorLabel = style({
  "@layer": {
    [componentsLayer]: {
      textTransform: theme.typography.textTransform.uppercase,
      letterSpacing: theme.typography.letterSpacing.wide,
      color: theme.color.foreground.secondary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
    },
  },
});

export const edgeEditorInput = style({
  "@layer": {
    [componentsLayer]: {
      transition: theme.transition.base,
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.input,
      padding: `0 ${theme.spacing["3"]}`,
      width: "100%",
      height: "40px",
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.sans,
      fontSize: theme.typography.size.base,

      selectors: {
        "&:focus": {
          outline: "none",
          borderColor: theme.color.border.primary,
          boxShadow: theme.effect.glow.sm,
        },
      },
    },
  },
});

export const edgeEditorHint = style({
  "@layer": {
    [componentsLayer]: {
      color: theme.color.foreground.tertiary,
      fontSize: theme.typography.size.sm,
      fontStyle: "italic",
    },
  },
});

export const edgeEditorError = style({
  "@layer": {
    [componentsLayer]: {
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.thin} solid ${theme.color.status.critical}`,
      backgroundColor: "rgba(220, 38, 38, 0.1)",
      padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
      color: theme.color.status.critical,
      fontSize: theme.typography.size.sm,
    },
  },
});

export const edgeEditorButtons = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      justifyContent: "flex-end",
      gap: theme.spacing["2"],
      marginTop: theme.spacing["4"],
      borderTop: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
      paddingTop: theme.spacing["3"],
    },
  },
});

export const edgeEditorButton = style([
  toolbarButton,
  {
    "@layer": {
      [componentsLayer]: {
        justifyContent: "center",
        minWidth: "6.75rem",
      },
    },
  },
]);

export const edgeEditorPrimaryButton = style([
  edgeEditorButton,
  {
    "@layer": {
      [componentsLayer]: {
        borderColor: theme.color.interactive.primary,
        boxShadow: `inset 0 0 0 1px ${theme.color.interactive.primary}55`,
        backgroundColor: "rgba(13, 23, 18, 0.95)",
        color: theme.color.interactive.primary,

        selectors: {
          "&:disabled": {
            opacity: theme.opacity.disabled,
            borderColor: theme.color.foreground.tertiary,
            backgroundColor: theme.color.foreground.tertiary,
            cursor: "not-allowed",
            color: theme.color.background.surface,
          },
          "&:not(:disabled):hover": {
            boxShadow: theme.effect.glow.base,
          },
        },
      },
    },
  },
]);
