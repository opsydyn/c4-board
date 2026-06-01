import { globalStyle, style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";

export const widgetLauncher = style({
  position: "absolute",
  zIndex: theme.zIndex.overlay,
  top: theme.spacing["5"],
  right: theme.spacing["4"],
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "3.25rem",
  height: "3.25rem",
  transition: theme.transition.base,
  border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
  borderRadius: "999px",
  boxShadow: theme.effect.glow.md,
  background:
    "radial-gradient(circle at 50% 35%, rgba(150, 236, 194, 0.24) 0%, rgba(10, 18, 14, 0.98) 62%, rgba(4, 7, 5, 1) 100%)",
  cursor: "pointer",
  color: theme.color.foreground.primary,

  selectors: {
    "&:hover": {
      transform: "scale(1.04)",
      borderColor: theme.color.status.selected,
      boxShadow: theme.effect.glow.lg,
    },
  },
});

export const widgetRoot = style({
  position: "absolute",
  zIndex: theme.zIndex.overlay,
  inset: 0,
  pointerEvents: "none",
});

export const widgetChrome = style({
  position: "relative",
  width: "100%",
  height: "100%",
  pointerEvents: "auto",
});

export const widgetFrame = style({
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  clipPath: theme.clipPath.lg,
  border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
  boxShadow: `${theme.effect.glow.lg}, 0 18px 60px rgba(0, 0, 0, 0.5)`,
  background:
    "linear-gradient(180deg, rgba(7, 13, 10, 0.985) 0%, rgba(4, 8, 6, 0.98) 100%)",
  overflow: "hidden",
});

export const widgetHandle = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: theme.spacing["3"],
  borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  background:
    "linear-gradient(180deg, rgba(10, 18, 14, 0.98) 0%, rgba(7, 13, 10, 0.94) 100%)",
  cursor: "move",
  padding: `${theme.spacing["4"]} ${theme.spacing["5"]} ${theme.spacing["3"]}`,
});

export const widgetTitleBlock = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["1"],
  minWidth: 0,
});

export const widgetEyebrow = style({
  margin: 0,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.status.selected,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const widgetTitle = style({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing["2"],
  margin: 0,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.engineering,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size["2xl"],
  fontWeight: theme.typography.weight.bold,
});

export const widgetMeta = style({
  margin: 0,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const widgetTelemetry = style({
  display: "inline-flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: theme.spacing["2"],
  minWidth: "12rem",
});

export const widgetTelemetryPill = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  clipPath: theme.clipPath.base,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(13, 22, 17, 0.92)",
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const widgetBody = style({
  display: "flex",
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
  padding: theme.spacing["4"],
});

globalStyle(`${widgetBody} > *`, {
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
});

export const widgetOrb = style({
  position: "absolute",
  zIndex: theme.zIndex.overlay,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "3rem",
  height: "3rem",
  transition: theme.transition.base,
  border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
  borderRadius: "999px",
  boxShadow: theme.effect.glow.sm,
  background:
    "radial-gradient(circle at 50% 35%, rgba(139, 214, 181, 0.22) 0%, rgba(16, 25, 20, 0.98) 55%, rgba(6, 9, 8, 1) 100%)",
  cursor: "pointer",
  color: theme.color.foreground.primary,

  selectors: {
    "&:hover, &[data-open]": {
      transform: "scale(1.05)",
      borderColor: theme.color.status.selected,
      boxShadow: theme.effect.glow.md,
    },
    "&[data-focus-visible]": {
      outline: `${theme.border.width.base} solid ${theme.color.border.focus}`,
      outlineOffset: "2px",
    },
  },
});

export const widgetOrbNorth = style({
  top: "-1.5rem",
  left: "50%",
  transform: "translateX(-50%)",
});

export const widgetOrbEast = style({
  top: "50%",
  right: "-1.5rem",
  transform: "translateY(-50%)",
});

export const widgetOrbSouth = style({
  bottom: "-1.5rem",
  left: "50%",
  transform: "translateX(-50%)",
});

export const widgetOrbWest = style({
  top: "50%",
  left: "-1.5rem",
  transform: "translateY(-50%)",
});

export const widgetOrbPopover = style({
  clipPath: theme.clipPath.md,
  border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
  boxShadow: `${theme.effect.glow.md}, 0 12px 36px rgba(0, 0, 0, 0.45)`,
  background:
    "linear-gradient(180deg, rgba(12, 20, 16, 0.97) 0%, rgba(8, 13, 10, 0.99) 100%)",
  minWidth: "17rem",
  maxWidth: "20rem",
  overflow: "hidden",
});

export const widgetOrbMenu = style({
  outline: "none",
  padding: theme.spacing["2"],
});

export const widgetOrbMenuItem = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["1"],
  transition: theme.transition.base,
  clipPath: theme.clipPath.sm,
  outline: "none",
  border: `${theme.border.width.thin} solid transparent`,
  backgroundColor: "transparent",
  cursor: "pointer",
  padding: `${theme.spacing["3"]} ${theme.spacing["3"]}`,

  selectors: {
    "&:hover, &[data-hovered], &[data-focused]": {
      borderColor: theme.color.status.selected,
      boxShadow: `0 0 10px ${theme.color.status.selected}33`,
      backgroundColor: theme.color.background.raised,
    },
    "&[data-disabled]": {
      cursor: "default",
      opacity: 0.6,
    },
  },
});

export const widgetOrbMenuLabel = style({
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
  fontWeight: theme.typography.weight.semibold,
});

export const widgetOrbMenuHint = style({
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
  lineHeight: 1.5,
});
