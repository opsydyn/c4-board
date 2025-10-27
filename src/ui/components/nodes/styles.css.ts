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
	border: `${theme.border.width.thin} solid`,

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
			boxShadow: `0 0 20px ${theme.color.status.selected}99, 0 0 40px ${theme.color.status.selected}66`,
			borderColor: theme.color.status.selected,
			borderWidth: theme.border.width.base,
			backgroundColor: theme.color.background.raised,
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
 * Component Node
 * Represents components within containers
 */
export const componentNode = style([
	baseNode,
	{
		borderColor: theme.color.border.component,
		backgroundColor: theme.color.surface.component,
		padding: `${theme.spacing["4"]} ${theme.spacing["3"]}`,
		minWidth: "180px",
		maxWidth: "260px",
	},
]);

export const componentNodeIcon = style({
	display: "flex",
	justifyContent: "center",
	marginBottom: theme.spacing["2"],
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.component,
});

export const componentNodeLabel = style({
	marginBottom: theme.spacing["2"],
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.base,
	fontWeight: theme.typography.weight.bold,
});

export const componentNodeTechnology = style({
	marginBottom: theme.spacing["1"],
	color: theme.color.foreground.tertiary,
	fontSize: theme.typography.size.xs,
});

export const componentNodeDescription = style({
	marginTop: theme.spacing["2"],
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	fontSize: theme.typography.size.xs,
});

/**
 * Container Node (Resizable Group)
 * Represents containers (apps, databases) that can contain components
 */
export const containerNode = style({
	// Layout - transparent background to show children
	position: "relative",
	display: "flex",
	flexDirection: "column",
	transition: theme.transition.base,
	border: `${theme.border.width.base} dashed`,
	borderRadius: theme.border.radius.none, // ANGULAR - no rounding
	clipPath: theme.clipPath.lg, // Angled corners
	borderColor: theme.color.border.container,

	// Visual - dashed border to indicate grouping
	backgroundColor: theme.color.surface.container,
	padding: theme.spacing["4"],
	width: "100%",
	minWidth: "200px",
	height: "100%",

	// Animation
	minHeight: "150px",

	selectors: {
		"&[data-selected='true']": {
			borderColor: theme.color.status.selected,
			borderWidth: theme.border.width.base,
			boxShadow: `0 0 20px ${theme.color.status.selected}99, 0 0 40px ${theme.color.status.selected}66`,
			backgroundColor: theme.color.surface.containerSelected,
		},
		"&:hover": {
			borderColor: theme.color.interactive.hover,
		},
	},
});

export const containerNodeHeader = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	marginBottom: theme.spacing["3"],
	borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	paddingBottom: theme.spacing["2"],
});

export const containerNodeIcon = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	textShadow: theme.effect.textGlow.md,
	color: theme.color.semantic.container,
});

export const containerNodeLabel = style({
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
});

export const containerNodeTechnology = style({
	marginTop: theme.spacing["1"],
	color: theme.color.foreground.tertiary,
	fontSize: theme.typography.size.sm,
});

export const containerNodeDescription = style({
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
