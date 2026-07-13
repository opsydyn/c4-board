import { globalStyle, keyframes, style } from "@vanilla-extract/css";
import { componentsLayer } from "../../styles/layers.css";
import { theme } from "../../styles/theme.css";

export const drawer = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      gridRow: "2 / 3",
      gridColumn: "1 / -1",
      border: `${theme.border.width.base} solid ${theme.color.status.selected}`,
      boxShadow: `0 -14px 42px rgba(0, 0, 0, 0.42), ${theme.effect.glow.md}`,
      backgroundColor: theme.color.background.surface,
      minHeight: "18rem",
      maxHeight: "min(42vh, 30rem)",
      overflow: "hidden",
      color: theme.color.foreground.primary,

      "@media": {
        "screen and (max-width: 1180px)": {
          minHeight: "26rem",
          maxHeight: "min(62vh, 36rem)",
        },
      },
    },
  },
});

export const visuallyHidden = style({
  position: "absolute",
  margin: -1,
  border: 0,
  padding: 0,
  width: 1,
  height: 1,
  overflow: "hidden",
  whiteSpace: "nowrap",
  clip: "rect(0, 0, 0, 0)",
});

export const header = style([
  {
    "@layer": {
      [componentsLayer]: {
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: theme.spacing["5"],
        borderBottom: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
        backgroundColor: theme.color.background.raised,
      },
    },
  },
  {
    padding: `${theme.spacing["4"]} ${theme.spacing["6"]}`,
    "@media": {
      "screen and (max-width: 760px)": {
        padding: `${theme.spacing["3"]} ${theme.spacing["4"]}`,
      },
    },
  },
]);

export const identity = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flex: "1 1 24rem",
      flexDirection: "column",
      gap: theme.spacing["1"],
      minWidth: 0,
    },
  },
});

export const eyebrow = style({
  "@layer": {
    [componentsLayer]: {
      letterSpacing: theme.typography.letterSpacing.wide,
      color: theme.color.status.selected,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
      fontWeight: theme.typography.weight.bold,
    },
  },
});

export const title = style({
  "@layer": {
    [componentsLayer]: {
      margin: 0,
      overflowWrap: "anywhere",
      letterSpacing: 0,
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.lg,
      fontWeight: theme.typography.weight.bold,
    },
  },
});

export const meta = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexWrap: "wrap",
      gap: theme.spacing["3"],
      letterSpacing: theme.typography.letterSpacing.wide,
      color: theme.color.foreground.tertiary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
    },
  },
});

export const actions = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: theme.spacing["3"],
    },
  },
});

const actionButton = style([
  {
    "@layer": {
      [componentsLayer]: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: theme.spacing["2"],
        transition: theme.transition.base,
        border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
        backgroundColor: theme.color.background.surface,
        cursor: "pointer",
        minHeight: "2.25rem",
        textTransform: "uppercase",
        letterSpacing: theme.typography.letterSpacing.wide,
        color: theme.color.foreground.primary,
        fontFamily: theme.typography.family.mono,
        fontSize: theme.typography.size.xs,
        fontWeight: theme.typography.weight.bold,
      },
    },
  },
  {
    padding: `${theme.spacing["2"]} ${theme.spacing["4"]}`,
  },
]);

export const cancelButton = style([
  actionButton,
  {
    selectors: {
      "&:hover": {
        borderColor: theme.color.status.critical,
        color: theme.color.status.critical,
      },
    },
  },
]);

export const applyButton = style([
  actionButton,
  {
    borderColor: theme.color.status.ready,
    backgroundColor: `color-mix(in srgb, ${theme.color.status.ready} 12%, ${theme.color.background.surface})`,
    color: theme.color.status.ready,

    selectors: {
      "&:hover": {
        boxShadow: theme.effect.glow.sm,
        backgroundColor: `color-mix(in srgb, ${theme.color.status.ready} 20%, ${theme.color.background.surface})`,
      },
    },
  },
]);

export const retryButton = style([
  actionButton,
  {
    borderColor: theme.color.status.caution,
    color: theme.color.status.caution,
    selectors: {
      "&:hover": {
        backgroundColor: `color-mix(in srgb, ${theme.color.status.caution} 14%, ${theme.color.background.surface})`,
      },
    },
  },
]);

export const fallbackNotice = style([
  {
    "@layer": {
      [componentsLayer]: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing["3"],
        borderBottom: `${theme.border.width.thin} solid ${theme.color.status.caution}`,
        backgroundColor: `color-mix(in srgb, ${theme.color.status.caution} 8%, ${theme.color.background.surface})`,
        color: theme.color.status.caution,
        fontFamily: theme.typography.family.mono,
        fontSize: theme.typography.size.xs,
      },
    },
  },
  { padding: `${theme.spacing["2"]} ${theme.spacing["6"]}` },
]);

globalStyle(`${fallbackNotice} p`, {
  margin: 0,
  letterSpacing: 0,
});

