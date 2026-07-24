import { style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";

export const overlay = style({
  position: "fixed",
  zIndex: 60,
  inset: 0,
  display: "grid",
  placeItems: "center",
  backgroundColor: "rgba(0, 0, 0, 0.68)",
  padding: theme.spacing["4"],
});

export const modal = style({
  clipPath: theme.clipPath.base,
  border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
  boxShadow: theme.effect.glow.lg,
  backgroundColor: theme.color.background.surface,
  width: "min(440px, calc(100vw - 32px))",
  maxHeight: "min(560px, calc(100vh - 32px))",
  overflow: "auto",
});

export const dialog = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["3"],
  outline: "none",
  padding: theme.spacing["5"],
});

export const title = style({
  margin: 0,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.base,
});

export const description = style({
  margin: 0,
  color: theme.color.foreground.secondary,
  fontSize: theme.typography.size.sm,
});

export const collectionList = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["1"],
  outline: "none",
  maxHeight: "260px",
  overflowY: "auto",
});

export const collectionItem = style({
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  cursor: "pointer",
  padding: `${theme.spacing["3"]} ${theme.spacing["3"]}`,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
  selectors: {
    "&[data-selected]": {
      borderColor: theme.color.border.primary,
      backgroundColor: "rgba(24, 40, 32, 0.9)",
    },
    "&[data-focused]": {
      outline: `${theme.border.width.thin} solid ${theme.color.border.focus}`,
    },
  },
});

export const emptyState = style({
  margin: 0,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const actions = style({
  display: "flex",
  justifyContent: "flex-end",
  gap: theme.spacing["2"],
  marginTop: theme.spacing["1"],
});

const button = {
  height: "34px",
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  cursor: "pointer",
  padding: `0 ${theme.spacing["3"]}`,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
};

export const secondaryButton = style({
  ...button,
  background: "transparent",
  color: theme.color.foreground.secondary,
});

export const primaryButton = style({
  ...button,
  borderColor: theme.color.border.primary,
  backgroundColor: theme.color.interactive.primary,
  color: theme.color.background.base,
  selectors: {
    "&:disabled": {
      opacity: theme.opacity.disabled,
      cursor: "not-allowed",
    },
  },
});
