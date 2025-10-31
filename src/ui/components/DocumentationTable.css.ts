/**
 * DocumentationTable Styles
 *
 * Blue-themed table for system documentation (inspired by reference design)
 */

import { globalStyle, style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";

export const docTableContainer = style({
	display: "flex",
	flexDirection: "column",
	marginBottom: theme.spacing["6"],
	flex: 1,
	width: "100%",
	minWidth: 0,
	color: theme.color.foreground.primary,
});

export const docGridTheme = style({
	clipPath: theme.clipPath.lg,
	border: `${theme.border.width.base} solid ${theme.color.status.selected}`,
	backgroundColor: theme.color.surface.base,
	padding: theme.spacing["2"],
	width: "100%",
	minHeight: "auto",
});

// Blue theme overrides for documentation table
// Note: ag-Grid CSS vars need full rgba() values, not hex alpha
globalStyle(`${docGridTheme}.ag-theme-quartz`, {
	vars: {
		"--ag-font-family": theme.typography.family.mono,
		"--ag-font-size": theme.typography.size.sm,
		"--ag-background-color": "rgba(9, 16, 13, 0.92)",
		"--ag-foreground-color": theme.color.foreground.primary,
		"--ag-border-color": "rgba(110, 168, 254, 0.3)",
		// Blue row backgrounds (main styling)
		"--ag-row-background-color": "rgba(110, 168, 254, 0.12)",
		"--ag-odd-row-background-color": "rgba(110, 168, 254, 0.15)",
		"--ag-row-hover-color": "rgba(110, 168, 254, 0.25)",
		// Blue headers
		"--ag-header-background-color": "rgba(110, 168, 254, 0.2)",
		"--ag-header-foreground-color": theme.color.status.selected,
	},
});

globalStyle(`${docGridTheme}.ag-theme-quartz .ag-root-wrapper`, {
	clipPath: theme.clipPath.lg,
	border: `${theme.border.width.thin} solid ${theme.color.status.selected}`,
	boxShadow: `0 0 12px ${theme.color.status.selected}30`,
});

globalStyle(`${docGridTheme}.ag-theme-quartz .ag-header-cell`, {
	borderColor: theme.color.status.selected,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.status.selected,
	fontWeight: theme.typography.weight.semibold,
});

globalStyle(`${docGridTheme}.ag-theme-quartz .ag-row`, {
	borderBottom: `${theme.border.width.thin} solid rgba(110, 168, 254, 0.2)`,
});

globalStyle(`${docGridTheme}.ag-theme-quartz .ag-cell`, {
	color: theme.color.foreground.primary,
	textTransform: theme.typography.textTransform.uppercase,
});

// Shortcut column styling (like CMD/A in reference)
globalStyle(`${docGridTheme}.ag-theme-quartz .ag-cell[col-id="shortcut"]`, {
	color: theme.color.status.selected,
	fontWeight: theme.typography.weight.bold,
	textAlign: "center",
});
