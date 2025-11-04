import { style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";
import { componentsLayer } from "../../styles/layers.css";

export const searchInputContainer = style({
	"@layer": {
		[componentsLayer]: {
			width: "100%",
		},
	},
});

export const searchInputWrapper = style({
	"@layer": {
		[componentsLayer]: {
			position: "relative",
			display: "flex",
			alignItems: "center",
			width: "100%",
		},
	},
});

export const searchIcon = style({
	"@layer": {
		[componentsLayer]: {
			position: "absolute",
			left: theme.spacing["3"],
			fontSize: theme.typography.size.sm,
			color: theme.color.foreground.secondary,
			pointerEvents: "none",
		},
	},
});

export const searchInputField = style({
	"@layer": {
		[componentsLayer]: {
			width: "100%",
			padding: `${theme.spacing["2"]} ${theme.spacing["10"]} ${theme.spacing["2"]} ${theme.spacing["8"]}`,
			backgroundColor: theme.color.background.input,
			border: `1px solid ${theme.color.border.secondary}`,
			borderRadius: theme.border.radius.md,
			color: theme.color.foreground.primary,
			fontSize: theme.typography.size.sm,
			fontFamily: theme.typography.family.sans,
			outline: "none",
			transition: "all 0.2s ease",

			"::placeholder": {
				color: theme.color.foreground.tertiary,
			},

			":focus": {
				borderColor: theme.color.interactive.primary,
				backgroundColor: theme.color.background.surface,
			},
		},
	},
});

export const clearButton = style({
	"@layer": {
		[componentsLayer]: {
			position: "absolute",
			right: theme.spacing["2"],
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			width: "24px",
			height: "24px",
			padding: 0,
			backgroundColor: "transparent",
			border: "none",
			borderRadius: theme.border.radius.md,
			color: theme.color.foreground.secondary,
			fontSize: theme.typography.size.sm,
			cursor: "pointer",
			transition: "all 0.2s ease",

			":hover": {
				backgroundColor: theme.color.background.inputFocus,
				color: theme.color.foreground.primary,
			},
		},
	},
});
