/**
 * InlineEditor Styles (Vanilla Extract)
 *
 * Type-safe styles for the Lexical inline editor component
 */

import { style } from "@vanilla-extract/css";
import { componentsLayer } from "../../../styles/layers.css";
import { theme } from "../../../styles/theme.css";

export const inlineEditorContainer = style({
  "@layer": {
    [componentsLayer]: {
      position: "relative",
      width: "100%",
      minHeight: "1.5rem",
    },
  },
});

export const inlineEditorContentEditable = style({
  "@layer": {
    [componentsLayer]: {
      clipPath: theme.clipPath.sm,
      outline: "none",
      border: `${theme.border.width.thin} solid ${theme.color.border.focus}`,
      backgroundColor: theme.color.background.surface,
      cursor: "text",
      padding: theme.spacing["2"],
      minHeight: "2rem",
      maxHeight: "10rem",
      overflowY: "auto",
      lineHeight: theme.typography.lineHeight.normal,
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.sans,
      fontSize: theme.typography.size.sm,

      ":focus": {
        borderColor: theme.color.status.selected,
        boxShadow: theme.effect.glow.sm,
      },
    },
  },
});

export const inlineEditorPlaceholder = style({
  "@layer": {
    [componentsLayer]: {
      position: "absolute",
      top: theme.spacing["2"],
      left: theme.spacing["2"],
      pointerEvents: "none",
      userSelect: "none",
      lineHeight: theme.typography.lineHeight.normal,
      color: theme.color.foreground.tertiary,
      fontSize: theme.typography.size.sm,
    },
  },
});

export const inlineEditorError = style({
  "@layer": {
    [componentsLayer]: {
      clipPath: theme.clipPath.sm,
      marginTop: theme.spacing["1"],
      backgroundColor: `${theme.color.status.critical}15`,
      padding: theme.spacing["1"],
      color: theme.color.status.critical,
      fontSize: theme.typography.size.xs,
    },
  },
});
