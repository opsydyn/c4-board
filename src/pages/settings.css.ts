import { globalStyle, style } from "@vanilla-extract/css";
import { theme } from "../styles/theme.css";

export const pageShell = style({
  display: "grid",
  gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
  backgroundColor: theme.color.background.base,
  minHeight: "100vh",
  color: theme.color.foreground.primary,

  "@media": {
    "(max-width: 1000px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const sidebar = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["4"],
  borderRight: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(9, 16, 13, 0.92)",
  padding: `${theme.spacing["5"]} ${theme.spacing["4"]}`,

  "@media": {
    "(max-width: 1000px)": {
      borderRight: "none",
      borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
    },
  },
});

export const sidebarBrand = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing["2"],
  width: "100%",
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const sidebarBrandIdentity = style({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing["2"],
});

export const sidebarBrandIcon = style({
  display: "block",
  flexShrink: 0,
  clipPath: theme.clipPath.sm,
  boxShadow: theme.effect.glow.sm,
});

export const sidebarBrandMeta = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["1"],
});

export const sidebarBrandAction = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.interactive.primary}`,
  backgroundColor: "rgba(13, 23, 18, 0.95)",
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const sidebarTagline = style({
  margin: 0,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const sidebarQuickActions = style({
  display: "flex",
  alignItems: "stretch",
  gap: theme.spacing["2"],
  width: "100%",
});

export const sidebarQuickLink = style({
  display: "inline-flex",
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  transition: theme.transition.base,
  clipPath: theme.clipPath.base,
  border: `${theme.border.width.thin} solid ${theme.color.interactive.primary}`,
  backgroundColor: "rgba(13, 23, 18, 0.95)",
  padding: `${theme.spacing["2"]} ${theme.spacing["2"]}`,
  textTransform: theme.typography.textTransform.uppercase,
  textDecoration: "none",
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
  fontWeight: theme.typography.weight.bold,

  selectors: {
    "&:hover": {
      boxShadow: theme.effect.glow.base,
      textDecoration: "underline",
    },
  },
});

export const sidebarSectionNav = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["2"],
  marginTop: theme.spacing["2"],
});

export const sidebarSectionLink = style({
  display: "inline-flex",
  alignItems: "center",
  borderLeft: `${theme.border.width.base} solid ${theme.color.border.secondary}`,
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  textTransform: theme.typography.textTransform.uppercase,
  textDecoration: "none",
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,

  selectors: {
    "&:hover": {
      borderLeftColor: theme.color.interactive.primary,
      color: theme.color.foreground.primary,
    },
  },
});

export const main = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["5"],
  padding: `${theme.spacing["6"]} ${theme.spacing["6"]} ${theme.spacing["8"]}`,
  minWidth: 0,

  "@media": {
    "(max-width: 1000px)": {
      padding: `${theme.spacing["5"]} ${theme.spacing["4"]} ${theme.spacing["6"]}`,
    },
  },
});

export const mainHeader = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["2"],
  borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  paddingBottom: theme.spacing["4"],
});

export const mainTitle = style({
  margin: 0,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size["2xl"],
});

export const mainSubtitle = style({
  margin: 0,
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
});

export const settingsGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: theme.spacing["4"],

  "@media": {
    "(max-width: 1200px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const settingsCard = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["3"],
  clipPath: theme.clipPath.md,
  border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
  boxShadow: theme.effect.glow.sm,
  backgroundColor: "rgba(10, 18, 14, 0.95)",
  padding: `${theme.spacing["4"]} ${theme.spacing["4"]}`,
  minHeight: "180px",
});

export const settingsCardWide = style({
  gridColumn: "1 / -1",
});

export const settingsCardDanger = style({
  borderColor: theme.color.status.critical,
  boxShadow: `0 0 14px ${theme.color.status.critical}33`,
  backgroundColor: "rgba(35, 12, 14, 0.75)",
});

export const settingsCardTitle = style({
  margin: 0,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.md,
});

export const settingsCardDescription = style({
  margin: 0,
  lineHeight: 1.5,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.sans,
  fontSize: theme.typography.size.sm,
});

export const settingsRow = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing["2"],
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(12, 20, 16, 0.82)",
  padding: `${theme.spacing["2"]} ${theme.spacing["2"]}`,
});

export const settingsRowLabel = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["1"],
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.sans,
  fontSize: theme.typography.size.sm,
});

export const settingsRowHint = style({
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const settingsRowValue = style({
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(9, 16, 13, 0.9)",
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const settingsStatusBar = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: theme.spacing["2"],
});

export const settingsStatusBadge = style({
  display: "inline-flex",
  alignItems: "center",
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(9, 16, 13, 0.9)",
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const settingsStatusLoading = style({
  borderColor: theme.color.border.secondary,
  color: theme.color.foreground.tertiary,
});

export const settingsStatusSaving = style({
  borderColor: theme.color.status.caution,
  boxShadow: `0 0 10px ${theme.color.status.caution}33`,
  color: theme.color.status.caution,
});

export const settingsStatusSaved = style({
  borderColor: theme.color.status.ready,
  boxShadow: `0 0 10px ${theme.color.status.ready}33`,
  color: theme.color.status.ready,
});

export const settingsStatusDrift = style({
  borderColor: theme.color.status.caution,
  boxShadow: `0 0 10px ${theme.color.status.caution}33`,
  color: theme.color.status.caution,
});

export const settingsStatusError = style({
  borderColor: theme.color.status.critical,
  boxShadow: `0 0 10px ${theme.color.status.critical}33`,
  color: theme.color.status.critical,
});

export const settingsErrorText = style({
  margin: 0,
  color: theme.color.status.critical,
  fontFamily: theme.typography.family.sans,
  fontSize: theme.typography.size.sm,
});

export const settingsLoadingState = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  clipPath: theme.clipPath.md,
  border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
  backgroundColor: "rgba(10, 18, 14, 0.95)",
  minHeight: "240px",
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
});

export const settingsControlGroup = style({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing["2"],
});

export const settingsToggleControl = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: theme.transition.base,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(9, 16, 13, 0.92)",
  cursor: "pointer",
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  minWidth: "4.75rem",
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
  fontWeight: theme.typography.weight.bold,

  selectors: {
    "&[data-active='true']": {
      borderColor: theme.color.interactive.primary,
      boxShadow: theme.effect.glow.sm,
      backgroundColor: "rgba(16, 30, 22, 0.95)",
      color: theme.color.foreground.primary,
    },
    "&:hover": {
      borderColor: theme.color.interactive.primary,
      color: theme.color.foreground.primary,
    },
    "&:disabled": {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  },
});

const textFieldBase = {
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(9, 16, 13, 0.92)",
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  minHeight: "2rem",
  transition: theme.transition.base,
};

export const settingsSelectControl = style({
  ...textFieldBase,
  minWidth: "8rem",

  selectors: {
    "&:focus-visible": {
      outline: "none",
      borderColor: theme.color.interactive.primary,
      boxShadow: theme.effect.glow.sm,
    },
  },
});

export const settingsNumberControl = style({
  ...textFieldBase,
  width: "6.5rem",

  selectors: {
    "&:focus-visible": {
      outline: "none",
      borderColor: theme.color.interactive.primary,
      boxShadow: theme.effect.glow.sm,
    },
  },
});

export const settingsRangeControl = style({
  appearance: "none",
  border: "none",
  backgroundColor: "transparent",
  cursor: "pointer",
  padding: 0,
  width: "8rem",
  minWidth: "8rem",
  height: "1.25rem",
  WebkitAppearance: "none",

  selectors: {
    "&:focus-visible": {
      outline: "none",
    },
  },
});

globalStyle(`${settingsRangeControl}::-webkit-slider-runnable-track`, {
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  boxShadow: `inset 0 0 0 1px ${theme.color.grid}`,
  backgroundColor: "rgba(9, 16, 13, 0.92)",
  height: "0.375rem",
});

globalStyle(`${settingsRangeControl}::-webkit-slider-thumb`, {
  marginTop: "-0.3rem",
  border: `${theme.border.width.thin} solid ${theme.color.status.selected}`,
  boxShadow: `0 0 8px ${theme.color.status.selected}66`,
  backgroundColor: theme.color.status.selected,
  cursor: "pointer",
  width: "0.9rem",
  height: "0.9rem",
  WebkitAppearance: "none",
});

globalStyle(`${settingsRangeControl}::-moz-range-track`, {
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  boxShadow: `inset 0 0 0 1px ${theme.color.grid}`,
  backgroundColor: "rgba(9, 16, 13, 0.92)",
  height: "0.375rem",
});

globalStyle(`${settingsRangeControl}::-moz-range-progress`, {
  boxShadow: `0 0 8px ${theme.color.status.selected}44`,
  backgroundColor: theme.color.status.selected,
  height: "0.375rem",
});

globalStyle(`${settingsRangeControl}::-moz-range-thumb`, {
  border: `${theme.border.width.thin} solid ${theme.color.status.selected}`,
  boxShadow: `0 0 8px ${theme.color.status.selected}66`,
  backgroundColor: theme.color.status.selected,
  cursor: "pointer",
  width: "0.9rem",
  height: "0.9rem",
});

export const settingsRangeValue = style({
  minWidth: "3rem",
  textAlign: "right",
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const settingsInlineActions = style({
  display: "inline-flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: theme.spacing["2"],
});

export const settingsActionButton = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: theme.transition.base,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(9, 16, 13, 0.92)",
  cursor: "pointer",
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,

  selectors: {
    "&:hover": {
      borderColor: theme.color.interactive.primary,
      boxShadow: theme.effect.glow.sm,
      color: theme.color.foreground.primary,
    },
    "&:disabled": {
      opacity: 0.45,
      boxShadow: "none",
      cursor: "not-allowed",
    },
  },
});

export const settingsActionButtonDanger = style({
  borderColor: theme.color.status.critical,
  backgroundColor: "rgba(40, 14, 16, 0.72)",
  color: theme.color.status.critical,
});

export const settingsNotice = style({
  margin: 0,
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.sans,
  fontSize: theme.typography.size.sm,
});

export const settingsMetricsGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: theme.spacing["2"],
});

export const settingsMetricTile = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["1"],
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(12, 20, 16, 0.82)",
  padding: `${theme.spacing["2"]} ${theme.spacing["2"]}`,
});

export const settingsMetricLabel = style({
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const settingsMetricValue = style({
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.lg,
  fontWeight: theme.typography.weight.bold,
});

export const settingsAuditList = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["2"],
});

export const settingsAuditEntry = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["2"],
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(12, 20, 16, 0.82)",
  padding: `${theme.spacing["3"]} ${theme.spacing["3"]}`,
});

export const settingsAuditEntryHeader = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: theme.spacing["2"],
});

export const settingsAuditEntryTitle = style({
  margin: 0,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
});

export const settingsAuditEntryMeta = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: theme.spacing["2"],
});

export const settingsAuditEntryBody = style({
  margin: 0,
  lineHeight: 1.5,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.sans,
  fontSize: theme.typography.size.sm,
});
