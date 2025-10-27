/**
 * UI Component Styles
 *
 * Contract-based theming with semantic design tokens.
 */

import { style, globalStyle } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";

/**
 * Canvas Container
 * Main viewport for the C4 diagram
 */
export const canvasContainer = style({
	backgroundColor: theme.color.background.base,
	backgroundImage: `
		linear-gradient(${theme.color.grid} 1px, transparent 1px),
		linear-gradient(90deg, ${theme.color.grid} 1px, transparent 1px)
	`,
	backgroundSize: "20px 20px", // Grid spacing - 20px tactical grid
	width: "100vw",
	height: "100vh",
	fontFamily: theme.typography.family.mono,
});

/**
 * Toolbar
 * Floating action panel for adding elements
 */
export const toolbar = style({
	position: "fixed",
	zIndex: theme.zIndex.overlay,
	top: theme.spacing["5"],
	left: theme.spacing["5"],
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["2"],
	clipPath: theme.clipPath.md,
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	boxShadow: theme.effect.glow.lg,
	backgroundColor: theme.color.background.base,
	padding: theme.spacing["3"],
});

/**
 * Save Status
 * Shows diagram name and save status
 */
export const saveStatus = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["1"],
	marginBottom: theme.spacing["2"],
	borderBottom: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	paddingBottom: theme.spacing["2"],
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
});

globalStyle(`${saveStatus} strong`, {
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.sm,
	fontWeight: theme.typography.weight.bold,
});

globalStyle(`${saveStatus} div`, {
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["1"],
});

globalStyle(`${saveStatus} svg`, {
	color: theme.color.interactive.primary,
});

/**
 * Board Name Input
 * Editable input for board/diagram name
 */
export const boardNameInput = style({
	outline: "none",
	border: "none",
	backgroundColor: "transparent",
	cursor: "text",
	padding: `${theme.spacing["1"]} 0`,
	width: "100%",
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.mono, // MONOSPACE
	fontSize: theme.typography.size.sm,
	fontWeight: theme.typography.weight.bold,
	textTransform: theme.typography.textTransform.uppercase, // UPPERCASE
	letterSpacing: theme.typography.letterSpacing.engineering, // TACTICAL

	":focus": {
		color: theme.color.status.ready, // Tactical green on focus
		textShadow: theme.effect.textGlow.sm, // Subtle glow
	},

	"::placeholder": {
		color: theme.color.foreground.tertiary,
		textTransform: theme.typography.textTransform.uppercase,
	},
});

/**
 * Toolbar Button
 * Action buttons in the toolbar
 */
export const toolbarButton = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	transition: theme.transition.base,
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	backgroundColor: theme.color.background.base,
	cursor: "pointer",
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	textTransform: "uppercase",
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
	fontWeight: theme.typography.weight.bold,

	selectors: {
		"&:hover": {
			boxShadow: theme.effect.glow.base,
			backgroundColor: theme.color.background.raised,
			textShadow: theme.effect.textGlow.sm,
		},
		"&:active": {
			transform: "scale(0.98)",
		},
	},
});

/**
 * Properties Panel
 * Sidebar for editing selected node properties
 */
export const propertiesPanel = style({
	position: "fixed",
	zIndex: theme.zIndex.overlay,
	top: theme.spacing["5"],
	right: theme.spacing["5"],
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["4"],
	clipPath: theme.clipPath.lg,
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	boxShadow: theme.effect.glow.lg,
	backgroundColor: theme.color.background.base,
	padding: theme.spacing["5"],
	width: "320px",
});

/**
 * Panel Title
 * Heading for properties panel
 */
export const panelTitle = style({
	margin: 0,
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.base,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.md,
	fontWeight: theme.typography.weight.bold,
});

/**
 * Form Group
 * Container for label + input pairs
 */
export const formGroup = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["1"],
});

/**
 * Label
 * Form field labels
 */
export const label = style({
	textTransform: "uppercase",
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.tertiary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	fontWeight: theme.typography.weight.bold,
});

/**
 * Input
 * Text input fields
 */
export const input = style({
	transition: theme.transition.base,
	clipPath: theme.clipPath.sm,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	backgroundColor: theme.color.background.input,
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.base,

	selectors: {
		"&:focus": {
			outline: "none",
			borderColor: theme.color.border.focus,
			boxShadow: theme.effect.glow.sm,
			backgroundColor: theme.color.background.inputFocus,
		},
	},
});

/**
 * Textarea
 * Multi-line text input
 */
export const textarea = style({
	transition: theme.transition.base,
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	backgroundColor: theme.color.background.input,
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	minHeight: "100px",
	resize: "vertical",
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.base,

	selectors: {
		"&:focus": {
			outline: "none",
			borderColor: theme.color.border.focus,
			boxShadow: theme.effect.glow.sm,
			backgroundColor: theme.color.background.inputFocus,
		},
	},
});

/**
 * ReactFlow Controls
 * Zoom/pan controls for the canvas
 */
export const reactFlowControls = style({
	clipPath: theme.clipPath.md,
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	boxShadow: theme.effect.glow.lg,
	backgroundColor: theme.color.background.base,
});

// ReactFlow Controls button styles (must use globalStyle for child selectors)
globalStyle(`${reactFlowControls} button`, {
	clipPath: theme.clipPath.sm,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	borderBottom: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	backgroundColor: theme.color.background.base,
});

globalStyle(`${reactFlowControls} button:hover`, {
	boxShadow: theme.effect.glow.base,
	backgroundColor: theme.color.background.raised,
});

globalStyle(`${reactFlowControls} button svg`, {
	filter: theme.effect.dropShadow,
	fill: theme.color.interactive.primary,
});

/**
 * ReactFlow Background
 * Grid pattern styles (global selectors for ReactFlow classes)
 */
globalStyle(".react-flow__background", {
	backgroundColor: theme.color.background.base,
});

globalStyle(".react-flow__background-pattern", {
	opacity: theme.opacity.grid,
	stroke: theme.color.border.primary,
});
