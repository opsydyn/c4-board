import { globalStyle, style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";

export const widgetLauncher = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: theme.transition.base,
  border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
  borderRadius: "999px",
  boxShadow: theme.effect.glow.md,
  background:
    "radial-gradient(circle at 50% 35%, rgba(150, 236, 194, 0.24) 0%, rgba(10, 18, 14, 0.98) 62%, rgba(4, 7, 5, 1) 100%)",
  cursor: "pointer",
  width: "3.25rem",
  height: "3.25rem",
  color: theme.color.foreground.primary,

  selectors: {
    "&:hover": {
      transform: "scale(1.04)",
      borderColor: theme.color.status.selected,
      boxShadow: theme.effect.glow.lg,
    },
  },
});

export const widgetLauncherTransition = style({
  position: "absolute",
  zIndex: theme.zIndex.overlay,
  top: theme.spacing["5"],
  right: theme.spacing["4"],
  transformOrigin: "top right",
  pointerEvents: "auto",
});

export const widgetRoot = style({
  position: "absolute",
  zIndex: theme.zIndex.overlay,
  inset: 0,
  transformOrigin: "center center",
  pointerEvents: "none",
});

export const widgetChrome = style({
  position: "relative",
  transition:
    "transform 220ms cubic-bezier(0.2, 0.85, 0.25, 1), width 240ms cubic-bezier(0.2, 0.85, 0.25, 1), height 240ms cubic-bezier(0.2, 0.85, 0.25, 1)",
  willChange: "transform, width, height",
  pointerEvents: "auto",
  width: "100%",
  height: "100%",
});

export const widgetOrbLauncherMount = style({
  position: "absolute",
  zIndex: theme.zIndex.overlay,
  transformOrigin: "center center",
  pointerEvents: "auto",
});

export const widgetOrbLauncher = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: theme.transition.base,
  border: `${theme.border.width.base} solid ${theme.color.status.selected}`,
  borderRadius: "999px",
  boxShadow: `${theme.effect.glow.lg}, 0 12px 32px rgba(0, 0, 0, 0.42)`,
  background:
    "radial-gradient(circle at 50% 35%, rgba(150, 236, 194, 0.34) 0%, rgba(10, 18, 14, 0.99) 58%, rgba(4, 7, 5, 1) 100%)",
  cursor: "pointer",
  width: "3.5rem",
  height: "3.5rem",
  color: theme.color.foreground.primary,

  selectors: {
    "&:hover": {
      transform: "scale(1.06)",
      boxShadow: `${theme.effect.glow.lg}, 0 16px 36px rgba(0, 0, 0, 0.48)`,
    },
  },
});

export const widgetFrame = style({
  display: "flex",
  flexDirection: "column",
  clipPath: theme.clipPath.lg,
  border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
  boxShadow: `${theme.effect.glow.lg}, 0 18px 60px rgba(0, 0, 0, 0.5)`,
  background: "linear-gradient(180deg, rgba(7, 13, 10, 0.985) 0%, rgba(4, 8, 6, 0.98) 100%)",
  width: "100%",
  height: "100%",
  overflow: "hidden",
});

export const widgetFrameMission = style({
  borderColor: theme.color.status.selected,
  boxShadow: `${theme.effect.glow.lg}, 0 26px 80px rgba(0, 0, 0, 0.58)`,
  background: "linear-gradient(180deg, rgba(8, 14, 12, 0.99) 0%, rgba(4, 7, 6, 0.995) 100%)",
});

export const widgetHandle = style({
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: theme.spacing["3"],
  borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  background: "linear-gradient(180deg, rgba(10, 18, 14, 0.98) 0%, rgba(7, 13, 10, 0.94) 100%)",
  cursor: "move",
  padding: `${theme.spacing["4"]} ${theme.spacing["5"]} ${theme.spacing["3"]}`,
});

export const widgetHandleMission = style({
  borderBottomColor: theme.color.status.selected,
  background: "linear-gradient(180deg, rgba(11, 22, 18, 0.99) 0%, rgba(8, 16, 13, 0.95) 100%)",
});

