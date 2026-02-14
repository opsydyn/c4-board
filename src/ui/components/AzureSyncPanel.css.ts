import { style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";
import { formGroup, input, label, toolbarButton } from "./styles.css";

const telemetryTintStrength = "16%";
const telemetryCountTintStrength = "24%";

export const syncCard = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["3"],
  clipPath: theme.clipPath.lg,
  border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
  backgroundColor: theme.color.surface.base,
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
        opacity: theme.opacity.disabled,
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
  backgroundColor: theme.color.surface.elevated,
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

export const telemetryBadgeRow = style({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing["1"],
});

export const telemetryBadge = style({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing["1"],
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: theme.color.background.input,
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
  fontWeight: theme.typography.weight.medium,
});

export const telemetryBadgeCount = style({
  borderLeft: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  paddingLeft: theme.spacing["1"],
  color: theme.color.foreground.primary,
  fontWeight: theme.typography.weight.bold,
});

export const telemetryBadgeReady = style({
  borderColor: theme.color.status.ready,
  backgroundColor:
    `color-mix(in srgb, ${theme.color.status.ready} ${telemetryTintStrength}, ${theme.color.surface.base})`,
  color: theme.color.status.ready,
});

export const telemetryBadgeCaution = style({
  borderColor: theme.color.status.caution,
  backgroundColor:
    `color-mix(in srgb, ${theme.color.status.caution} ${telemetryTintStrength}, ${theme.color.surface.base})`,
  color: theme.color.status.caution,
});

export const telemetryBadgeCritical = style({
  borderColor: theme.color.status.critical,
  backgroundColor:
    `color-mix(in srgb, ${theme.color.status.critical} ${telemetryTintStrength}, ${theme.color.surface.base})`,
  color: theme.color.status.critical,
});

export const telemetryBadgeSelected = style({
  borderColor: theme.color.status.selected,
  backgroundColor:
    `color-mix(in srgb, ${theme.color.status.selected} ${telemetryTintStrength}, ${theme.color.surface.base})`,
  color: theme.color.status.selected,
});

export const telemetryBadgeCountReady = style({
  borderColor: theme.color.status.ready,
  backgroundColor: `color-mix(in srgb, ${theme.color.status.ready} ${telemetryCountTintStrength}, transparent)`,
});

export const telemetryBadgeCountCaution = style({
  borderColor: theme.color.status.caution,
  backgroundColor: `color-mix(in srgb, ${theme.color.status.caution} ${telemetryCountTintStrength}, transparent)`,
});

export const telemetryBadgeCountCritical = style({
  borderColor: theme.color.status.critical,
  backgroundColor: `color-mix(in srgb, ${theme.color.status.critical} ${telemetryCountTintStrength}, transparent)`,
});

export const telemetryBadgeCountSelected = style({
  borderColor: theme.color.status.selected,
  backgroundColor: `color-mix(in srgb, ${theme.color.status.selected} ${telemetryCountTintStrength}, transparent)`,
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
