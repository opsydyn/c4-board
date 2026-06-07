import { globalStyle, style } from "@vanilla-extract/css";
import { theme } from "../styles/theme.css";

export const pageShell = style({
	display: "grid",
	gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
	minHeight: "100vh",
	backgroundColor: theme.color.background.base,
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
	padding: `${theme.spacing["5"]} ${theme.spacing["4"]}`,
	borderRight: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(9, 16, 13, 0.92)",

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
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	clipPath: theme.clipPath.sm,
	border: `${theme.border.width.thin} solid ${theme.color.interactive.primary}`,
	backgroundColor: "rgba(13, 23, 18, 0.95)",
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
});

export const sidebarTagline = style({
	margin: 0,
	color: theme.color.foreground.tertiary,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
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
	alignItems: "center",
	justifyContent: "center",
	flex: 1,
	transition: theme.transition.base,
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.interactive.primary}`,
	backgroundColor: "rgba(13, 23, 18, 0.95)",
	padding: `${theme.spacing["2"]} ${theme.spacing["2"]}`,
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	fontWeight: theme.typography.weight.bold,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	textDecoration: "none",

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
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	borderLeft: `${theme.border.width.base} solid ${theme.color.border.secondary}`,
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	textDecoration: "none",

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
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size["2xl"],
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.primary,
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
	padding: `${theme.spacing["4"]} ${theme.spacing["4"]}`,
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	clipPath: theme.clipPath.md,
	backgroundColor: "rgba(10, 18, 14, 0.95)",
	boxShadow: theme.effect.glow.sm,
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
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.md,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.primary,
});

export const settingsCardDescription = style({
	margin: 0,
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.sans,
	fontSize: theme.typography.size.sm,
	lineHeight: 1.5,
});

export const settingsRow = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: theme.spacing["2"],
	padding: `${theme.spacing["2"]} ${theme.spacing["2"]}`,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(12, 20, 16, 0.82)",
});

export const settingsRowLabel = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["1"],
	fontFamily: theme.typography.family.sans,
	fontSize: theme.typography.size.sm,
	color: theme.color.foreground.primary,
});

export const settingsRowHint = style({
	color: theme.color.foreground.tertiary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
});

export const settingsRowValue = style({
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(9, 16, 13, 0.9)",
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
});

export const settingsStatusBar = style({
	display: "flex",
	alignItems: "center",
	flexWrap: "wrap",
	gap: theme.spacing["2"],
});

export const settingsStatusBadge = style({
	display: "inline-flex",
	alignItems: "center",
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(9, 16, 13, 0.9)",
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
});

export const settingsStatusLoading = style({
	borderColor: theme.color.border.secondary,
	color: theme.color.foreground.tertiary,
});

export const settingsStatusSaving = style({
	borderColor: theme.color.status.caution,
	color: theme.color.status.caution,
	boxShadow: `0 0 10px ${theme.color.status.caution}33`,
});

export const settingsStatusSaved = style({
	borderColor: theme.color.status.ready,
	color: theme.color.status.ready,
	boxShadow: `0 0 10px ${theme.color.status.ready}33`,
});

export const settingsStatusDrift = style({
	borderColor: theme.color.status.caution,
	color: theme.color.status.caution,
	boxShadow: `0 0 10px ${theme.color.status.caution}33`,
});

export const settingsStatusError = style({
	borderColor: theme.color.status.critical,
	color: theme.color.status.critical,
	boxShadow: `0 0 10px ${theme.color.status.critical}33`,
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
	minHeight: "240px",
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	clipPath: theme.clipPath.md,
	backgroundColor: "rgba(10, 18, 14, 0.95)",
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
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
	minWidth: "4.75rem",
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(9, 16, 13, 0.92)",
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	fontWeight: theme.typography.weight.bold,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	cursor: "pointer",
	transition: theme.transition.base,

	selectors: {
		"&[data-active='true']": {
			borderColor: theme.color.interactive.primary,
			color: theme.color.foreground.primary,
			boxShadow: theme.effect.glow.sm,
			backgroundColor: "rgba(16, 30, 22, 0.95)",
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
	width: "8rem",
	minWidth: "8rem",
	height: "1.25rem",
	padding: 0,
	border: "none",
	backgroundColor: "transparent",
	appearance: "none",
	WebkitAppearance: "none",
	cursor: "pointer",

	selectors: {
		"&:focus-visible": {
			outline: "none",
		},
	},
});

globalStyle(`${settingsRangeControl}::-webkit-slider-runnable-track`, {
	height: "0.375rem",
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(9, 16, 13, 0.92)",
	boxShadow: `inset 0 0 0 1px ${theme.color.grid}`,
});

globalStyle(`${settingsRangeControl}::-webkit-slider-thumb`, {
	WebkitAppearance: "none",
	width: "0.9rem",
	height: "0.9rem",
	marginTop: "-0.3rem",
	border: `${theme.border.width.thin} solid ${theme.color.status.selected}`,
	backgroundColor: theme.color.status.selected,
	boxShadow: `0 0 8px ${theme.color.status.selected}66`,
	cursor: "pointer",
});

globalStyle(`${settingsRangeControl}::-moz-range-track`, {
	height: "0.375rem",
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(9, 16, 13, 0.92)",
	boxShadow: `inset 0 0 0 1px ${theme.color.grid}`,
});

globalStyle(`${settingsRangeControl}::-moz-range-progress`, {
	height: "0.375rem",
	backgroundColor: theme.color.status.selected,
	boxShadow: `0 0 8px ${theme.color.status.selected}44`,
});

globalStyle(`${settingsRangeControl}::-moz-range-thumb`, {
	width: "0.9rem",
	height: "0.9rem",
	border: `${theme.border.width.thin} solid ${theme.color.status.selected}`,
	backgroundColor: theme.color.status.selected,
	boxShadow: `0 0 8px ${theme.color.status.selected}66`,
	cursor: "pointer",
});

export const settingsRangeValue = style({
	minWidth: "3rem",
	textAlign: "right",
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
});

export const settingsInlineActions = style({
	display: "inline-flex",
	alignItems: "center",
	flexWrap: "wrap",
	gap: theme.spacing["2"],
});

export const settingsActionButton = style({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(9, 16, 13, 0.92)",
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	cursor: "pointer",
	transition: theme.transition.base,

	selectors: {
		"&:hover": {
			borderColor: theme.color.interactive.primary,
			color: theme.color.foreground.primary,
			boxShadow: theme.effect.glow.sm,
		},
		"&:disabled": {
			opacity: 0.45,
			cursor: "not-allowed",
			boxShadow: "none",
		},
	},
});

export const settingsActionButtonDanger = style({
	borderColor: theme.color.status.critical,
	color: theme.color.status.critical,
	backgroundColor: "rgba(40, 14, 16, 0.72)",
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
	padding: `${theme.spacing["2"]} ${theme.spacing["2"]}`,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(12, 20, 16, 0.82)",
});

export const settingsMetricLabel = style({
	color: theme.color.foreground.tertiary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
});

export const settingsMetricValue = style({
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
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
	padding: `${theme.spacing["3"]} ${theme.spacing["3"]}`,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(12, 20, 16, 0.82)",
});

export const settingsAuditEntryHeader = style({
	display: "flex",
	alignItems: "flex-start",
	justifyContent: "space-between",
	gap: theme.spacing["2"],
	flexWrap: "wrap",
});

export const settingsAuditEntryTitle = style({
	margin: 0,
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
});

export const settingsAuditEntryMeta = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	flexWrap: "wrap",
});

export const settingsAuditEntryBody = style({
	margin: 0,
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.sans,
	fontSize: theme.typography.size.sm,
	lineHeight: 1.5,
});