export const widgetTitleBlock = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["2"],
  minWidth: 0,
});

export const widgetEyebrow = style({
  margin: 0,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.status.selected,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
  lineHeight: theme.typography.lineHeight.normal,
});

export const widgetEyebrowMission = style({
  color: theme.color.status.selected,
});

export const widgetLensRow = style({
  display: "inline-flex",
  alignItems: "center",
  minHeight: "3.25rem",
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
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  alignItems: "start",
  justifyContent: "flex-end",
  gap: theme.spacing["1"],
  minWidth: "13.5rem",
  maxWidth: "18rem",
});

export const widgetTelemetryPill = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "flex-start",
  clipPath: theme.clipPath.base,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(11, 18, 15, 0.84)",
  padding: `${theme.spacing["1"]} ${theme.spacing["1"]}`,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
  lineHeight: theme.typography.lineHeight.tight,
  minWidth: 0,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

export const widgetBody = style({
  display: "flex",
  flex: 1,
  padding: theme.spacing["4"],
  minHeight: 0,
  overflow: "hidden",
});

export const widgetBodyMission = style({
  padding: theme.spacing["5"],
});

globalStyle(`${widgetBody} > *`, {
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
});

export const widgetOrb = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: theme.transition.base,
  border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
  borderRadius: "999px",
  boxShadow: theme.effect.glow.sm,
  background:
    "radial-gradient(circle at 50% 35%, rgba(139, 214, 181, 0.22) 0%, rgba(16, 25, 20, 0.98) 55%, rgba(6, 9, 8, 1) 100%)",
  cursor: "pointer",
  width: "3rem",
  height: "3rem",
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

export const widgetOrbMount = style({
  position: "absolute",
  zIndex: theme.zIndex.overlay,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  pointerEvents: "auto",
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

export const widgetOrbPanel = style({
  position: "absolute",
  zIndex: theme.zIndex.overlay,
  clipPath: theme.clipPath.md,
  border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
  boxShadow: `${theme.effect.glow.md}, 0 12px 36px rgba(0, 0, 0, 0.45)`,
  background: "linear-gradient(180deg, rgba(12, 20, 16, 0.97) 0%, rgba(8, 13, 10, 0.99) 100%)",
  pointerEvents: "auto",
  padding: theme.spacing["2"],
  minWidth: "17rem",
  maxWidth: "20rem",
  overflow: "hidden",
});

export const widgetOrbPanelNorth = style({
  top: "calc(100% + 0.875rem)",
  left: "50%",
  transform: "translateX(-50%)",
});

export const widgetOrbPanelEast = style({
  top: "50%",
  right: "calc(100% + 0.875rem)",
  transform: "translateY(-50%)",
});

export const widgetOrbPanelSouth = style({
  bottom: "calc(100% + 0.875rem)",
  left: "50%",
  transform: "translateX(-50%)",
});

export const widgetOrbPanelWest = style({
  top: "50%",
  left: "calc(100% + 0.875rem)",
  transform: "translateY(-50%)",
});

export const widgetOrbMenuItem = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: theme.spacing["1"],
  transition: theme.transition.base,
  clipPath: theme.clipPath.sm,
  outline: "none",
  border: `${theme.border.width.thin} solid transparent`,
  backgroundColor: "transparent",
  cursor: "pointer",
  padding: `${theme.spacing["3"]} ${theme.spacing["3"]}`,
  width: "100%",

  selectors: {
    "& + &": {
      marginTop: theme.spacing["1"],
    },
    "&:hover, &[data-hovered], &[data-focused]": {
      borderColor: theme.color.status.selected,
      boxShadow: `0 0 10px ${theme.color.status.selected}33`,
      backgroundColor: theme.color.background.raised,
    },
    "&[data-disabled]": {
      opacity: 0.6,
      cursor: "default",
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
  lineHeight: 1.5,
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});