export const content = style({
  "@layer": {
    [componentsLayer]: {
      display: "grid",
      flex: 1,
      gridTemplateColumns: "minmax(14rem, 0.8fr) minmax(26rem, 1.4fr) minmax(18rem, 1fr)",
      minHeight: 0,
      overflow: "auto",

      "@media": {
        "screen and (max-width: 1180px)": {
          gridTemplateColumns: "minmax(14rem, 0.8fr) minmax(24rem, 1.2fr)",
        },
        "screen and (max-width: 760px)": {
          gridTemplateColumns: "1fr",
        },
      },
    },
  },
});

export const statusContent = style([
  {
    "@layer": {
      [componentsLayer]: {
        display: "flex",
        flex: 1,
        alignItems: "center",
        gap: theme.spacing["4"],
        color: theme.color.foreground.secondary,
      },
    },
  },
  { padding: theme.spacing["6"] },
]);

globalStyle(`${statusContent} h3`, {
  margin: 0,
  letterSpacing: 0,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.md,
});

globalStyle(`${statusContent} p`, {
  margin: `${theme.spacing["1"]} 0 0`,
  letterSpacing: 0,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
});

const statusSpin = keyframes({
  to: { transform: "rotate(360deg)" },
});

export const statusSpinner = style({
  animation: `${statusSpin} 900ms linear infinite`,
});

const section = style([
  {
    "@layer": {
      [componentsLayer]: {
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing["4"],
        borderRight: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
        minWidth: 0,
        overflow: "auto",

        "@media": {
          "screen and (max-width: 760px)": {
            borderRight: "none",
            borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
            overflow: "visible",
          },
        },
      },
    },
  },
  {
    padding: theme.spacing["5"],
    "@media": {
      "screen and (max-width: 760px)": {
        padding: theme.spacing["4"],
      },
    },
  },
]);

export const controlSection = style([section]);
export const qualitySection = style([section]);
export const diagnosticsSection = style([
  section,
  {
    borderRight: "none",
  },
]);

export const portSummary = style({
  "@layer": {
    [componentsLayer]: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: theme.spacing["2"],
      margin: 0,

      "@media": {
        "screen and (max-width: 760px)": {
          gridTemplateColumns: "1fr",
        },
      },
    },
  },
});

globalStyle(`${portSummary} > div`, {
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  padding: theme.spacing["2"],
});

globalStyle(`${portSummary} > div[data-tone="warning"]`, {
  borderColor: theme.color.status.caution,
  color: theme.color.status.caution,
});

globalStyle(`${portSummary} > div[data-tone="ready"]`, {
  borderColor: theme.color.status.ready,
  color: theme.color.status.ready,
});

globalStyle(`${portSummary} dt`, {
  textTransform: "uppercase",
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

globalStyle(`${portSummary} dd`, {
  margin: `${theme.spacing["1"]} 0 0`,
  overflowWrap: "anywhere",
  letterSpacing: 0,
  color: "inherit",
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
  fontWeight: theme.typography.weight.bold,
});

export const sectionHeading = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing["2"],
      color: theme.color.interactive.primary,
    },
  },
});

globalStyle(`${sectionHeading} h3`, {
  margin: 0,
  textTransform: "uppercase",
  letterSpacing: theme.typography.letterSpacing.wide,
  color: "inherit",
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
  fontWeight: theme.typography.weight.bold,
});

export const definitionList = style({
  "@layer": {
    [componentsLayer]: {
      display: "grid",
      gap: theme.spacing["2"],
      margin: 0,
    },
  },
});

globalStyle(`${definitionList} > div`, {
  display: "grid",
  gridTemplateColumns: "minmax(5rem, 0.7fr) minmax(0, 1.3fr)",
  gap: theme.spacing["2"],
  borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  paddingBottom: theme.spacing["2"],
});

globalStyle(`${definitionList} dt`, {
  textTransform: "uppercase",
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

globalStyle(`${definitionList} dd`, {
  margin: 0,
  overflowWrap: "anywhere",
  textTransform: "uppercase",
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const centerControl = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing["2"],
    },
  },
});

export const controlLabel = style({
  "@layer": {
    [componentsLayer]: {
      textTransform: "uppercase",
      letterSpacing: theme.typography.letterSpacing.wide,
      color: theme.color.foreground.secondary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
      fontWeight: theme.typography.weight.semibold,
    },
  },
});

export const semanticRoleReview = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["2"],
  minHeight: 0,
});

export const semanticRoleHeading = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing["2"],
  textTransform: "uppercase",
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
  fontWeight: theme.typography.weight.semibold,
});

export const semanticRoleList = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["2"],
  margin: 0,
  padding: 0,
  listStyle: "none",
});

globalStyle(`${semanticRoleList} > li`, {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  borderLeft: `3px solid ${theme.color.status.ready}`,
  backgroundColor: theme.color.background.raised,
  padding: theme.spacing["2"],
});

globalStyle(`${semanticRoleList} > li[data-tone="warning"]`, {
  borderLeftColor: theme.color.status.caution,
});

export const semanticRoleIdentity = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["1"],
  minWidth: 0,
  overflowWrap: "anywhere",
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

globalStyle(`${semanticRoleIdentity} span`, {
  color: theme.color.status.selected,
});

