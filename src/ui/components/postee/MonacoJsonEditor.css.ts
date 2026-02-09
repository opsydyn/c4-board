import { style, globalStyle } from "@vanilla-extract/css";
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
			gap: theme.spacing["3"],
			marginBottom: theme.spacing["4"],
			flexWrap: "wrap",
		},
	},
});

export const actionButton = style({
	"@layer": {
		[componentsLayer]: {
			display: "flex",
			alignItems: "center",
			gap: theme.spacing["3"],
			padding: `${theme.spacing["4"]} ${theme.spacing["6"]}`,
			fontSize: theme.typography.size.sm,
			fontFamily: theme.typography.family.mono,
			fontWeight: theme.typography.weight.medium,
			textTransform: theme.typography.textTransform.uppercase,
			letterSpacing: theme.typography.letterSpacing.wide,
			color: theme.color.semantic.person,
			backgroundColor: "transparent",
			border: `${theme.border.width.thin} ${theme.border.style.solid} ${theme.color.semantic.person}`,
			clipPath: theme.clipPath.sm,
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

// Monaco editor decorations for {{variables}}
globalStyle(".postee-variable-decoration", {
	backgroundColor: "rgba(165, 214, 167, 0.15)",
	borderRadius: "3px",
	border: "1px solid rgba(165, 214, 167, 0.3)",
	padding: "0 2px",
});

globalStyle(".postee-variable-icon::before", {
	content: '"$"',
	color: "#A5D6A7",
	fontWeight: "bold",
	marginRight: "2px",
	opacity: 0.7,
});
