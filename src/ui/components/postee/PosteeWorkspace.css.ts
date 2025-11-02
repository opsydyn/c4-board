import { style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";

export const workspace = style({
	display: "grid",
	gridTemplateColumns: "minmax(260px, 320px) 1fr minmax(300px, 360px)",
	gridTemplateRows: "auto 1fr",
	minHeight: "100vh",
	backgroundColor: theme.color.background.base,
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.sans,

	"@media": {
		"(max-width: 1360px)": {
			gridTemplateColumns: "minmax(240px, 280px) 1fr",
			gridTemplateRows: "auto 1fr auto",
		},
	},
});

export const sidebar = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["4"],
	padding: `${theme.spacing["5"]} ${theme.spacing["4"]}`,
	borderRight: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(8, 14, 11, 0.96)",
	overflowY: "auto",
});

export const branding = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.secondary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
});

export const collectionList = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["2"],
});

export const collectionButton = style({
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	clipPath: theme.clipPath.base,
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	background: "transparent",
	color: theme.color.foreground.primary,
	cursor: "pointer",
	textAlign: "left",
	fontSize: theme.typography.size.sm,
	fontFamily: theme.typography.family.sans,
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["1"],
	transition: "background-color 0.2s ease, border-color 0.2s ease",

	selectors: {
		"&:hover": {
			backgroundColor: "rgba(20, 32, 26, 0.75)",
			borderColor: theme.color.border.primary,
		},
	},
});

export const collectionButtonActive = style([
	collectionButton,
	{
		backgroundColor: "rgba(24, 40, 32, 0.95)",
		borderColor: theme.color.border.primary,
		boxShadow: theme.effect.glow.sm,
	},
]);

export const requestList = style({
	marginTop: theme.spacing["4"],
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["2"],
});

export const requestButton = style({
	all: "unset",
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	clipPath: theme.clipPath.sm,
	border: `${theme.border.width.thin} solid transparent`,
	color: theme.color.foreground.primary,
	cursor: "pointer",

	selectors: {
		"&:hover": {
			backgroundColor: "rgba(18, 28, 24, 0.7)",
			borderColor: theme.color.border.secondary,
		},
	},
});

export const requestButtonActive = style([
	requestButton,
	{
		backgroundColor: "rgba(25, 40, 32, 0.9)",
		borderColor: theme.color.border.primary,
	},
]);

export const mainColumn = style({
	display: "flex",
	flexDirection: "column",
	padding: `${theme.spacing["5"]} ${theme.spacing["6"]}`,
	gap: theme.spacing["4"],
	minWidth: 0,
	overflowY: "auto",
});

export const mainHeader = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["3"],
});

export const statusPill = style({
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	clipPath: theme.clipPath.sm,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	backgroundColor: "rgba(25, 89, 63, 0.4)",
	color: theme.color.foreground.primary,
	textTransform: "uppercase",
	letterSpacing: theme.typography.letterSpacing.wide,
});

export const panel = style({
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	clipPath: theme.clipPath.lg,
	padding: `${theme.spacing["4"]} ${theme.spacing["5"]}`,
	backgroundColor: "rgba(10, 18, 14, 0.94)",
	boxShadow: theme.effect.glow.sm,
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["3"],
	minHeight: "200px",
});

export const responseColumn = style({
	display: "flex",
	flexDirection: "column",
	padding: `${theme.spacing["5"]} ${theme.spacing["4"]}`,
	borderLeft: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(8, 14, 12, 0.96)",
	gap: theme.spacing["4"],
	overflowY: "auto",

	"@media": {
		"(max-width: 1360px)": {
			gridColumn: "1 / -1",
			borderLeft: "none",
			borderTop: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
		},
	},
});

export const sectionTitle = style({
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.secondary,
});

export const emptyState = style({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	gap: theme.spacing["2"],
	padding: `${theme.spacing["6"]} ${theme.spacing["4"]}`,
	color: theme.color.foreground.secondary,
	textAlign: "center",
});

export const collectionForm = style({
	display: "grid",
	gridTemplateColumns: "1fr auto",
	gap: theme.spacing["2"],
	alignItems: "center",
	marginBottom: theme.spacing["4"],
});

export const createForm = style({
	display: "grid",
	gridTemplateColumns:
		"minmax(96px, 110px) minmax(160px, 1fr) minmax(220px, 2fr) auto",
	gap: theme.spacing["2"],
	alignItems: "center",

	"@media": {
		"(max-width: 900px)": {
			gridTemplateColumns: "1fr",
		},
	},
});

export const textInput = style({
	height: "36px",
	clipPath: theme.clipPath.sm,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: theme.color.background.input,
	color: theme.color.foreground.primary,
	padding: `0 ${theme.spacing["2"]}`,
	fontFamily: theme.typography.family.sans,
	fontSize: theme.typography.size.sm,
});

export const submitButton = style({
	height: "36px",
	clipPath: theme.clipPath.sm,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	backgroundColor: theme.color.interactive.primary,
	color: theme.color.background.base,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	padding: `0 ${theme.spacing["3"]}`,
	cursor: "pointer",
	transition: theme.transition.base,

	selectors: {
		"&:disabled": {
			backgroundColor: theme.color.foreground.tertiary,
			color: theme.color.background.surface,
			opacity: theme.opacity.disabled,
			cursor: "not-allowed",
		},
		"&:not(:disabled):hover": {
			boxShadow: theme.effect.glow.sm,
		},
	},
});

export const actionRow = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	marginTop: theme.spacing["3"],
});

export const runButton = style([
	submitButton,
	{
		backgroundColor: theme.color.interactive.primary,
		color: theme.color.background.base,
	},
]);

export const cancelButton = style([
	submitButton,
	{
		backgroundColor: theme.color.status.critical,
		color: theme.color.background.base,
		opacity: 0.85,

		selectors: {
			"&:not(:disabled):hover": {
				boxShadow: theme.effect.glow.base,
				opacity: 1,
			},
		},
	},
]);

export const responseBody = style({
	backgroundColor: theme.color.background.surface,
	clipPath: theme.clipPath.base,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
	maxHeight: "200px",
	overflowY: "auto",
	whiteSpace: "pre-wrap",
	lineHeight: theme.typography.lineHeight.normal,
});
