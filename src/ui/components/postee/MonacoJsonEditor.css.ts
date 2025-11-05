import { style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";
import { componentsLayer } from "../../../styles/layers.css";

export const monacoEditorContainer = style({
	"@layer": {
		[componentsLayer]: {
			width: "100%",
			position: "relative",
		},
	},
});

export const monacoEditorWrapper = style({
	"@layer": {
		[componentsLayer]: {
			clipPath: theme.clipPath.base,
			border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
			backgroundColor: theme.color.background.surface,
			overflow: "hidden",

			// Monaco editor specific overrides
			":focus-within": {
				borderColor: theme.color.border.focus,
				boxShadow: theme.effect.glow.sm,
			},
		},
	},
});

export const actionBar = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			gap: theme.spacing["2"],
			marginBottom: theme.spacing["2"],
			flexWrap: "wrap",
		},
	},
});

export const actionButton = style({
	"@layer": {
		[componentsLayer]: {
			padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
			fontSize: theme.typography.size.xs,
			fontFamily: theme.typography.family.mono,
			fontWeight: theme.typography.weight.medium,
			textTransform: theme.typography.textTransform.uppercase,
			letterSpacing: theme.typography.letterSpacing.wide,
			color: theme.color.semantic.person,
			backgroundColor: "transparent",
			border: `${theme.border.width.thin} ${theme.border.style.solid} ${theme.color.semantic.person}`,
			borderRadius: theme.border.radius.sm,
			cursor: "pointer",
			transition: theme.transition.base,
			":hover": {
				backgroundColor: theme.color.semantic.person,
				color: theme.color.background.base,
				boxShadow: theme.effect.glow.sm,
			},
			":active": {
				transform: "translateY(1px)",
			},
		},
	},
});
