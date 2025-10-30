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
	backgroundColor: theme.color.surface.overlay,
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
	backgroundColor: theme.color.surface.overlay,
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
			backgroundColor: theme.color.surface.elevated,
		},
	},
});

export const agGridTheme = style({
	display: "flex",
	flex: 1,
	flexDirection: "column",
	clipPath: theme.clipPath.lg,
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	backgroundColor: theme.color.surface.base,
	padding: theme.spacing["2"],
	width: "100%",
	height: "100%",
	minHeight: "520px",
});

globalStyle(`.${agGridTheme}.ag-theme-quartz`, {
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

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-root-wrapper`, {
	display: "flex",
	flex: 1,
	flexDirection: "column",
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
	borderBottom: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	backgroundColor: theme.color.surface.elevated,
	color: theme.color.foreground.primary,
	fontWeight: theme.typography.weight.medium,
});

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-floating-filter-input`, {
	borderColor: theme.color.border.secondary,
	backgroundColor: theme.color.surface.overlay,
	textTransform: theme.typography.textTransform.uppercase,
	color: theme.color.foreground.primary,
});

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-cell`, {
	textTransform: theme.typography.textTransform.uppercase,
	color: theme.color.foreground.primary,
});

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-header`, {
	color: theme.color.foreground.secondary,
});

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-overlay-loading-center`, {
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	backgroundColor: theme.color.surface.base,
	textTransform: theme.typography.textTransform.uppercase,
	color: theme.color.foreground.primary,
});

export const errorAlert = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["3"],
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.base} solid ${theme.color.status.critical}`,
	boxShadow: `0 0 12px ${theme.color.status.critical}40`,
	backgroundColor: theme.color.surface.overlay,
	padding: theme.spacing["4"],
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.base,
});

// Status Bar Styling
globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-status-bar`, {
	borderTop: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	backgroundColor: theme.color.surface.overlay,
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
});

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-status-name-value-value`, {
	color: theme.color.interactive.primary,
	fontWeight: theme.typography.weight.medium,
});

// Complexity-based row styling
globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-row.complexity-low`, {
	borderLeft: `${theme.border.width.thick} solid ${theme.color.status.ready}`,
	backgroundColor: `${theme.color.status.ready}08`,
});

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-row.complexity-medium`, {
	borderLeft: `${theme.border.width.thick} solid ${theme.color.status.caution}`,
	backgroundColor: `${theme.color.status.caution}08`,
});

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-row.complexity-high`, {
	borderLeft: `${theme.border.width.thick} solid ${theme.color.status.critical}`,
	backgroundColor: `${theme.color.status.critical}08`,
});

// Hover states for complexity rows
globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-row.complexity-low:hover`, {
	backgroundColor: `${theme.color.status.ready}12`,
});

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-row.complexity-medium:hover`, {
	backgroundColor: `${theme.color.status.caution}12`,
});

globalStyle(`.${agGridTheme}.ag-theme-quartz .ag-row.complexity-high:hover`, {
	backgroundColor: `${theme.color.status.critical}12`,
});
