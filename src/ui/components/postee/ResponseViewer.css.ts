import { style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";
import { componentsLayer } from "../../../styles/layers.css";

export const responseViewerContainer = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["3"],
			backgroundColor: theme.color.background.surface,
			border: `1px solid ${theme.color.border.secondary}`,
			clipPath: theme.clipPath.base,
			padding: theme.spacing["4"],
		},
	},
});

export const responseViewerHeader = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			gap: theme.spacing["4"],
			flexWrap: "wrap",
			fontSize: theme.typography.size.sm,
			color: theme.color.foreground.secondary,
			paddingBottom: theme.spacing["3"],
			borderBottom: `1px solid ${theme.color.border.secondary}`,
		},
	},
});

export const responseViewerContent = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["2"],
		},
	},
});

export const toggleButton = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			gap: theme.spacing["2"],
			padding: `${theme.spacing["2"]} 0`,
			backgroundColor: "transparent",
			border: "none",
			color: theme.color.foreground.primary,
			fontSize: theme.typography.size.sm,
			cursor: "pointer",
			textAlign: "left",
			transition: "color 0.2s ease",

			":hover": {
				color: theme.color.interactive.primary,
			},
		},
	},
});

export const baselineButton = style({
	"@layer": {
		[componentsLayer]: {
			padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
			fontSize: theme.typography.size.xs,
			background: "transparent",
			color: "#88C0D0",
			border: "1px solid #88C0D0",
			clipPath: theme.clipPath.sm,
			cursor: "pointer",
			fontFamily: theme.typography.family.mono,
			textTransform: theme.typography.textTransform.uppercase,
			transition: theme.transition.fast,

			":hover": {
				backgroundColor: "rgba(136, 192, 208, 0.1)",
				boxShadow: theme.effect.glow.sm,
			},
		},
	},
});

export const baselineButtonActive = style({
	"@layer": {
		[componentsLayer]: {
			padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
			fontSize: theme.typography.size.xs,
			background: "#88C0D0",
			color: "#0a0a0a",
			border: "1px solid #88C0D0",
			clipPath: theme.clipPath.sm,
			cursor: "pointer",
			fontFamily: theme.typography.family.mono,
			textTransform: theme.typography.textTransform.uppercase,
			transition: theme.transition.fast,

			":hover": {
				backgroundColor: "#9fd8e8",
				boxShadow: theme.effect.glow.sm,
			},
		},
	},
});

export const clearButton = style({
	"@layer": {
		[componentsLayer]: {
			padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
			fontSize: theme.typography.size.xs,
			background: "transparent",
			color: theme.color.status.critical,
			border: `1px solid ${theme.color.status.critical}`,
			clipPath: theme.clipPath.sm,
			cursor: "pointer",
			fontFamily: theme.typography.family.mono,
			textTransform: theme.typography.textTransform.uppercase,
			transition: theme.transition.fast,

			":hover": {
				backgroundColor: "rgba(255, 107, 107, 0.1)",
				boxShadow: theme.effect.glow.sm,
			},
		},
	},
});
