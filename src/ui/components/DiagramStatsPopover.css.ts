/**
 * DiagramStatsPopover Styles
 *
 * Themed React Aria Components styling for popover stats
 */

import { style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";

export const infoButton = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: theme.transition.fast,
  clipPath: theme.clipPath.sm,
  outline: "none",
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: theme.color.background.surface,
  cursor: "pointer",
  width: "32px",
  height: "32px",
  color: theme.color.interactive.primary,

  selectors: {
    "&:hover": {
      borderColor: theme.color.border.primary,
      boxShadow: theme.effect.glow.sm,
      backgroundColor: theme.color.background.raised,
    },
    "&[data-pressed]": {
      transform: "scale(0.95)",
      backgroundColor: theme.color.background.input,
    },
    "&[data-focus-visible]": {
      outline: `${theme.border.width.base} solid ${theme.color.border.focus}`,
      outlineOffset: "2px",
    },
  },
});

export const popoverContainer = style({
  position: "relative",
  zIndex: theme.zIndex.dropdown,
  opacity: "1 !important",
  // Force solid background
  backdropFilter: "blur(8px)",
  clipPath: theme.clipPath.base,
  outline: "none",
  border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
  boxShadow: `${theme.effect.glow.md}, 0 8px 24px rgba(0, 0, 0, 0.5)`,
  backgroundColor: `${theme.color.background.surface} !important`,
  minWidth: "320px",
  // Ensure content is visible
  maxWidth: "400px",
});

export const popoverContent = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["3"],
  outline: "none",
  backgroundColor: "transparent",
  padding: theme.spacing["4"],
  color: `${theme.color.foreground.primary} !important`,
});

export const popoverHeader = style({
  borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  paddingBottom: theme.spacing["2"],
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wider,
  color: theme.color.interactive.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.base,
  fontWeight: theme.typography.weight.semibold,
});

export const statGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: theme.spacing["2"],
});

export const statItem = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: theme.spacing["1"],
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: theme.color.background.surface,
  padding: theme.spacing["2"],
});

export const statLabel = style({
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const statValue = style({
  color: theme.color.interactive.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.lg,
  fontWeight: theme.typography.weight.bold,
});

export const nodeTypeBreakdown = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["2"],
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: theme.color.background.surface,
  padding: theme.spacing["2"],
});

export const nodeTypeItem = style({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing["1"],
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: theme.color.background.raised,
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const nodeTypeCount = style({
  color: theme.color.interactive.primary,
  fontWeight: theme.typography.weight.semibold,
});

export const loadingText = style({
  padding: theme.spacing["4"],
  textAlign: "center",
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
  fontStyle: "italic",
});
