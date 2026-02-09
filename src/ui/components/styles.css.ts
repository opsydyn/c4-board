/**
 * UI Component Styles
 *
 * Contract-based theming with semantic design tokens.
 */

import { style, globalStyle, keyframes } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";

/**
 * Workspace Layout
 * Responsive shell that hosts sidebar, canvas, and details panel.
 */
export const workspace = style({
	display: "grid",
	gridTemplateRows: "1fr",
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
	gridColumn: "1 / 2",
	gap: theme.spacing["4"],
	borderRight: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(9, 16, 13, 0.92)",
	padding: `${theme.spacing["5"]} ${theme.spacing["4"]}`,
	overflowX: "hidden",
	overflowY: "auto",
});

export const sidebarBrand = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	marginBottom: theme.spacing["3"],
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
});

export const sidebarTagline = style({
	margin: `0 0 ${theme.spacing["2"]}`,
	color: theme.color.foreground.tertiary,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
});

export const sidebarQuickActions = style({
	display: "flex",
	alignItems: "stretch",
	gap: theme.spacing["2"],
	marginBottom: theme.spacing["2"],
	width: "100%",
});

export const sidebarBrandIcon = style({
	display: "block",
	flexShrink: 0,
	clipPath: theme.clipPath.sm,
	boxShadow: theme.effect.glow.sm,
	// width: "50px",
	// height: "50px",
});

export const canvasStack = style({
	position: "relative",
	display: "flex",
	flex: 1,
	flexDirection: "column",
	minHeight: 0,
});

export const commandBar = style({
	position: "relative",
	zIndex: theme.zIndex.sticky,
	display: "flex",
	flexDirection: "column",
	alignItems: "stretch",
	gap: theme.spacing["2"],
	clipPath: theme.clipPath.md,
	margin: `${theme.spacing["5"]} ${theme.spacing["5"]} ${theme.spacing["3"]}`,
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	boxShadow: theme.effect.glow.sm,
	backgroundColor: "rgba(8, 14, 11, 0.95)",
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	minHeight: 200,
});

export const commandBarRow = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	width: "100%",
});

export const commandBarLeft = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
});

export const commandBarRight = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	marginLeft: "auto",
});

export const commandBarSearch = style({
	display: "flex",
	alignItems: "center",
	minWidth: "280px",
	width: "100%",
});

export const canvasRegion = style({
	position: "relative",
	display: "flex",
	flex: 1,
	flexDirection: "column",
	gridColumn: "2 / 3",
	minWidth: 0,
	minHeight: 0,
	overflow: "hidden",
});

export const detailsColumn = style({
	display: "flex",
	flexDirection: "column",
	gridColumn: "3 / 4",
	gap: theme.spacing["4"],
	borderLeft: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(10, 18, 14, 0.96)",
	padding: `${theme.spacing["5"]} ${theme.spacing["4"]}`,
	overflowX: "hidden",
	overflowY: "auto",

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
	flex: 1,
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
	minHeight: 0,
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

export const commandBarButton = style([
	toolbarButton,
	{
		borderColor: theme.color.border.primary,
		boxShadow: "none",
		backgroundColor: "rgba(14, 22, 18, 0.95)",
	},
]);


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

export const sidebarQuickActionLink = style([
	toolbarLink,
	{
		flex: 1,
		justifyContent: "center",
		padding: `${theme.spacing["2"]} ${theme.spacing["2"]}`,
		fontSize: theme.typography.size.xs,
	},
]);

/**
 * Domain Toggle
 * Switch between C4 and DDD modeling modes
 */
export const domainToggle = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	backgroundColor: "rgba(9, 16, 13, 0.92)",
	padding: theme.spacing["2"],
	marginBottom: theme.spacing["3"],
	boxShadow: theme.effect.glow.sm,
});

export const domainToggleButton = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	flex: 1,
	transition: theme.transition.base,
	clipPath: theme.clipPath.sm,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "transparent",
	cursor: "pointer",
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	textTransform: "uppercase",
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.tertiary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	fontWeight: theme.typography.weight.semibold,

	selectors: {
		"&:hover": {
			borderColor: theme.color.border.primary,
			color: theme.color.foreground.secondary,
		},
	},
});

