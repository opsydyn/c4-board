import { style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";

export const root = style({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing["2"],
  minWidth: 0,
});

export const tabs = style({
  flex: 1,
  minWidth: 0,
});

export const tabList = style({
  display: "flex",
  alignItems: "stretch",
  gap: theme.spacing["1"],
  minWidth: 0,
  overflowX: "auto",
  scrollbarWidth: "thin",
});

export const tab = style({
  display: "flex",
  flex: "0 0 min(220px, 62vw)",
  alignItems: "center",
  gap: theme.spacing["2"],
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(10, 18, 14, 0.94)",
  cursor: "pointer",
  padding: `${theme.spacing["2"]} 0 ${theme.spacing["2"]} ${theme.spacing["3"]}`,
  minWidth: 0,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
  selectors: {
    "&[data-selected]": {
      color: theme.color.foreground.primary,
    },
    "&:focus-visible": {
      outline: `${theme.border.width.thin} solid ${theme.color.border.focus}`,
      outlineOffset: "-1px",
    },
  },
});

export const tabLabel = style({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const dirtyMarker = style({
  flex: "0 0 auto",
  borderRadius: "50%",
  backgroundColor: theme.color.status.caution,
  width: "6px",
  height: "6px",
});

export const closeButton = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  width: "28px",
  height: "28px",
  color: theme.color.foreground.secondary,
  selectors: {
    "&:hover": {
      backgroundColor: "rgba(255, 107, 107, 0.14)",
      color: theme.color.status.critical,
    },
    "&:focus-visible": {
      outline: `${theme.border.width.thin} solid ${theme.color.border.focus}`,
    },
  },
});

export const reopenButton = style({
  display: "inline-flex",
  flex: "0 0 auto",
  alignItems: "center",
  gap: theme.spacing["1"],
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  background: "transparent",
  cursor: "pointer",
  padding: `0 ${theme.spacing["2"]}`,
  height: "30px",
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
  selectors: {
    "&:hover": {
      borderColor: theme.color.border.primary,
      color: theme.color.foreground.primary,
    },
  },
});

export const reopenPopover = style({
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  boxShadow: theme.effect.glow.sm,
  backgroundColor: theme.color.background.surface,
  padding: theme.spacing["1"],
  minWidth: "200px",
});

export const reopenMenu = style({
  display: "flex",
  flexDirection: "column",
  outline: "none",
});

export const reopenMenuItem = style({
  cursor: "pointer",
  padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
  selectors: {
    "&[data-focused]": {
      backgroundColor: "rgba(24, 40, 32, 0.9)",
    },
  },
});
