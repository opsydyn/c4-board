/**
 * OVLLegend Styles - OPSYDYN Visual Language component
 *
 * Matches the aesthetic of BalancedMudChart with terminal-inspired design
 * Uses @vanilla-extract/css-utils for dynamic, constraint-based calculations
 */

import { style } from "@vanilla-extract/css";
import { calc } from "@vanilla-extract/css-utils";
import { theme } from "../../styles/theme.css";
import { componentsLayer } from "../../styles/layers.css";

export const ovlLegendCard = style({
	"@layer": {
		[componentsLayer]: {
			clipPath: theme.clipPath.base,
			backgroundColor: theme.color.background.surface,
			border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
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
			flexDirection: "row",
			alignItems: "flex-start",
			justifyContent: "space-between",
			gap: theme.spacing["3"],
			borderBottom: `1px solid ${theme.color.border.secondary}`,
			paddingBottom: theme.spacing["3"],
		},
	},
});

export const ovlLegendHeaderText = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["1"],
			flex: 1,
		},
	},
});

export const ovlLegendToggleButton = style({
	"@layer": {
		[componentsLayer]: {
			clipPath: theme.clipPath.sm,
			display: "flex",
			alignItems: "center",
			gap: theme.spacing["1"],
			padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
			backgroundColor: theme.color.background.raised,
			border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
			color: theme.color.foreground.secondary,
			fontFamily: theme.typography.family.mono,
			fontSize: theme.typography.size.xs,
			textTransform: theme.typography.textTransform.uppercase,
			letterSpacing: theme.typography.letterSpacing.wide,
			cursor: "pointer",
			transition: `all ${theme.transition.base}`,

			":hover": {
				backgroundColor: theme.color.background.surface,
				borderColor: theme.color.interactive.primary,
				color: theme.color.interactive.primary,
				boxShadow: theme.effect.glow.sm,
			},
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
			borderLeft: `${calc.multiply(theme.border.width.base, 1.5)} solid ${theme.color.interactive.primary}`,
			paddingLeft: theme.spacing["2"],
			transition: `all ${theme.transition.base}`,
			position: "relative",

			":hover": {
				color: theme.color.foreground.primary,
			},
		},
	},
});

export const ovlLegendGrid = style({
	"@layer": {
		[componentsLayer]: {
			display: "grid",
			// Dynamic grid with calc-based minimum column width
			gridTemplateColumns: `repeat(auto-fit, minmax(${calc.multiply(theme.spacing["16"], 3)}, 1fr))`,
			gap: theme.spacing["3"],
			// Smooth layout shifts
			transition: `gap ${theme.transition.base}`,
		},
	},
});

export const ovlLegendItem = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["1"],
			clipPath: theme.clipPath.sm,
			padding: theme.spacing["2"],
			backgroundColor: theme.color.background.base,
			border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
			transition: `all ${theme.transition.base}`,
			position: "relative",
			overflow: "hidden",

			// Subtle lift effect on hover using calc
			":hover": {
				borderColor: theme.color.interactive.primary,
				backgroundColor: theme.color.background.surface,
				transform: `translateY(${calc.negate(theme.spacing["1"])})`,
				boxShadow: theme.effect.glow.sm,
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

export const ovlLegendBadge = style({
	"@layer": {
		[componentsLayer]: {
			clipPath: theme.clipPath.sm,
			fontSize: theme.typography.size.xs,
			color: theme.color.foreground.secondary,
			fontFamily: theme.typography.family.mono,
			backgroundColor: theme.color.background.raised,
			border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
			// Calc-based padding for precise vertical rhythm
			padding: `${calc.divide(theme.spacing["2"], 2)} ${theme.spacing["2"]}`,
			display: "inline-block",
			transition: `all ${theme.transition.base}`,
			position: "relative",

			":hover": {
				color: theme.color.foreground.primary,
				borderColor: theme.color.interactive.primary,
				// Subtle scale using calc
				transform: "scale(1.02)",
				boxShadow: theme.effect.glow.sm,
			},
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
			// Dynamic gap using calc for responsive spacing
			gap: calc.add(theme.spacing["2"], theme.spacing["1"]),
			clipPath: theme.clipPath.sm,
			padding: theme.spacing["2"],
			backgroundColor: theme.color.background.base,
			border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
			transition: `all ${theme.transition.base}`,

			":hover": {
				backgroundColor: theme.color.background.surface,
				borderColor: theme.color.interactive.primary,
				// Subtle expand on hover
				gap: calc.multiply(theme.spacing["2"], 2),
			},
		},
	},
});

export const ovlLegendCompact = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["3"],
			padding: theme.spacing["2"],
		},
	},
});

export const ovlLegendCompactRow = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			gap: theme.spacing["3"],
			flexWrap: "wrap",
		},
	},
});

export const ovlLegendCompactLabel = style({
	"@layer": {
		[componentsLayer]: {
			fontFamily: theme.typography.family.mono,
			fontSize: theme.typography.size.xs,
			color: theme.color.foreground.tertiary,
			textTransform: theme.typography.textTransform.uppercase,
			letterSpacing: theme.typography.letterSpacing.wide,
			minWidth: "80px",
		},
	},
});