export const domainToggleActive = style({
	borderColor: theme.color.interactive.focus,
	backgroundColor: "rgba(136, 192, 208, 0.12)",
	boxShadow: theme.effect.glow.sm,
	color: theme.color.foreground.primary,

	selectors: {
		"&:hover": {
			borderColor: theme.color.interactive.focus,
			color: theme.color.foreground.primary,
		},
	},
});

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
	transition: theme.transition.base,
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	backgroundColor: "rgba(13, 23, 18, 0.95)",
	cursor: "pointer",
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,

	selectors: {
		"&:hover": {
			boxShadow: theme.effect.glow.sm,
			backgroundColor: "rgba(16, 28, 22, 0.98)",
		},
	},
});

export const collapseHandleLeft = style({
	position: "fixed",
	zIndex: theme.zIndex.overlay,
	top: "50%",
	left: theme.spacing["3"],
	display: "inline-flex",
	alignItems: "center",
	gap: theme.spacing["1"],
	transform: "translateY(-50%)",
	transition: theme.transition.base,
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	backgroundColor: "rgba(13, 23, 18, 0.95)",
	cursor: "pointer",
	padding: `${theme.spacing["2"]} ${theme.spacing["2"]}`,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	boxShadow: theme.effect.glow.md,

	selectors: {
		"&:hover": {
			boxShadow: theme.effect.glow.lg,
			backgroundColor: "rgba(16, 28, 22, 0.98)",
			borderColor: theme.color.status.selected,
		},
	},
});

export const collapseHandleRight = style({
	position: "absolute",
	zIndex: theme.zIndex.overlay,
	top: "50%",
	right: theme.spacing["4"],
	display: "inline-flex",
	alignItems: "center",
	gap: theme.spacing["1"],
	transform: "translate(50%, -50%)",
	transition: theme.transition.base,
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	backgroundColor: "rgba(13, 23, 18, 0.95)",
	cursor: "pointer",
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,

	selectors: {
		"&:hover": {
			boxShadow: theme.effect.glow.sm,
			backgroundColor: "rgba(16, 28, 22, 0.98)",
		},
	},
});

export const commandBarToggle = style([
	collapseToggle,
	{
		position: "static",
	},
]);

export const commandBarHandle = style([
	collapseToggle,
	{
		position: "absolute",
		zIndex: theme.zIndex.overlay,
		top: theme.spacing["5"],
		left: "50%",
		display: "inline-flex",
		alignItems: "center",
		gap: theme.spacing["1"],
		transform: "translate(-50%, 0)",
	},
]);

export const bottomPanel = style({
	display: "flex",
	flexDirection: "column",
	gridRow: "2 / 3",
	gridColumn: "1 / -1",
	gap: theme.spacing["3"],
	clipPath: theme.clipPath.lg,
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	boxShadow: theme.effect.glow.md,
	backgroundColor: "rgba(8, 14, 11, 0.96)",
	padding: `${theme.spacing["4"]} ${theme.spacing["5"]} ${theme.spacing["5"]}`,
	minHeight: 0,
	overflow: "hidden",
});

export const bottomPanelHeader = style({
	display: "flex",
	flexWrap: "wrap",
	alignItems: "center",
	justifyContent: "space-between",
	gap: theme.spacing["3"],
});

export const bottomTabs = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
});

export const bottomTabButton = style({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	gap: theme.spacing["1"],
	transition: theme.transition.base,
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(12, 20, 16, 0.92)",
	cursor: "pointer",
	padding: `${theme.spacing["1"]} ${theme.spacing["3"]}`,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,

	selectors: {
		"&:hover": {
			borderColor: theme.color.border.primary,
			boxShadow: theme.effect.glow.sm,
		},
	},
});

export const bottomTabButtonActive = style({
	borderColor: theme.color.border.primary,
	boxShadow: theme.effect.glow.sm,
	backgroundColor: "rgba(18, 30, 24, 0.98)",
	color: theme.color.interactive.primary,
});

