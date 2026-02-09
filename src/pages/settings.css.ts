import { style } from "@vanilla-extract/css";
import { theme } from "../styles/theme.css";

export const pageShell = style({
	display: "grid",
	gridTemplateColumns: "minmax(260px, 320px) minmax(0, 1fr)",
	minHeight: "100vh",
	backgroundColor: theme.color.background.base,
	color: theme.color.foreground.primary,

	"@media": {
		"(max-width: 1000px)": {
			gridTemplateColumns: "1fr",
		},
	},
});

export const sidebar = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["4"],
	padding: `${theme.spacing["5"]} ${theme.spacing["4"]}`,
	borderRight: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(9, 16, 13, 0.92)",

	"@media": {
		"(max-width: 1000px)": {
			borderRight: "none",
			borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
		},
	},
});

export const sidebarBrand = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: theme.spacing["2"],
	width: "100%",
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
});

export const sidebarBrandIdentity = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
});

export const sidebarBrandIcon = style({
	display: "block",
	flexShrink: 0,
	clipPath: theme.clipPath.sm,
	boxShadow: theme.effect.glow.sm,
});

export const sidebarBrandMeta = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["1"],
});

export const sidebarBrandAction = style({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	clipPath: theme.clipPath.sm,
	border: `${theme.border.width.thin} solid ${theme.color.interactive.primary}`,
	backgroundColor: "rgba(13, 23, 18, 0.95)",
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
});

export const sidebarTagline = style({
	margin: 0,
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
	width: "100%",
});

export const sidebarQuickLink = style({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	flex: 1,
	transition: theme.transition.base,
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.interactive.primary}`,
	backgroundColor: "rgba(13, 23, 18, 0.95)",
	padding: `${theme.spacing["2"]} ${theme.spacing["2"]}`,
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	fontWeight: theme.typography.weight.bold,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	textDecoration: "none",

	selectors: {
		"&:hover": {
			boxShadow: theme.effect.glow.base,
			textDecoration: "underline",
		},
	},
});

export const sidebarSectionNav = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["2"],
	marginTop: theme.spacing["2"],
});

export const sidebarSectionLink = style({
	display: "inline-flex",
	alignItems: "center",
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	borderLeft: `${theme.border.width.base} solid ${theme.color.border.secondary}`,
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	textDecoration: "none",

	selectors: {
		"&:hover": {
			borderLeftColor: theme.color.interactive.primary,
			color: theme.color.foreground.primary,
		},
	},
});

export const main = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["5"],
	padding: `${theme.spacing["6"]} ${theme.spacing["6"]} ${theme.spacing["8"]}`,
	minWidth: 0,

	"@media": {
		"(max-width: 1000px)": {
			padding: `${theme.spacing["5"]} ${theme.spacing["4"]} ${theme.spacing["6"]}`,
		},
	},
});

export const mainHeader = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["2"],
	borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	paddingBottom: theme.spacing["4"],
});

export const mainTitle = style({
	margin: 0,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size["2xl"],
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.primary,
});

export const mainSubtitle = style({
	margin: 0,
	color: theme.color.foreground.tertiary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
});

export const settingsGrid = style({
	display: "grid",
	gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
	gap: theme.spacing["4"],

	"@media": {
		"(max-width: 1200px)": {
			gridTemplateColumns: "1fr",
		},
	},
});

export const settingsCard = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["3"],
	padding: `${theme.spacing["4"]} ${theme.spacing["4"]}`,
	border: `${theme.border.width.base} solid ${theme.color.border.primary}`,
	clipPath: theme.clipPath.md,
	backgroundColor: "rgba(10, 18, 14, 0.95)",
	boxShadow: theme.effect.glow.sm,
	minHeight: "180px",
});

export const settingsCardDanger = style({
	borderColor: theme.color.status.critical,
	boxShadow: `0 0 14px ${theme.color.status.critical}33`,
	backgroundColor: "rgba(35, 12, 14, 0.75)",
});

export const settingsCardTitle = style({
	margin: 0,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.md,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.primary,
});

export const settingsCardDescription = style({
	margin: 0,
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.sans,
	fontSize: theme.typography.size.sm,
	lineHeight: 1.5,
});

export const settingsRow = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: theme.spacing["2"],
	padding: `${theme.spacing["2"]} ${theme.spacing["2"]}`,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(12, 20, 16, 0.82)",
});

export const settingsRowLabel = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["1"],
	fontFamily: theme.typography.family.sans,
	fontSize: theme.typography.size.sm,
	color: theme.color.foreground.primary,
});

export const settingsRowHint = style({
	color: theme.color.foreground.tertiary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
});

export const settingsRowValue = style({
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(9, 16, 13, 0.9)",
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
});
