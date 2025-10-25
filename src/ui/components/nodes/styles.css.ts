/**
 * C4 Node Styles
 *
 * Contract-based theming with CSS layers for proper cascade control.
 * Uses semantic design tokens for maintainability.
 */

import { style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";

/**
 * Base Node
 * Shared styles for all C4 diagram nodes
 */
const baseNode = style({
	// Layout
	display: "flex",
	flexDirection: "column",
	transition: theme.transition.base,
	clipPath: theme.clipPath.lg,
	border: `${theme.border.width.base} solid`,

	// Visual
	boxShadow: theme.effect.glow.base,
	backgroundColor: theme.color.background.surface,
	padding: `${theme.spacing["5"]} ${theme.spacing["4"]}`,
	minWidth: "220px",

	// Typography
	maxWidth: "320px",
	letterSpacing: theme.typography.letterSpacing.tight,
	fontFamily: theme.typography.family.mono,

	// Animation
	fontSize: theme.typography.size.base,

	selectors: {
		"&[data-selected='true']": {
			transform: "scale(1.03)",
			boxShadow: theme.effect.glow.xl,
		},
		"&:hover": {
			boxShadow: theme.effect.glow.md,
		},
	},
});

/**
 * Person Node
 * Represents human actors/users in the system
 */
export const personNode = style([
	baseNode,
	{
		borderColor: theme.color.border.person,
		backgroundColor: theme.color.surface.person,
	},
]);

export const personNodeIcon = style({
	display: "flex",
	justifyContent: "center",
	marginBottom: theme.spacing["2"],
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.person,
});

export const personNodeLabel = style({
	marginBottom: theme.spacing["2"],
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
});

export const personNodeTechnology = style({
	marginBottom: theme.spacing["1"],
	color: theme.color.foreground.tertiary,
	fontSize: theme.typography.size.sm,
});

export const personNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.sm,
});

/**
 * System Node
 * Represents software systems
 */
export const systemNode = style([
	baseNode,
	{
		borderColor: theme.color.border.system,
		backgroundColor: theme.color.surface.system,
	},
]);

export const systemNodeIcon = style({
	display: "flex",
	justifyContent: "center",
	marginBottom: theme.spacing["2"],
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.system,
});

export const systemNodeLabel = style({
	marginBottom: theme.spacing["2"],
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
});

export const systemNodeTechnology = style({
	marginBottom: theme.spacing["1"],
	color: theme.color.foreground.tertiary,
	fontSize: theme.typography.size.sm,
});

export const systemNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.sm,
});

/**
 * External System Node
 * Represents third-party/external systems
 */
export const externalSystemNode = style([
	baseNode,
	{
		borderStyle: "dashed",
		borderColor: theme.color.border.external,
		backgroundColor: theme.color.surface.external,
	},
]);

export const externalSystemNodeIcon = style({
	display: "flex",
	justifyContent: "center",
	marginBottom: theme.spacing["2"],
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.external,
});

export const externalSystemNodeLabel = style({
	marginBottom: theme.spacing["2"],
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
});

export const externalSystemNodeTechnology = style({
	marginBottom: theme.spacing["1"],
	color: theme.color.foreground.tertiary,
	fontSize: theme.typography.size.sm,
});

export const externalSystemNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.sm,
});

/**
 * Node Content Container
 * Wrapper for node content
 */
export const nodeContent = style({
	display: "flex",
	flexDirection: "column",
});
