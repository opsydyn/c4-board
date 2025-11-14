/**
 * ExportModal Styles (Vanilla Extract)
 */

import { style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";

export const exportModalOverlay = style({
	position: "fixed",
	top: 0,
	left: 0,
	right: 0,
	bottom: 0,
	backgroundColor: "rgba(0, 0, 0, 0.75)",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	zIndex: 1000,
	backdropFilter: "blur(4px)",
});

export const exportModalContainer = style({
	backgroundColor: theme.color.background.base,
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	borderRadius: theme.border.radius.none, // ANGULAR - no rounding
	clipPath: theme.clipPath.lg, // Angled corners - tactical aesthetic
	boxShadow: `0 20px 60px rgba(0, 0, 0, 0.5), 0 0 20px ${theme.color.border.primary}33`,
	width: "90%",
	maxWidth: "800px",
	maxHeight: "90vh",
	display: "flex",
	flexDirection: "column",
	overflow: "hidden",
});

export const exportModalHeader = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	padding: theme.spacing["6"],
	borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
});

export const exportModalTitle = style({
	margin: 0,
	fontSize: theme.typography.size["2xl"],
	fontWeight: theme.typography.weight.bold,
	color: theme.color.foreground.primary,
	textShadow: theme.effect.textGlow.base,
});

export const exportModalCloseButton = style({
	background: "none",
	border: "none",
	color: theme.color.foreground.tertiary,
	cursor: "pointer",
	padding: theme.spacing["2"],
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	borderRadius: theme.border.radius.none, // ANGULAR
	clipPath: theme.clipPath.sm, // Angled corners
	transition: theme.transition.base,

	":hover": {
		color: theme.color.foreground.primary,
		backgroundColor: theme.color.background.raised,
	},
});

export const exportModalContent = style({
	flex: 1,
	overflow: "auto",
	padding: theme.spacing["6"],
});

export const exportModalCodeBlock = style({
	margin: 0,
	padding: theme.spacing["4"],
	backgroundColor: theme.color.background.surface,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	borderRadius: theme.border.radius.none, // ANGULAR
	clipPath: theme.clipPath.base, // Angled corners
	fontSize: theme.typography.size.sm,
	fontFamily: theme.typography.family.mono,
	lineHeight: theme.typography.lineHeight.relaxed,
	color: theme.color.foreground.secondary,
	overflow: "auto",
	whiteSpace: "pre",
	tabSize: 2,
});

export const exportModalActions = style({
	display: "flex",
	gap: theme.spacing["3"],
	padding: theme.spacing["6"],
	borderTop: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	justifyContent: "flex-end",
});

export const exportModalButton = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	padding: `${theme.spacing["3"]} ${theme.spacing["5"]}`,
	backgroundColor: theme.color.background.raised,
	border: `${theme.border.width.base} solid ${theme.color.border.secondary}`,
	borderRadius: theme.border.radius.none, // ANGULAR
	clipPath: theme.clipPath.base, // Angled corners
	color: theme.color.foreground.primary,
	fontSize: theme.typography.size.base,
	fontWeight: theme.typography.weight.medium,
	cursor: "pointer",
	transition: theme.transition.base,

	":hover": {
		backgroundColor: theme.color.background.surface,
		borderColor: theme.color.interactive.hover,
		color: theme.color.interactive.hover,
	},

	":active": {
		transform: "scale(0.98)",
	},
});

export const exportModalButtonPrimary = style([
	exportModalButton,
	{
		backgroundColor: theme.color.interactive.primary,
		borderColor: theme.color.interactive.primary,
		color: theme.color.background.base,

		":hover": {
			backgroundColor: theme.color.interactive.hover,
			borderColor: theme.color.interactive.hover,
			color: theme.color.background.base,
		},
	},
]);