export const bottomPanelContent = style({
	display: "flex",
	flex: 1,
	alignItems: "stretch",
	width: "100%",
	minHeight: "520px",
	overflow: "hidden",
});

globalStyle(`${bottomPanelContent} > *`, {
	flex: 1,
	minWidth: 0,
});

export const bottomHandle = style([
	collapseToggle,
	{
		position: "absolute",
		zIndex: theme.zIndex.overlay,
		bottom: theme.spacing["4"],
		left: "50%",
		transform: "translate(-50%, 0)",
	},
]);

const navigationScan = keyframes({
	"0%": {
		transform: "translateY(-110%)",
	},
	"100%": {
		transform: "translateY(110%)",
	},
});

const navigationPulse = keyframes({
	"0%, 100%": {
		boxShadow:
			"0 0 18px rgba(58, 224, 173, 0.28), inset 0 0 20px rgba(58, 224, 173, 0.14)",
	},
	"50%": {
		boxShadow:
			"0 0 30px rgba(58, 224, 173, 0.42), inset 0 0 28px rgba(58, 224, 173, 0.22)",
	},
});

export const navigationOverlay = style({
	position: "fixed",
	zIndex: theme.zIndex.modal,
	inset: 0,
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	padding: theme.spacing["6"],
	background:
		"radial-gradient(130% 130% at 50% 24%, rgba(22, 33, 31, 0.95) 0%, rgba(5, 8, 6, 0.98) 65%, rgba(1, 3, 2, 1) 100%)",
});

export const navigationOverlayCard = style({
	position: "relative",
	width: "min(520px, 92vw)",
	overflow: "hidden",
	border: `${theme.border.width.base} solid rgba(58, 224, 173, 0.44)`,
	backgroundColor: "rgba(8, 18, 16, 0.93)",
	padding: `${theme.spacing["6"]} ${theme.spacing["5"]}`,
	clipPath: theme.clipPath.md,
	animation: `${navigationPulse} 1.6s ease-in-out infinite`,
});

globalStyle(`${navigationOverlayCard}::after`, {
	content: '""',
	position: "absolute",
	inset: 0,
	pointerEvents: "none",
	backgroundImage:
		"linear-gradient(transparent 0, rgba(0, 0, 0, 0.08) 50%, transparent 100%)",
	backgroundSize: "100% 3px",
	opacity: "0.4",
});

export const navigationOverlayScanline = style({
	position: "absolute",
	top: 0,
	left: 0,
	width: "100%",
	height: "100%",
	pointerEvents: "none",
	mixBlendMode: "screen",
	opacity: 0.35,
	background:
		"linear-gradient(0deg, transparent 0%, rgba(58, 224, 173, 0.24) 45%, rgba(58, 224, 173, 0.34) 50%, rgba(58, 224, 173, 0.24) 55%, transparent 100%)",

	"@media": {
		"(prefers-reduced-motion: no-preference)": {
			animation: `${navigationScan} 3s linear infinite`,
		},
	},
});

export const navigationOverlayTitle = style({
	position: "relative",
	zIndex: 1,
	margin: 0,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.md,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: "#5ce0c4",
	textShadow: "0 0 8px rgba(92, 224, 196, 0.55)",
});

export const navigationOverlayStep = style({
	position: "relative",
	zIndex: 1,
	margin: `${theme.spacing["4"]} 0 ${theme.spacing["2"]}`,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.secondary,
});

export const navigationOverlayTarget = style({
	position: "relative",
	zIndex: 1,
	margin: 0,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: "#b6ffc8",
});