export const semanticRoleMeta = style({
  display: "flex",
  alignItems: "flex-start",
  gap: theme.spacing["2"],
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

globalStyle(`${semanticRoleList} p`, {
  gridColumn: "1 / -1",
  margin: 0,
  overflowWrap: "anywhere",
  letterSpacing: 0,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const semanticRoleControl = style({
  gridColumn: "1 / -1",
  minWidth: 0,
});

export const tableWrap = style({
  "@layer": {
    [componentsLayer]: {
      overflowX: "auto",
    },
  },
});

export const qualityTable = style({
  "@layer": {
    [componentsLayer]: {
      width: "100%",
      minWidth: "25rem",
      borderCollapse: "collapse",
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
    },
  },
});

globalStyle(`${qualityTable} th, ${qualityTable} td`, {
  borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
  textAlign: "right",
});

globalStyle(`${qualityTable} th:first-child`, {
  textAlign: "left",
});

globalStyle(`${qualityTable} thead th`, {
  textTransform: "uppercase",
  color: theme.color.foreground.tertiary,
  fontWeight: theme.typography.weight.semibold,
});

globalStyle(`${qualityTable} tbody th`, {
  color: theme.color.foreground.secondary,
  fontWeight: theme.typography.weight.regular,
});

globalStyle(`${qualityTable} td[data-tone="better"]`, {
  color: theme.color.status.ready,
});

globalStyle(`${qualityTable} td[data-tone="worse"]`, {
  color: theme.color.status.caution,
});

globalStyle(`${qualityTable} td[data-tone="neutral"]`, {
  color: theme.color.foreground.secondary,
});

export const diagnosticsList = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing["2"],
      minHeight: 0,
      overflow: "auto",
    },
  },
});

export const recommendationEvidence = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: theme.spacing["2"],
      borderLeft: `3px solid ${theme.color.status.ready}`,
      backgroundColor: theme.color.background.raised,
      padding: theme.spacing["2"],
    },
  },
});

export const comparisonToggle = style({
  "@layer": {
    [componentsLayer]: {
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
      minWidth: "14rem",
    },
  },
});

export const comparisonDeltaStrip = style({
  "@layer": {
    [componentsLayer]: {
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(8rem, 1fr))",
      gap: theme.spacing["2"],
      margin: 0,
      borderBottom: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
      backgroundColor: theme.color.background.base,
      padding: theme.spacing["2"],
      overflowX: "auto",
    },
  },
});

globalStyle(`${comparisonDeltaStrip} > div`, {
  display: "grid",
  gap: theme.spacing["1"],
  borderLeft: `3px solid ${theme.color.foreground.tertiary}`,
  backgroundColor: theme.color.background.raised,
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
});

globalStyle(`${comparisonDeltaStrip} > div[data-favored="original"]`, {
  borderLeftColor: theme.color.status.selected,
});

globalStyle(`${comparisonDeltaStrip} > div[data-favored="recommended"]`, {
  borderLeftColor: theme.color.status.ready,
});

globalStyle(`${comparisonDeltaStrip} dt`, {
  textTransform: "uppercase",
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

globalStyle(`${comparisonDeltaStrip} dd`, {
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing["2"],
  margin: 0,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

globalStyle(`${comparisonDeltaStrip} strong`, {
  marginLeft: "auto",
  textTransform: "uppercase",
  color: theme.color.foreground.primary,
  fontWeight: theme.typography.weight.semibold,
});

globalStyle(`${comparisonToggle} button`, {
  border: 0,
  borderRight: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
  backgroundColor: "transparent",
  cursor: "pointer",
  padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
  textTransform: "uppercase",
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

globalStyle(`${comparisonToggle} button:last-child`, {
  borderRight: 0,
});

globalStyle(`${comparisonToggle} button[data-active="true"]`, {
  backgroundColor: theme.color.interactive.primary,
  color: theme.color.background.base,
});

globalStyle(`${recommendationEvidence} p`, {
  margin: 0,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const diagnostic = style({
  "@layer": {
    [componentsLayer]: {
      display: "grid",
      gridTemplateColumns: "4.5rem minmax(0, 1fr)",
      gap: theme.spacing["2"],
      borderLeft: `3px solid ${theme.color.interactive.primary}`,
      backgroundColor: theme.color.background.raised,
      padding: theme.spacing["2"],

      selectors: {
        "&[data-severity=\"warning\"]": {
          borderLeftColor: theme.color.status.caution,
        },
        "&[data-severity=\"error\"]": {
          borderLeftColor: theme.color.status.critical,
        },
      },
    },
  },
});

globalStyle(`${diagnostic} > span`, {
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
  fontWeight: theme.typography.weight.bold,
});

globalStyle(`${diagnostic} p`, {
  margin: 0,
  overflowWrap: "anywhere",
  lineHeight: theme.typography.lineHeight.normal,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const emptyDiagnostics = style({
  "@layer": {
    [componentsLayer]: {
      margin: 0,
      color: theme.color.status.ready,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.sm,
    },
  },
});
