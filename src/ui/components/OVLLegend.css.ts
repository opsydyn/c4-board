/**
 * OVLLegend Styles - OPSYDYN Visual Language component
 *
 * Matches the aesthetic of BalancedMudChart with terminal-inspired design
 */

import { style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";
import { componentsLayer } from "../../styles/layers.css";

export const ovlLegendCard = style({
	"@layer": {
		[componentsLayer]: {
			backgroundColor: theme.color.background.surface,
			border: `1px solid ${theme.color.border.primary}`,
			borderRadius: "8px",
			padding: theme.spacing["4"],
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["4"],
			fontFamily: theme.typography.family.mono,
		},
	},
});

export const ovlLegendHeader = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["1"],
			borderBottom: `1px solid ${theme.color.border.secondary}`,
			paddingBottom: theme.spacing["3"],
		},
	},
});

export const ovlLegendTitle = style({
	"@layer": {
		[componentsLayer]: {
			fontSize: theme.typography.size.md,
			fontWeight: 700,
			color: theme.color.foreground.primary,
			letterSpacing: "0.5px",
			textTransform: "uppercase",
			margin: 0,
		},
	},
});

export const ovlLegendSubtitle = style({
	"@layer": {
		[componentsLayer]: {
			fontSize: theme.typography.size.xs,
			color: theme.color.foreground.tertiary,
			margin: 0,
			lineHeight: 1.4,
		},
	},
});

export const ovlLegendCanvas = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["6"],
		},
	},
});

export const ovlLegendSection = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["3"],
		},
	},
});

export const ovlLegendSectionTitle = style({
	"@layer": {
		[componentsLayer]: {
			fontSize: theme.typography.size.sm,
			fontWeight: 600,
			color: theme.color.foreground.secondary,
			margin: 0,
			letterSpacing: "0.3px",
			textTransform: "uppercase",
			borderLeft: `3px solid ${theme.color.interactive.primary}`,
			paddingLeft: theme.spacing["2"],
		},
	},
});

export const ovlLegendGrid = style({
	"@layer": {
		[componentsLayer]: {
			display: "grid",
			gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
			gap: theme.spacing["3"],
		},
	},
});

export const ovlLegendItem = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["1"],
			padding: theme.spacing["2"],
			backgroundColor: theme.color.background.base,
			border: `1px solid ${theme.color.border.secondary}`,
			borderRadius: "4px",
			transition: "all 0.2s ease",

			":hover": {
				borderColor: theme.color.interactive.primary,
				backgroundColor: theme.color.background.surface,
			},
		},
	},
});

export const ovlLegendLabel = style({
	"@layer": {
		[componentsLayer]: {
			fontSize: theme.typography.size.xs,
			color: theme.color.foreground.tertiary,
			fontFamily: theme.typography.family.mono,
		},
	},
});

export const ovlLegendRow = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			flexWrap: "wrap",
			gap: theme.spacing["2"],
		},
	},
});

export const ovlLegendGroup = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			gap: theme.spacing["2"],
			padding: theme.spacing["2"],
			backgroundColor: theme.color.background.base,
			border: `1px solid ${theme.color.border.secondary}`,
			borderRadius: "4px",
		},
	},
});
