/**
 * Component Styles
 * Using theme tokens for maintainability
 */

import { style } from "@vanilla-extract/css";
import { vars } from "../../styles/theme.css";

export const canvasContainer = style({
	backgroundColor: vars.color.background.primary,
	width: "100vw",
	height: "100vh",
	fontFamily: vars.font.family.mono,
	"@media": {
		"(prefers-color-scheme: light)": {
			backgroundColor: "#f8f9fa",
			fontFamily: vars.font.family.sans,
		},
	},
});

export const toolbar = style({
	position: "fixed",
	zIndex: Number(vars.zIndex.overlay),
	top: vars.spacing["2xl"],
	left: vars.spacing["2xl"],
	display: "flex",
	flexDirection: "column",
	gap: vars.spacing.md,
	clipPath: vars.clipPath.large,
	border: `${vars.borderWidth.medium} solid ${vars.color.border.primary}`,
	boxShadow: vars.shadow.glow.xlarge,
	backgroundColor: vars.color.background.primary,
	padding: vars.spacing.lg,
	"@media": {
		"(prefers-color-scheme: light)": {
			clipPath: "none",
			borderRadius: vars.borderRadius.xl,
			borderColor: "#e0e0e0",
			boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
			backgroundColor: "white",
		},
	},
});

export const toolbarButton = style({
	display: "flex",
	alignItems: "center",
	gap: vars.spacing.md,
	transition: vars.transition.normal,
	clipPath: vars.clipPath.medium,
	border: `${vars.borderWidth.thin} solid ${vars.color.border.primary}`,
	backgroundColor: vars.color.background.primary,
	cursor: "pointer",
	padding: `${vars.spacing.md} ${vars.spacing.md}`,
	textTransform: "uppercase",
	letterSpacing: vars.font.letterSpacing.normal,
	color: vars.color.text.accent,
	fontFamily: vars.font.family.mono,
	fontSize: vars.font.size.sm,
	fontWeight: vars.font.weight.bold,
	":hover": {
		borderColor: vars.color.border.primary,
		boxShadow: vars.shadow.glow.hover,
		backgroundColor: vars.color.background.tertiary,
		textShadow: vars.shadow.textGlow.hover,
	},
	":active": {
		transform: "scale(0.98)",
	},
	"@media": {
		"(prefers-color-scheme: light)": {
			clipPath: "none",
			borderRadius: vars.borderRadius.lg,
			borderColor: "#ddd",
			backgroundColor: "white",
			textTransform: "none",
			color: "#333",
			fontFamily: vars.font.family.sans,
			":hover": {
				borderColor: "#999",
				boxShadow: "none",
				backgroundColor: "#f0f0f0",
				textShadow: "none",
			},
		},
	},
});

export const propertiesPanel = style({
	position: "fixed",
	zIndex: Number(vars.zIndex.overlay),
	top: vars.spacing["2xl"],
	right: vars.spacing["2xl"],
	display: "flex",
	flexDirection: "column",
	gap: vars.spacing.xl,
	clipPath: vars.clipPath.xlarge,
	border: `${vars.borderWidth.medium} solid ${vars.color.border.primary}`,
	boxShadow: vars.shadow.glow.xlarge,
	backgroundColor: vars.color.background.primary,
	padding: vars.spacing["2xl"],
	width: "320px",
	"@media": {
		"(prefers-color-scheme: light)": {
			clipPath: "none",
			borderRadius: vars.borderRadius.xl,
			borderColor: "#e0e0e0",
			boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
			backgroundColor: "white",
		},
	},
});

export const panelTitle = style({
	margin: 0,
	textTransform: "uppercase",
	textShadow: vars.shadow.textGlow.medium,
	letterSpacing: vars.font.letterSpacing.wide,
	color: vars.color.text.accent,
	fontFamily: vars.font.family.mono,
	fontSize: vars.font.size.md,
	fontWeight: vars.font.weight.bold,
	"@media": {
		"(prefers-color-scheme: light)": {
			textTransform: "none",
			textShadow: "none",
			color: "#333",
			fontFamily: vars.font.family.sans,
		},
	},
});

export const formGroup = style({
	display: "flex",
	flexDirection: "column",
	gap: vars.spacing.sm,
});

export const label = style({
	textTransform: "uppercase",
	letterSpacing: vars.font.letterSpacing.normal,
	color: vars.color.accent.darkGreen,
	fontFamily: vars.font.family.mono,
	fontSize: vars.font.size.xs,
	fontWeight: vars.font.weight.bold,
	"@media": {
		"(prefers-color-scheme: light)": {
			color: "#666",
			fontFamily: vars.font.family.sans,
		},
	},
});

