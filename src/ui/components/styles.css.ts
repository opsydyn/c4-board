/**
 * UI Component Styles
 *
 * Contract-based theming with semantic design tokens.
 */

import { style, globalStyle } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";

/**
 * Workspace Layout
 * Responsive shell that hosts sidebar, canvas, and details panel.
 */
export const workspace = style({
	display: "grid",
	gridTemplateRows: "100%",
	gridTemplateColumns: "minmax(260px, 320px) 1fr minmax(300px, 360px)",
	backgroundColor: theme.color.background.base,
	width: "100vw",
	height: "100vh",
	overflow: "hidden",
	color: theme.color.foreground.primary,

	"@media": {
		"(max-width: 1440px)": {
			gridTemplateColumns: "minmax(240px, 300px) 1fr minmax(280px, 340px)",
		},
		"(max-width: 1200px)": {
			gridTemplateColumns: "minmax(240px, 320px) 1fr",
		},
	},
});

export const sidebarColumn = style({
	display: "flex",
	flexDirection: "column",
	borderRight: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(9, 16, 13, 0.92)",
	padding: `${theme.spacing["5"]} ${theme.spacing["4"]}`,
	overflowX: "hidden",
	overflowY: "auto",
	gridColumn: "1 / 2",
	gap: theme.spacing["4"],
});

export const canvasRegion = style({
	position: "relative",
	display: "flex",
	flex: 1,
	flexDirection: "column",
	minWidth: 0,
	minHeight: 0,
	overflow: "hidden",
	gridColumn: "2 / 3",
});

export const detailsColumn = style({
	display: "flex",
	flexDirection: "column",
	borderLeft: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(10, 18, 14, 0.96)",
	padding: `${theme.spacing["5"]} ${theme.spacing["4"]}`,
	overflowX: "hidden",
	overflowY: "auto",
	gridColumn: "3 / 4",
	gap: theme.spacing["4"],

	"@media": {
		"(max-width: 1200px)": {
			display: "none",
		},
	},
});

/**
 * Canvas Container
 * Main viewport for the C4 diagram
 */
export const canvasContainer = style({
	position: "relative",
	isolation: "isolate",
	backgroundColor: theme.color.background.base,
	backgroundImage: `
		radial-gradient(115% 115% at 50% 55%, rgba(3, 25, 66, 0.35) 0%, rgba(6, 11, 8, 0.75) 70%),
		linear-gradient(${theme.color.grid} 1px, transparent 1px),
		linear-gradient(90deg, ${theme.color.grid} 1px, transparent 1px)
	`,
	backgroundPosition: "center",
	backgroundSize: "100% 100%, 24px 24px, 24px 24px",
	width: "100%",
	height: "100%",
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.mono,

	selectors: {
		"&::before": {
			position: "absolute",
			zIndex: theme.zIndex.base,
			inset: 0,
			opacity: theme.opacity.grid,
			mixBlendMode: "screen",
			backgroundImage:
				"linear-gradient(rgba(255, 255, 255, 0.015) 1px, transparent 1px)",
			backgroundSize: "100% 4px",
			pointerEvents: "none",
			content: '""',
		},
	},
});

/**
 * Toolbar
 * Vertical command stack for actions and metadata
 */
export const toolbar = style({
	position: "sticky",
	top: theme.spacing["5"],
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["2"],
	clipPath: theme.clipPath.md,
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	boxShadow: theme.effect.glow.sm,
	backgroundColor: "rgba(9, 16, 13, 0.92)",
	padding: theme.spacing["4"],
	width: "100%",
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
	borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	paddingBottom: theme.spacing["2"],
	color: theme.color.foreground.tertiary,
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
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.engineering,
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
	fontWeight: theme.typography.weight.bold,

	":focus": {
		textShadow: theme.effect.textGlow.sm,
		color: theme.color.interactive.hover,
	},

	"::placeholder": {
		textTransform: theme.typography.textTransform.uppercase,
		color: theme.color.foreground.tertiary,
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
	backgroundColor: "rgba(13, 23, 18, 0.95)",
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
			backgroundColor: "rgba(16, 28, 22, 0.98)",
			textShadow: theme.effect.textGlow.base,
		},
		"&:active": {
			transform: "scale(0.98)",
		},
	},
});

