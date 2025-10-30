import { globalStyle, style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";

export const tableContainer = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["4"],
	height: "100%",
	color: theme.color.foreground.primary,
});

export const gridToolbar = style({
	display: "flex",
	flexWrap: "wrap",
	alignItems: "center",
	justifyContent: "space-between",
	gap: theme.spacing["3"],
});

export const toolbarTitle = style({
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
	backgroundColor: "rgba(13, 23, 18, 0.95)",
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	color: theme.color.foreground.primary,
});

export const quickFilterInput = style({
	outline: "none",
	border: "none",
	backgroundColor: "transparent",
	minWidth: "200px",
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
});

globalStyle(`${quickFilterInput}::placeholder`, {
    textTransform: theme.typography.textTransform.uppercase,
    color: theme.color.foreground.tertiary,
});

export const actionButton = style({
	transition: theme.transition.base,
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	backgroundColor: "rgba(13, 23, 18, 0.95)",
	cursor: "pointer",
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,

	selectors: {
		"&:hover": {
			boxShadow: theme.effect.glow.sm,
			backgroundColor: "rgba(16, 28, 22, 0.98)",
		},
	},
});

export const agGridTheme = style({
	flex: 1,
	clipPath: theme.clipPath.lg,
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	backgroundColor: "rgba(9, 16, 13, 0.92)",
	padding: theme.spacing["2"],
	minHeight: "520px",
	height: "100%",
	width: "100%",
});

globalStyle(`.${agGridTheme}.ag-theme-quartz`, {
	vars: {
		"--ag-font-family": theme.typography.family.mono,
		"--ag-font-size": theme.typography.size.sm,
		"--ag-background-color": "rgba(9, 16, 13, 0.92)",
		"--ag-foreground-color": theme.color.foreground.secondary,
		"--ag-border-color": theme.color.border.secondary,
		"--ag-header-background-color": "rgba(14, 24, 18, 0.95)",
		"--ag-header-foreground-color": theme.color.foreground.secondary,
		"--ag-odd-row-background-color": "rgba(12, 22, 17, 0.8)",
		"--ag-row-hover-color": "rgba(97, 163, 142, 0.18)",
		"--ag-selected-row-background-color": `${theme.color.status.selected}33`,
		"--ag-control-panel-background-color": "rgba(12, 22, 17, 0.95)",
	},
});

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-root-wrapper`, {
	clipPath: theme.clipPath.lg,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	boxShadow: theme.effect.glow.sm,
});

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-header-cell`, {
	borderColor: theme.color.border.secondary,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.secondary,
});

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-row`, {
	borderColor: theme.color.border.secondary,
});

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-row.ag-row-focus`, {
	outline: `${theme.border.width.thin} solid ${theme.color.border.focus}`,
});

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-pinned-row`, {
	background: "linear-gradient(90deg, rgba(111, 185, 169, 0.35) 0%, rgba(3, 25, 66, 0.25) 100%)",
	color: theme.color.foreground.primary,
});

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-floating-filter-input`, {
	borderColor: theme.color.border.secondary,
	backgroundColor: "rgba(13, 23, 18, 0.9)",
	color: theme.color.foreground.primary,
});

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-cell`, {
	color: theme.color.foreground.primary,
});

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-header`, {
	color: theme.color.foreground.secondary,
});

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-overlay-loading-center`, {
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	backgroundColor: "rgba(9, 16, 13, 0.92)",
	color: theme.color.foreground.primary,
});
