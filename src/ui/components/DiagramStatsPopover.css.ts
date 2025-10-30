/**
 * DiagramStatsPopover Styles
 *
 * Themed React Aria Components styling for popover stats
 */

import { style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";

export const infoButton = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	width: "32px",
	height: "32px",
	clipPath: theme.clipPath.sm,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: theme.color.background.surface,
	color: theme.color.interactive.primary,
	cursor: "pointer",
	transition: theme.transition.fast,
	outline: "none",

	selectors: {
		"&:hover": {
			backgroundColor: theme.color.background.raised,
			borderColor: theme.color.border.primary,
			boxShadow: theme.effect.glow.sm,
		},
		"&[data-pressed]": {
			backgroundColor: theme.color.background.input,
			transform: "scale(0.95)",
		},
		"&[data-focus-visible]": {
			outline: `${theme.border.width.base} solid ${theme.color.border.focus}`,
			outlineOffset: "2px",
		},
	},
});

export const popoverContainer = style({
	position: "relative",
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	// Force solid background
	backgroundColor: `${theme.color.background.surface} !important`,
	backdropFilter: "blur(8px)",
	boxShadow: `${theme.effect.glow.md}, 0 8px 24px rgba(0, 0, 0, 0.5)`,
	minWidth: "320px",
	maxWidth: "400px",
	zIndex: theme.zIndex.dropdown,
	outline: "none",
	// Ensure content is visible
	opacity: "1 !important",
});

export const popoverContent = style({
	padding: theme.spacing["4"],
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["3"],
	outline: "none",
	color: `${theme.color.foreground.primary} !important`,
	backgroundColor: "transparent",
});

export const popoverHeader = style({
	borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	paddingBottom: theme.spacing["2"],
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wider,
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.base,
	fontWeight: theme.typography.weight.semibold,
});

export const statGrid = style({
	display: "grid",
	gridTemplateColumns: "repeat(3, 1fr)",
	gap: theme.spacing["2"],
});

export const statItem = style({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: theme.spacing["1"],
	clipPath: theme.clipPath.sm,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: theme.color.background.surface,
	padding: theme.spacing["2"],
});

export const statLabel = style({
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.tertiary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
});

export const statValue = style({
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.lg,
	fontWeight: theme.typography.weight.bold,
});

export const nodeTypeBreakdown = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["2"],
	clipPath: theme.clipPath.sm,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: theme.color.background.surface,
	padding: theme.spacing["2"],
});

export const nodeTypeItem = style({
	display: "inline-flex",
	alignItems: "center",
	gap: theme.spacing["1"],
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	clipPath: theme.clipPath.sm,
	backgroundColor: theme.color.background.raised,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	color: theme.color.foreground.secondary,
});

export const nodeTypeCount = style({
	color: theme.color.interactive.primary,
	fontWeight: theme.typography.weight.semibold,
});

export const loadingText = style({
	padding: theme.spacing["4"],
	textAlign: "center",
	color: theme.color.foreground.tertiary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
	fontStyle: "italic",
});