export const input = style({
	transition: vars.transition.normal,
	clipPath: vars.clipPath.small,
	border: `${vars.borderWidth.thin} solid ${vars.color.border.primary}`,
	backgroundColor: vars.color.background.input,
	padding: `${vars.spacing.md} ${vars.spacing.lg}`,
	color: vars.color.text.accent,
	fontFamily: vars.font.family.mono,
	fontSize: vars.font.size.base,
	":focus": {
		outline: "none",
		borderColor: vars.color.border.primary,
		boxShadow: vars.shadow.glow.medium,
		backgroundColor: vars.color.background.inputFocus,
	},
	"@media": {
		"(prefers-color-scheme: light)": {
			clipPath: "none",
			borderRadius: vars.borderRadius.lg,
			borderColor: "#ddd",
			backgroundColor: "white",
			color: "#333",
			fontFamily: vars.font.family.sans,
			":focus": {
				boxShadow: "0 0 0 3px rgba(17, 104, 189, 0.1)",
				backgroundColor: "#fff",
			},
		},
	},
});

export const textarea = style({
	transition: vars.transition.normal,
	clipPath: vars.clipPath.medium,
	border: `${vars.borderWidth.thin} solid ${vars.color.border.primary}`,
	backgroundColor: vars.color.background.input,
	padding: `${vars.spacing.md} ${vars.spacing.lg}`,
	minHeight: "100px",
	resize: "vertical",
	lineHeight: vars.font.lineHeight.relaxed,
	color: vars.color.text.accent,
	fontFamily: vars.font.family.mono,
	fontSize: vars.font.size.base,
	":focus": {
		outline: "none",
		borderColor: vars.color.border.primary,
		boxShadow: vars.shadow.glow.medium,
		backgroundColor: vars.color.background.inputFocus,
	},
	"@media": {
		"(prefers-color-scheme: light)": {
			clipPath: "none",
			borderRadius: vars.borderRadius.lg,
			borderColor: "#ddd",
			backgroundColor: "white",
			color: "#333",
			fontFamily: vars.font.family.sans,
			":focus": {
				boxShadow: "0 0 0 3px rgba(17, 104, 189, 0.1)",
				backgroundColor: "#fff",
			},
		},
	},
});

/**
 * ReactFlow Controls Styling
 * Applied directly to Controls component via className
 */
export const reactFlowControls = style({
	clipPath: vars.clipPath.large,
	border: `${vars.borderWidth.medium} solid ${vars.color.border.primary}`,
	boxShadow: vars.shadow.glow.xlarge,
	backgroundColor: vars.color.background.primary,

	selectors: {
		"& button": {
			clipPath: vars.clipPath.small,
			border: `${vars.borderWidth.thin} solid ${vars.color.border.primary}`,
			borderBottom: `${vars.borderWidth.thin} solid ${vars.color.border.primary}`,
			backgroundColor: vars.color.background.primary,
		},
		"& button:hover": {
			boxShadow: vars.shadow.glow.hover,
			backgroundColor: vars.color.background.tertiary,
		},
		"& button svg": {
			filter: vars.shadow.dropShadow,
			fill: vars.color.text.accent,
		},
	},

	"@media": {
		"(prefers-color-scheme: light)": {
			clipPath: "none",
			border: "1px solid #e0e0e0",
			borderRadius: vars.borderRadius.xl,
			boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
			backgroundColor: "white",
			selectors: {
				"& button": {
					clipPath: "none",
					border: "none",
					borderBottom: "1px solid #e0e0e0",
					backgroundColor: "white",
				},
				"& button svg": {
					filter: "none",
					fill: "#333",
				},
			},
		},
	},
});

/**
 * ReactFlow Background Styling
 * Override default grid with terminal-style dots
 */
export const reactFlowBackground = style({
	selectors: {
		":global(.react-flow__background)": {
			backgroundColor: vars.color.background.primary,
		},
		":global(.react-flow__background-pattern)": {
			opacity: Number(vars.opacity.gridDark),
			stroke: vars.color.border.primary,
		},
	},
	"@media": {
		"(prefers-color-scheme: light)": {
			selectors: {
				":global(.react-flow__background)": {
					backgroundColor: "#f8f9fa",
				},
				":global(.react-flow__background-pattern)": {
					opacity: Number(vars.opacity.gridLight),
					stroke: "#666",
				},
			},
		},
	},
});
