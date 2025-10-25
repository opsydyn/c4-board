/**
 * C4 Node Styles
 *
 * Terminal/command-line aesthetic with:
 * - WCAG AAA contrast ratios (7:1 minimum)
 * - Slanted corners (retro terminal look)
 * - Green, blue, and amber color palette
 * - Monospace typography
 */

import { style } from "@vanilla-extract/css";
import { vars } from "../../../styles/theme.css";

const baseNode = style({
	transition: vars.transition.normal,
	clipPath: vars.clipPath.xlarge,
	border: `${vars.borderWidth.medium} solid`,
	boxShadow: vars.shadow.glow.large,
	backgroundColor: vars.color.background.primary,
	padding: `${vars.spacing["2xl"]} ${vars.spacing.xl}`,
	minWidth: "220px",
	maxWidth: "320px",
	letterSpacing: vars.font.letterSpacing.tight,
	fontFamily: vars.font.family.mono,
	fontSize: vars.font.size.base,

	selectors: {
		"&[data-selected='true']": {
			transform: "scale(1.03)",
			boxShadow: vars.shadow.glow.selected,
		},
		"&:hover": {
			boxShadow: vars.shadow.glow.hoverLarge,
		},
	},

	"@media": {
		"(prefers-color-scheme: light)": {
			clipPath: "none",
			borderRadius: vars.borderRadius.xl,
			boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
			backgroundColor: "white",
		},
	},
});

// Person Node - Cyan/Blue theme
export const personNode = style([
	baseNode,
	{
		borderColor: vars.color.border.cyan,
		backgroundColor: vars.color.node.person,
		"@media": {
			"(prefers-color-scheme: light)": {
				backgroundColor: "#E8F4F8",
			},
		},
	},
]);

export const personNodeIcon = style({
	display: "flex",
	justifyContent: "center",
	marginBottom: vars.spacing.md,
	textShadow: vars.shadow.textGlow.icon,
	color: vars.color.accent.cyan,
	"@media": {
		"(prefers-color-scheme: light)": {
			textShadow: "none",
			color: "#08427B",
		},
	},
});

export const personNodeLabel = style({
	marginBottom: vars.spacing.md,
	textTransform: "uppercase",
	textShadow: vars.shadow.textGlow.cyan,
	letterSpacing: vars.font.letterSpacing.wide,
	color: vars.color.text.primary,
	fontSize: vars.font.size.lg,
	fontWeight: vars.font.weight.bold,
	"@media": {
		"(prefers-color-scheme: light)": {
			textTransform: "none",
			textShadow: "none",
			color: "#08427B",
		},
	},
});

export const personNodeTechnology = style({
	marginBottom: vars.spacing.sm,
	color: vars.color.accent.teal,
	fontSize: vars.font.size.sm,
	fontStyle: "normal",
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#666",
			fontStyle: "italic",
		},
	},
});

export const personNodeDescription = style({
	marginTop: vars.spacing.md,
	lineHeight: vars.font.lineHeight.relaxed,
	color: vars.color.text.secondary,
	fontSize: vars.font.size.sm,
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#444",
		},
	},
});

// System Node - Green theme
export const systemNode = style([
	baseNode,
	{
		borderColor: vars.color.border.green,
		backgroundColor: vars.color.node.system,
		"@media": {
			"(prefers-color-scheme: light)": {
				backgroundColor: "#EBF3FA",
			},
		},
	},
]);

export const systemNodeIcon = style({
	display: "flex",
	justifyContent: "center",
	marginBottom: vars.spacing.md,
	textShadow: vars.shadow.textGlow.icon,
	color: vars.color.accent.green,
	"@media": {
		"(prefers-color-scheme: light)": {
			textShadow: "none",
			color: "#1168BD",
		},
	},
});

export const systemNodeLabel = style({
	marginBottom: vars.spacing.md,
	textTransform: "uppercase",
	textShadow: vars.shadow.textGlow.green,
	letterSpacing: vars.font.letterSpacing.wide,
	color: vars.color.text.primary,
	fontSize: vars.font.size.lg,
	fontWeight: vars.font.weight.bold,
	"@media": {
		"(prefers-color-scheme: light)": {
			textTransform: "none",
			textShadow: "none",
			color: "#1168BD",
		},
	},
});

export const systemNodeTechnology = style({
	marginBottom: vars.spacing.sm,
	color: vars.color.accent.darkGreen,
	fontSize: vars.font.size.sm,
	fontStyle: "normal",
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#666",
			fontStyle: "italic",
		},
	},
});

export const systemNodeDescription = style({
	marginTop: vars.spacing.md,
	lineHeight: vars.font.lineHeight.relaxed,
	color: vars.color.text.secondary,
	fontSize: vars.font.size.sm,
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#444",
		},
	},
});

// External System Node - Amber/Orange theme
export const externalSystemNode = style([
	baseNode,
	{
		borderStyle: "dashed",
		borderColor: vars.color.border.amber,
		backgroundColor: vars.color.node.external,
		"@media": {
			"(prefers-color-scheme: light)": {
				backgroundColor: "#F5F5F5",
			},
		},
	},
]);

export const externalSystemNodeIcon = style({
	display: "flex",
	justifyContent: "center",
	marginBottom: vars.spacing.md,
	textShadow: vars.shadow.textGlow.icon,
	color: vars.color.accent.amber,
	"@media": {
		"(prefers-color-scheme: light)": {
			textShadow: "none",
			color: "#999999",
		},
	},
});

export const externalSystemNodeLabel = style({
	marginBottom: vars.spacing.md,
	textTransform: "uppercase",
	textShadow: vars.shadow.textGlow.amber,
	letterSpacing: vars.font.letterSpacing.wide,
	color: vars.color.text.primary,
	fontSize: vars.font.size.lg,
	fontWeight: vars.font.weight.bold,
	"@media": {
		"(prefers-color-scheme: light)": {
			textTransform: "none",
			textShadow: "none",
			color: "#666",
		},
	},
});

export const externalSystemNodeTechnology = style({
	marginBottom: vars.spacing.sm,
	color: vars.color.accent.darkAmber,
	fontSize: vars.font.size.sm,
	fontStyle: "normal",
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#888",
			fontStyle: "italic",
		},
	},
});

export const externalSystemNodeDescription = style({
	marginTop: vars.spacing.md,
	lineHeight: vars.font.lineHeight.relaxed,
	color: vars.color.text.secondary,
	fontSize: vars.font.size.sm,
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#555",
		},
	},
});

export const nodeContent = style({
	display: "flex",
	flexDirection: "column",
});