export const toolbarLink = style([
	toolbarButton,
	{
		borderColor: theme.color.interactive.primary,
		textDecoration: "none",
		color: theme.color.foreground.primary,

		selectors: {
			"&:hover": {
				textDecoration: "underline",
				color: theme.color.foreground.primary,
			},
		},
	},
]);

/**
 * Properties Panel
 * Sidebar for editing selected node properties
 */
export const propertiesPanel = style({
	position: "sticky",
	top: theme.spacing["5"],
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["4"],
	clipPath: theme.clipPath.lg,
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	boxShadow: theme.effect.glow.sm,
	backgroundColor: "rgba(10, 18, 14, 0.96)",
	padding: theme.spacing["5"],
	width: "100%",
	maxHeight: "calc(100vh - 80px)",
	overflowY: "auto",
});

export const panelHeader = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "flex-end",
	gap: theme.spacing["2"],
});

export const collapseToggle = style({
	display: "inline-flex",
	alignItems: "center",
	gap: theme.spacing["1"],
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	backgroundColor: "rgba(13, 23, 18, 0.95)",
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	clipPath: theme.clipPath.base,
	cursor: "pointer",
	transition: theme.transition.base,

	selectors: {
		"&:hover": {
			boxShadow: theme.effect.glow.sm,
			backgroundColor: "rgba(16, 28, 22, 0.98)",
		},
	},
});

export const collapseHandleLeft = style({
	display: "inline-flex",
	alignItems: "center",
	gap: theme.spacing["1"],
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	backgroundColor: "rgba(13, 23, 18, 0.95)",
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	position: "absolute",
	top: "50%",
	left: theme.spacing["4"],
	transform: "translate(-50%, -50%)",
	zIndex: theme.zIndex.overlay,
	clipPath: theme.clipPath.base,
	cursor: "pointer",
	transition: theme.transition.base,

	selectors: {
		"&:hover": {
			boxShadow: theme.effect.glow.sm,
			backgroundColor: "rgba(16, 28, 22, 0.98)",
		},
	},
});

export const collapseHandleRight = style({
	display: "inline-flex",
	alignItems: "center",
	gap: theme.spacing["1"],
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	backgroundColor: "rgba(13, 23, 18, 0.95)",
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	position: "absolute",
	top: "50%",
	right: theme.spacing["4"],
	transform: "translate(50%, -50%)",
	zIndex: theme.zIndex.overlay,
	clipPath: theme.clipPath.base,
	cursor: "pointer",
	transition: theme.transition.base,

	selectors: {
		"&:hover": {
			boxShadow: theme.effect.glow.sm,
			backgroundColor: "rgba(16, 28, 22, 0.98)",
		},
	},
});

/**
 * Panel Title
 * Heading for properties panel
 */
export const panelTitle = style({
	margin: 0,
	textTransform: "uppercase",
	textShadow: theme.effect.textGlow.sm,
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
	color: theme.color.foreground.secondary,
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
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(9, 18, 13, 0.92)",
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	color: theme.color.foreground.primary,
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
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(9, 18, 13, 0.92)",
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	minHeight: "120px",
	resize: "vertical",
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.primary,
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
	boxShadow: theme.effect.glow.base,
	backgroundColor: "rgba(11, 20, 16, 0.95)",
});

globalStyle(`${reactFlowControls} button`, {
	clipPath: theme.clipPath.sm,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(12, 21, 16, 0.95)",
	color: theme.color.interactive.primary,
});

globalStyle(`${reactFlowControls} button:hover`, {
	boxShadow: theme.effect.glow.sm,
	backgroundColor: "rgba(15, 26, 20, 0.98)",
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
