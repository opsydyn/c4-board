import { globalStyle, style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";

export const pickerContainer = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["3"],
});

export const trigger = style({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: theme.spacing["2"],
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(13, 23, 18, 0.95)",
	cursor: "pointer",
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	width: "100%",
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,

	selectors: {
		"&:hover": {
			borderColor: theme.color.border.primary,
			boxShadow: theme.effect.glow.sm,
		},
	},
});

export const triggerIcon = style({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	clipPath: theme.clipPath.sm,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(9, 16, 13, 0.9)",
	width: "32px",
	height: "32px",
});

export const popoverContent = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["3"],
	clipPath: theme.clipPath.lg,
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	boxShadow: theme.effect.glow.sm,
	backgroundColor: "rgba(10, 18, 14, 0.96)",
	padding: theme.spacing["4"],
	minWidth: "300px",
	maxWidth: "420px",
	maxHeight: "360px",
});

export const quickFilterRow = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
});

export const searchInput = style({
	flex: 1,
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(13, 23, 18, 0.95)",
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
});

globalStyle(`${searchInput}::placeholder`, {
	textTransform: theme.typography.textTransform.uppercase,
	color: theme.color.foreground.tertiary,
});

export const iconGrid = style({
	display: "grid",
	gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))",
	gap: theme.spacing["2"],
	padding: theme.spacing["1"],
	maxHeight: "240px",
	overflowY: "auto",
});

export const sectionHeading = style({
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
});

export const iconButton = style({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	gap: theme.spacing["1"],
	transition: theme.transition.base,
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(12, 20, 16, 0.92)",
	cursor: "pointer",
	padding: `${theme.spacing["2"]}`,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
});

globalStyle(`${iconButton}[data-selected="true"]`, {
	borderColor: theme.color.status.selected,
	boxShadow: theme.effect.glow.sm,
});

globalStyle(`${iconButton}:hover`, {
	borderColor: theme.color.border.primary,
	boxShadow: theme.effect.glow.sm,
});

export const footerRow = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: theme.spacing["2"],
});

export const footerButton = style({
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(13, 23, 18, 0.95)",
	cursor: "pointer",
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.interactive.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
});

export const helperRow = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: theme.spacing["2"],
});

export const statusText = style({
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	letterSpacing: theme.typography.letterSpacing.normal,
});

export const errorText = style({
	color: theme.color.status.critical,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	letterSpacing: theme.typography.letterSpacing.normal,
});