export const historyPlaceholder = style({
	display: "flex",
	flex: 1,
	alignItems: "center",
	justifyContent: "center",
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
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

/**
 * Balanced Mud Chart
 * Visualizes coupling risk and volatility using visx primitives.
 */
const mudPulse = keyframes({
	"0%": { transform: "scale(0.98)", strokeOpacity: 0.2 },
	"50%": { transform: "scale(1.05)", strokeOpacity: 0.5 },
	"100%": { transform: "scale(0.98)", strokeOpacity: 0.2 },
});

const criticalGlow = (percentage: number) =>
	`color-mix(in srgb, ${theme.color.status.critical} ${percentage}%, transparent)`;

const criticalPulse = keyframes({
	"0%": {
		backgroundColor: criticalGlow(15),
		boxShadow: `0 0 8px ${criticalGlow(35)}`,
	},
	"50%": {
		backgroundColor: criticalGlow(30),
		boxShadow: `0 0 16px ${criticalGlow(60)}`,
	},
	"100%": {
		backgroundColor: criticalGlow(15),
		boxShadow: `0 0 8px ${criticalGlow(35)}`,
	},
});

export const mudChartCard = style({
	boxSizing: "border-box",
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["4"],
	clipPath: theme.clipPath.lg,
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	boxShadow: theme.effect.glow.sm,
	backgroundColor: "rgba(8, 14, 11, 0.92)",
	padding: theme.spacing["4"],
	width: "100%",
});

export const mudChartHeader = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["1"],
});

export const mudChartTitle = style({
	margin: 0,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.engineering,
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
	fontWeight: theme.typography.weight.bold,
});

export const mudChartMeta = style({
	margin: 0,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
});

export const mudChartCanvas = style({
	boxSizing: "border-box",
	contain: "layout style paint",
	position: "relative",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	willChange: "auto",
	clipPath: theme.clipPath.lg,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(6, 11, 8, 0.9)",
	padding: theme.spacing["2"],
	width: "100%",
	// FIX: Prevent layout shifts on hover
	height: "clamp(260px, 32vh, 360px)", // CSS containment for stability
	overflow: "hidden", // Reset any inherited will-change
});

globalStyle(`${mudChartCanvas} svg`, {
	display: "block",
	pointerEvents: "auto",
	width: "100%",
	// FIX: Prevent SVG from causing reflow
	height: "100%", // Remove inline spacing
	maxHeight: "100%", // Ensure SVG receives events (not the tooltip)
});

// FIX: Ensure ParentSize div doesn't cause layout shifts
globalStyle(`${mudChartCanvas} > div`, {
	position: "absolute",
	top: 0,
	right: 0, // FIX: Remove from flexbox flow to prevent resize
	bottom: 0,
	left: 0,
	pointerEvents: "none",
	width: "100%",
	height: "100%", // FIX: Let events pass through wrapper
});

// FIX: Let SVG receive pointer events (override parent)
globalStyle(`${mudChartCanvas} > div > svg`, {
	pointerEvents: "auto", // Override parent's pointer-events: none
});

export const mudChartPulse = style({
	transformOrigin: "center",
	animation: `${mudPulse} 6s ease-in-out infinite`,
});

export const mudChartEmptyState = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	padding: theme.spacing["4"],
	minHeight: "200px",
	textAlign: "center",
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
});

export const mudChartCriticalWarning = style({
	width: "100%",
	clipPath: theme.clipPath.base,
	display: "flex",
	// flexWrap: "wrap",
	alignItems: "flex-end",
	justifyContent: "space-between",
	gap: theme.spacing["2"],
	rowGap: theme.spacing["2"],
	padding: theme.spacing["3"],
	textAlign: "left",
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.status.critical,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
	fontWeight: theme.typography.weight.bold,
	border: `${theme.border.width.base} solid ${theme.color.status.critical}`,
	animation: `${criticalPulse} 2s ease-in-out infinite`,
});


export const mudChartCriticalWarningSvg = style({
    width: "55%",
	height: "33%",
	display: "flex",
	alignItems: "flex-end",
	justifyContent: "flex-end",
	// animation: `${criticalPulse} 2s ease-in-out infinite`,
});

export const mudChartCriticalAnimationPaused = style({
	animationPlayState: "paused",
});

export const mudChartCriticalControls = style({
	width: "100%",
	display: "flex",
	flexDirection: "column",
	alignItems: "stretch",
	marginTop: theme.spacing["2"],
});

export const mudChartCriticalToggle = style({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	gap: theme.spacing["1"],
	boxShadow: theme.effect.glow.sm,
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(12, 21, 16, 0.95)",
	color: theme.color.foreground.primary,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	cursor: "pointer",
	whiteSpace: "nowrap",
	flexShrink: 0,
	transition: theme.transition.base,

	selectors: {
		"&:hover": {
			borderColor: theme.color.border.primary,
			color: theme.color.interactive.primary,
		},
		"&:focus-visible": {
			outline: `${theme.border.width.base} solid ${theme.color.interactive.focus}`,
			outlineOffset: "2px",
		},
	},
});

