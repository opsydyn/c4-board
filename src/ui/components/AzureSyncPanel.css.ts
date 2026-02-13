import { style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";
import { formGroup, input, label, toolbarButton } from "./styles.css";

export const syncCard = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["3"],
  clipPath: theme.clipPath.lg,
  border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
  backgroundColor: "rgba(8, 14, 11, 0.92)",
  padding: theme.spacing["4"],
});

export const syncHeader = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["1"],
});

export const syncTitle = style({
  margin: 0,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.engineering,
  color: theme.color.interactive.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
  fontWeight: theme.typography.weight.bold,
});

export const syncMeta = style({
  margin: 0,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const syncStatusRow = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing["2"],
});

export const syncStatusBadge = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
  fontWeight: theme.typography.weight.bold,
});

export const syncStatusReady = style({
  borderColor: theme.color.status.ready,
  color: theme.color.status.ready,
});

export const syncStatusWarning = style({
  borderColor: theme.color.status.caution,
  color: theme.color.status.caution,
});

export const syncStatusCritical = style({
  borderColor: theme.color.status.critical,
  color: theme.color.status.critical,
});

export const syncForm = style({
  display: "grid",
  gap: theme.spacing["2"],
});

export const syncFormGroup = style([formGroup]);
export const syncLabel = style([label]);
export const syncInput = style([
  input,
  {
    fontSize: theme.typography.size.sm,
  },
]);

export const syncActions = style({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing["2"],
});

export const syncButton = style([
  toolbarButton,
  {
    justifyContent: "center",
    padding: `${theme.spacing["1"]} ${theme.spacing["3"]}`,
    fontSize: theme.typography.size.xs,

    selectors: {
      "&:disabled": {
        opacity: 0.5,
        boxShadow: "none",
        cursor: "not-allowed",
      },
    },
  },
]);

export const syncSummaryGrid = style({
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: theme.spacing["2"],
});

export const syncSummaryItem = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["1"],
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(11, 20, 16, 0.86)",
  padding: `${theme.spacing["2"]} ${theme.spacing["2"]}`,
});

export const syncSummaryLabel = style({
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const syncSummaryValue = style({
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.engineering,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
  fontWeight: theme.typography.weight.bold,
});

export const syncList = style({
  display: "grid",
  gap: theme.spacing["1"],
  margin: 0,
  paddingInlineStart: theme.spacing["4"],
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const syncError = style({
  margin: 0,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.status.critical,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const syncWarning = style({
  margin: 0,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.status.caution,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});
