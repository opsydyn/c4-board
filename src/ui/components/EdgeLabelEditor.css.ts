import { style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";
import { componentsLayer } from "../../styles/layers.css";

export const edgeEditorOverlay = style({
	"@layer": {
		[componentsLayer]: {
			position: "fixed",
			inset: 0,
			backgroundColor: "rgba(0, 0, 0, 0.5)",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			zIndex: 1000,
		},
	},
});

export const edgeEditorDialog = style({
	"@layer": {
		[componentsLayer]: {
			backgroundColor: theme.color.background.base,
			border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
			borderRadius: theme.border.radius.lg,
			padding: theme.spacing["6"],
			boxShadow: theme.effect.glow.lg,
			minWidth: "400px",
			maxWidth: "500px",
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["4"],
		},
	},
});

export const edgeEditorTitle = style({
	"@layer": {
		[componentsLayer]: {
			fontFamily: theme.typography.family.mono,
			fontSize: theme.typography.size.lg,
			textTransform: theme.typography.textTransform.uppercase,
			letterSpacing: theme.typography.letterSpacing.wide,
			color: theme.color.foreground.primary,
			margin: 0,
		},
	},
});

export const edgeEditorField = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			flexDirection: "column",
			gap: theme.spacing["2"],
		},
	},
});

export const edgeEditorLabel = style({
	"@layer": {
		[componentsLayer]: {
			fontFamily: theme.typography.family.mono,
			fontSize: theme.typography.size.xs,
			textTransform: theme.typography.textTransform.uppercase,
			letterSpacing: theme.typography.letterSpacing.wide,
			color: theme.color.foreground.secondary,
		},
	},
});

export const edgeEditorInput = style({
	"@layer": {
		[componentsLayer]: {
			width: "100%",
			height: "40px",
			borderRadius: theme.border.radius.base,
			border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
			backgroundColor: theme.color.background.input,
			color: theme.color.foreground.primary,
			padding: `0 ${theme.spacing["3"]}`,
			fontFamily: theme.typography.family.sans,
			fontSize: theme.typography.size.base,
			transition: theme.transition.base,

			selectors: {
				"&:focus": {
					outline: "none",
					borderColor: theme.color.border.primary,
					boxShadow: theme.effect.glow.sm,
				},
			},
		},
	},
});

export const edgeEditorHint = style({
	"@layer": {
		[componentsLayer]: {
			fontSize: theme.typography.size.sm,
			color: theme.color.foreground.tertiary,
			fontStyle: "italic",
		},
	},
});

export const edgeEditorError = style({
	"@layer": {
		[componentsLayer]: {
			padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
			borderRadius: theme.border.radius.base,
			backgroundColor: "rgba(220, 38, 38, 0.1)",
			border: `${theme.border.width.thin} solid ${theme.color.status.critical}`,
			color: theme.color.status.critical,
			fontSize: theme.typography.size.sm,
		},
	},
});

export const edgeEditorButtons = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			gap: theme.spacing["2"],
			justifyContent: "flex-end",
			marginTop: theme.spacing["2"],
		},
	},
});

export const edgeEditorButton = style({
	"@layer": {
		[componentsLayer]: {
			height: "40px",
			borderRadius: theme.border.radius.base,
			border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
			backgroundColor: "transparent",
			color: theme.color.foreground.primary,
			fontFamily: theme.typography.family.mono,
			fontSize: theme.typography.size.sm,
			textTransform: theme.typography.textTransform.uppercase,
			letterSpacing: theme.typography.letterSpacing.wide,
			padding: `0 ${theme.spacing["4"]}`,
			cursor: "pointer",
			transition: theme.transition.base,

			selectors: {
				"&:hover": {
					borderColor: theme.color.border.primary,
					backgroundColor: "rgba(20, 32, 26, 0.5)",
				},
			},
		},
	},
});

export const edgeEditorPrimaryButton = style([
	edgeEditorButton,
	{
		"@layer": {
			[componentsLayer]: {
				backgroundColor: theme.color.interactive.primary,
				borderColor: theme.color.interactive.primary,
				color: theme.color.background.base,

				selectors: {
					"&:disabled": {
						backgroundColor: theme.color.foreground.tertiary,
						borderColor: theme.color.foreground.tertiary,
						color: theme.color.background.surface,
						opacity: theme.opacity.disabled,
						cursor: "not-allowed",
					},
					"&:not(:disabled):hover": {
						boxShadow: theme.effect.glow.sm,
					},
				},
			},
		},
	},
]);
