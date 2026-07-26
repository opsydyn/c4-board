/**
 * ExportModal Styles (Vanilla Extract)
 */

import { style } from "@vanilla-extract/css";
import { componentsLayer } from "../../styles/layers.css";
import { theme } from "../../styles/theme.css";
import { toolbarButton } from "./styles.css";

export const exportModalOverlay = style({
  "@layer": {
    [componentsLayer]: {
      boxSizing: "border-box",
      position: "fixed",
      zIndex: 1000,
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0, 0, 0, 0.72)",
      padding: theme.spacing["6"],
    },
  },
});

export const exportModalContainer = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      clipPath: theme.clipPath.lg,
      border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
      boxShadow: theme.effect.glow.lg,
      backgroundColor: theme.color.background.base,
      width: "min(980px, 100%)",
      maxHeight: "calc(100vh - 3rem)",
      overflow: "hidden",
    },
  },
});

export const exportModalInner = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing["4"],
      padding: theme.spacing["6"],
      overflowY: "auto",
    },
  },
});

export const exportModalHeader = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.spacing["3"],
    },
  },
});

export const exportModalTitle = style({
  "@layer": {
    [componentsLayer]: {
      margin: 0,
      textTransform: theme.typography.textTransform.uppercase,
      letterSpacing: theme.typography.letterSpacing.wide,
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.lg,
      fontWeight: theme.typography.weight.bold,
    },
  },
});

export const exportModalCloseButton = style({
  "@layer": {
    [componentsLayer]: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      transition: theme.transition.base,
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
      backgroundColor: "rgba(13, 23, 18, 0.95)",
      cursor: "pointer",
      padding: theme.spacing["2"],
      color: theme.color.foreground.secondary,

      selectors: {
        "&:hover": {
          borderColor: theme.color.border.primary,
          boxShadow: theme.effect.glow.base,
          color: theme.color.foreground.primary,
        },
      },
    },
  },
});

export const exportModalContent = style({
  "@layer": {
    [componentsLayer]: {
      flex: 1,
      overflow: "auto",
    },
  },
});

export const exportModalCodeBlock = style({
  "@layer": {
    [componentsLayer]: {
      clipPath: theme.clipPath.base,
      margin: 0,
      border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.surface,
      backgroundImage: `
				linear-gradient(${theme.color.grid} 1px, transparent 1px),
				linear-gradient(90deg, ${theme.color.grid} 1px, transparent 1px)
			`,
      backgroundSize: "20px 20px",
      padding: theme.spacing["4"],
      maxHeight: "52vh",
      overflow: "auto",
      tabSize: 2,
      lineHeight: theme.typography.lineHeight.relaxed,
      whiteSpace: "pre",
      color: theme.color.foreground.secondary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.sm,
    },
  },
});

export const exportModalActions = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      justifyContent: "flex-end",
      gap: theme.spacing["2"],
      marginTop: theme.spacing["2"],
      borderTop: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
      paddingTop: theme.spacing["3"],
    },
  },
});

export const exportModalButton = style([
  toolbarButton,
  {
    "@layer": {
      [componentsLayer]: {
        justifyContent: "center",
        borderColor: theme.color.border.secondary,
        minWidth: "11rem",
        color: theme.color.foreground.primary,
      },
    },
  },
]);

export const exportModalButtonPrimary = style([
  exportModalButton,
  {
    "@layer": {
      [componentsLayer]: {
        borderColor: theme.color.interactive.primary,
        boxShadow: `inset 0 0 0 1px ${theme.color.interactive.primary}55`,
        color: theme.color.interactive.primary,

        selectors: {
          "&:hover": {
            boxShadow: theme.effect.glow.base,
          },
        },
      },
    },
  },
]);

/**
 * The rendered diagram. Mermaid emits an SVG sized to its own layout, so the
 * container scrolls rather than the dialog growing to fit an arbitrary diagram.
 */
export const exportModalPreview = style([
  {
    "@layer": {
      [componentsLayer]: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
        backgroundColor: theme.color.background.surface,
        minHeight: "12rem",
        overflow: "auto",
      },
    },
  },
  { padding: theme.spacing["4"] },
]);
