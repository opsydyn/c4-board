import { globalStyle, style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";

export const historyPanel = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["3"],
	width: "100%",
	minWidth: 0,
	flex: 1,
	color: theme.color.foreground.primary,
});

export const historyHeader = style({
	display: "flex",
	justifyContent: "space-between",
	alignItems: "center",
	flexWrap: "wrap",
	gap: theme.spacing["3"],
});

export const toolbarActions = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["3"],
	flexWrap: "wrap",
});

export const historyTitle = style({
	margin: 0,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
});

export const quickFilter = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: theme.color.surface.overlay,
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	color: theme.color.foreground.primary,
});

export const quickFilterInput = style({
	outline: "none",
	border: "none",
	backgroundColor: "transparent",
	minWidth: "180px",
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
});

globalStyle(`${quickFilterInput}::placeholder`, {
	textTransform: theme.typography.textTransform.uppercase,
	color: theme.color.foreground.tertiary,
});

export const gridWrapper = style({
	display: "flex",
	flex: 1,
	flexDirection: "column",
	clipPath: theme.clipPath.lg,
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	backgroundColor: theme.color.surface.base,
	padding: theme.spacing["2"],
	width: "100%",
	minWidth: 0,
	height: "600px",
});

globalStyle(`.${gridWrapper}.ag-theme-quartz`, {
	vars: {
		"--ag-font-family": theme.typography.family.mono,
		"--ag-font-size": theme.typography.size.sm,
		"--ag-background-color": theme.color.surface.base,
		"--ag-foreground-color": theme.color.foreground.secondary,
		"--ag-border-color": theme.color.border.secondary,
		"--ag-header-background-color": theme.color.surface.overlay,
		"--ag-header-foreground-color": theme.color.foreground.secondary,
		"--ag-odd-row-background-color": theme.color.background.surface,
		"--ag-row-hover-color": theme.color.background.raised,
		"--ag-selected-row-background-color": `${theme.color.status.selected}33`,
		"--ag-control-panel-background-color": theme.color.surface.overlay,
	},
});

globalStyle(`.${gridWrapper}.ag-theme-quartz .ag-root-wrapper`, {
	display: "flex",
	flex: 1,
	flexDirection: "column",
	clipPath: theme.clipPath.lg,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	boxShadow: theme.effect.glow.sm,
});

globalStyle(`.${gridWrapper}.ag-theme-quartz .ag-header-cell`, {
	borderColor: theme.color.border.secondary,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.secondary,
});

globalStyle(`.${gridWrapper}.ag-theme-quartz .ag-row`, {
	borderColor: theme.color.border.secondary,
});

globalStyle(`.${gridWrapper}.ag-theme-quartz .ag-row.ag-row-focus`, {
	outline: `${theme.border.width.thin} solid ${theme.color.border.focus}`,
});

globalStyle(`.${gridWrapper}.ag-theme-quartz .ag-floating-filter-input`, {
	borderColor: theme.color.border.secondary,
	backgroundColor: theme.color.surface.overlay,
	textTransform: theme.typography.textTransform.uppercase,
	color: theme.color.foreground.primary,
});

globalStyle(`.${gridWrapper}.ag-theme-quartz .ag-cell`, {
	textTransform: theme.typography.textTransform.uppercase,
	color: theme.color.foreground.primary,
});

globalStyle(`.${gridWrapper}.ag-theme-quartz .ag-virtual-list-viewport`, {
	backgroundColor: theme.color.surface.overlay,
});

export const viewButton = style({
	padding: `${theme.spacing["1"]} ${theme.spacing["3"]}`,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	clipPath: theme.clipPath.sm,
	backgroundColor: theme.color.background.raised,
	color: theme.color.foreground.primary,
	cursor: "pointer",
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	transition: theme.transition.base,
	boxShadow: theme.effect.glow.sm,

	":hover": {
		backgroundColor: theme.color.surface.overlay,
		borderColor: theme.color.status.selected,
		boxShadow: `0 0 12px ${theme.color.status.selected}44`,
	},

	":active": {
		transform: "translateY(1px)",
	},
});

export const actionButton = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	clipPath: theme.clipPath.sm,
	backgroundColor: theme.color.background.raised,
	color: theme.color.foreground.primary,
	cursor: "pointer",
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	transition: theme.transition.base,
	boxShadow: theme.effect.glow.sm,

	":hover": {
		backgroundColor: theme.color.surface.overlay,
		borderColor: theme.color.interactive.primary,
		boxShadow: `0 0 12px ${theme.color.interactive.primary}44`,
	},

	":active": {
		transform: "translateY(1px)",
	},
});