export const mudChartCriticalTogglePaused = style({
	borderColor: theme.color.status.ready,
	color: theme.color.status.ready,
});


export const mudChartSummaryGrid = style({
	boxSizing: "border-box",
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
	gap: theme.spacing["3"],
	width: "100%",
});

export const mudChartSummaryItem = style({
	boxSizing: "border-box",
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["1"],
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(10, 18, 14, 0.9)",
	padding: theme.spacing["3"],
});

export const mudChartSummaryLabel = style({
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.tertiary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
});

export const mudChartSummaryValue = style({
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
	fontWeight: theme.typography.weight.bold,
});

export const mudChartLegendRow = style({
	boxSizing: "border-box",
	display: "flex",
	flexWrap: "wrap",
	gap: theme.spacing["4"],
	borderTop: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	paddingTop: theme.spacing["2"],
	width: "100%",
});

export const mudChartLegendGroup = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["2"],
	minWidth: "220px",
});

globalStyle(`${mudChartLegendGroup} span`, {
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
});

export const mudChartLegendLabel = style({
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
});

export const mudChartTooltip = style({
	position: "absolute",
	zIndex: 10,
	right: 0,
	bottom: 0,
	left: 0,
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["1"],
	backdropFilter: "blur(4px)",
	borderTop: `1px solid ${theme.color.border.primary}`,
	background: "rgba(10, 18, 14, 0.92)",
	pointerEvents: "none",
	padding: "6px 12px",
	maxHeight: "60px",
	overflow: "hidden",
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.engineering,
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: "10px",
});

/**
 * Diagram Evolution Chart
 * Shows growth of nodes and edges over time.
 */
export const evolutionCard = style({
	boxSizing: "border-box",
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["3"],
	clipPath: theme.clipPath.lg,
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	boxShadow: theme.effect.glow.sm,
	backgroundColor: "rgba(6, 12, 10, 0.9)",
	padding: theme.spacing["4"],
	width: "100%",
});

export const evolutionHeader = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["1"],
});

export const evolutionTitle = style({
	margin: 0,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.engineering,
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
	fontWeight: theme.typography.weight.bold,
});

export const evolutionMeta = style({
	margin: 0,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
});

export const evolutionChart = style({
	boxSizing: "border-box",
	position: "relative",
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(5, 9, 7, 0.85)",
	padding: theme.spacing["2"],
	width: "100%",
	height: "clamp(200px, 28vh, 280px)",
	overflow: "hidden",
});

globalStyle(`${evolutionChart} svg`, {
	width: "100%",
	height: "100%",
});

export const evolutionLegend = style({
	display: "flex",
	flexWrap: "wrap",
	alignItems: "center",
	gap: theme.spacing["3"],
	borderTop: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	padding: `${theme.spacing["1"]} 0`,
});

export const evolutionLegendItem = style({
	display: "inline-flex",
	alignItems: "center",
	gap: theme.spacing["1"],
});

export const evolutionLegendSwatch = style({
	display: "inline-block",
	width: "10px",
	height: "10px",
});

export const evolutionLegendLabel = style({
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
});

export const evolutionSummaryGrid = style({
	boxSizing: "border-box",
	display: "grid",
	gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
	gap: theme.spacing["3"],
	width: "100%",
});

export const evolutionSummaryItem = style({
	boxSizing: "border-box",
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["1"],
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(8, 14, 11, 0.9)",
	padding: theme.spacing["3"],
});

export const evolutionSummaryLabel = style({
	display: "inline-flex",
	alignItems: "center",
	gap: theme.spacing["1"],
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.tertiary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
});

export const evolutionSummaryValue = style({
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
	fontWeight: theme.typography.weight.bold,
});

export const evolutionEmptyState = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	padding: theme.spacing["4"],
	minHeight: "160px",
	textAlign: "center",
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
});
