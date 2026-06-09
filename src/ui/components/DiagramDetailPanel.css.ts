/**
 * DiagramDetailPanel Styles
 *
 * Themed styling for master/detail row expansion
 */

import { style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";

export const detailPanel = style({
  borderTop: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: theme.color.background.surface,
  padding: theme.spacing["4"],
});

export const detailPanelContent = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["4"],
});

export const detailPanelLoading = style({
  textAlign: "center",
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
  fontStyle: "italic",
});

export const statGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: theme.spacing["4"],
});

export const statItem = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["1"],
  clipPath: theme.clipPath.base,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: theme.color.surface.overlay,
  padding: theme.spacing["3"],
});

export const statLabel = style({
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wider,
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const statValue = style({
  letterSpacing: theme.typography.letterSpacing.tight,
  color: theme.color.interactive.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xl,
  fontWeight: theme.typography.weight.bold,
});

export const nodeTypeBreakdown = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["2"],
  clipPath: theme.clipPath.base,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: theme.color.surface.base,
  padding: theme.spacing["3"],
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

  selectors: {
    "& strong": {
      color: theme.color.interactive.primary,
      fontWeight: theme.typography.weight.semibold,
    },
  },
});
