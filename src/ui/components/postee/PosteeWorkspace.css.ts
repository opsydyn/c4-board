import { style, globalStyle, keyframes } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";

export const workspace = style({
	display: "grid",
	gridTemplateColumns: "minmax(260px, 320px) 1fr",
	gridTemplateRows: "1fr",
	minHeight: "100vh",
	backgroundColor: theme.color.background.base,
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.sans,
});

export const sidebar = style({
	display: "flex",
	flexDirection: "column",
	gridColumn: "1 / 2",
	gridRow: "1 / 2",
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

export const selectionToolbar = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: theme.spacing["2"],
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	clipPath: theme.clipPath.sm,
	backgroundColor: "rgba(12, 20, 16, 0.8)",
	boxShadow: theme.effect.glow.sm,
	fontSize: theme.typography.size.sm,
	marginBottom: theme.spacing["2"],
});

export const selectionToolbarButton = style({
	display: "inline-flex",
	alignItems: "center",
	gap: theme.spacing["1"],
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	backgroundColor: "transparent",
	border: `${theme.border.width.thin} dashed ${theme.color.border.secondary}`,
	clipPath: theme.clipPath.sm,
	color: theme.color.foreground.secondary,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	cursor: "pointer",
	transition: theme.transition.base,

	selectors: {
		"&:hover:not(:disabled)": {
			color: theme.color.foreground.primary,
			borderColor: theme.color.border.primary,
		},
		"&:disabled": {
			opacity: theme.opacity.disabled,
			cursor: "not-allowed",
		},
	},
});

export const collectionTree = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["1"],
});

const treeRowBase = {
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	border: `${theme.border.width.thin} solid transparent`,
	clipPath: theme.clipPath.sm,
	cursor: "pointer",
	transition: theme.transition.base,
};

export const treeCollectionRow = style({
	...treeRowBase,
	fontFamily: theme.typography.family.sans,
	fontSize: theme.typography.size.sm,
	selectors: {
		"&:hover": {
			borderColor: theme.color.border.secondary,
			backgroundColor: "rgba(18, 28, 24, 0.7)",
		},
		'&[data-selected]': {
			borderColor: theme.color.border.primary,
			backgroundColor: "rgba(24, 40, 32, 0.9)",
			boxShadow: theme.effect.glow.sm,
		},
	},
});

export const treeItemLabel = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	flex: 1,
	minWidth: 0,
});

export const treeLabelContent = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["1"],
	flex: 1,
	minWidth: 0,
});

export const treeNameButton = style({
	all: "unset",
	display: "block",
	width: "100%",
	fontFamily: theme.typography.family.sans,
	fontSize: theme.typography.size.sm,
	fontWeight: theme.typography.weight.semibold,
	color: theme.color.foreground.primary,
	cursor: "text",
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",

	selectors: {
		"&:focus-visible": {
			outline: `${theme.border.width.thin} solid ${theme.color.border.focus}`,
		},
	},
});

export const treeIcon = style({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: "20px",
	flexShrink: 0,
});

export const treeCountBadge = style({
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.secondary,
});

export const treeChevronButton = style({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: "20px",
	height: "20px",
	padding: 0,
	border: "none",
	background: "transparent",
	color: theme.color.foreground.secondary,
	cursor: "pointer",
	flexShrink: 0,

	selectors: {
		"&:hover": {
			color: theme.color.foreground.primary,
		},
	},
});

globalStyle(`${treeChevronButton} svg`, {
	transition: "transform 0.2s ease",
});

globalStyle(`${treeChevronButton}[data-expanded] svg`, {
	transform: "rotate(90deg)",
});

export const treeChevronSpacer = style({
	display: "inline-flex",
	width: "28px",
	height: "28px",
});

export const treeRequestRow = style({
	...treeRowBase,
	paddingLeft: `${theme.spacing["3"]}`,
	fontFamily: theme.typography.family.sans,
	fontSize: theme.typography.size.sm,
	selectors: {
		"&:hover": {
			borderColor: theme.color.border.secondary,
			backgroundColor: "rgba(14, 24, 19, 0.7)",
		},
		'&[data-selected]': {
			borderColor: theme.color.border.primary,
			backgroundColor: "rgba(14, 24, 19, 0.9)",
			boxShadow: theme.effect.glow.sm,
		},
	},
});

export const treeMethodBadge = style({
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	clipPath: theme.clipPath.sm,
});

export const treeRequestName = style({
	flex: 1,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
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
	position: "relative",
	gridColumn: "2 / 3",
	gridRow: "1 / 2",
	padding: `${theme.spacing["5"]} ${theme.spacing["6"]}`,
	gap: theme.spacing["4"],
	minWidth: 0,
	overflowY: "auto",
});

export const mainHeader = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	columnGap: theme.spacing["3"],
	rowGap: theme.spacing["2"],
	flexWrap: "wrap",
});

export const mainHeaderTitle = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["3"],
});

export const mainHeaderActions = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	marginLeft: "auto",
	flexWrap: "wrap",
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

/**
 * Unified Request Bar - Postman-style always-visible request interface
 */
export const requestBar = style({
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	// No clipPath to prevent clipping dropdown menus
	padding: `${theme.spacing["4"]} ${theme.spacing["5"]}`,
	backgroundColor: "rgba(10, 18, 14, 0.94)",
	boxShadow: theme.effect.glow.sm,
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["3"],
});

export const requestBarRow = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	flexWrap: "wrap",
});

export const urlInputWrapper = style({
	position: "relative",
	flex: 1,
	minWidth: "300px",
	display: "flex",
	alignItems: "center",
});

export const requestUrlInput = style({
	flex: 1,
	width: "100%",
	height: "36px",
	clipPath: theme.clipPath.sm,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: theme.color.background.input,
	color: theme.color.foreground.primary,
	padding: `0 ${theme.spacing["8"]} 0 ${theme.spacing["3"]}`,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
	transition: theme.transition.base,

	selectors: {
		"&:focus": {
			outline: "none",
			borderColor: theme.color.border.focus,
			boxShadow: theme.effect.glow.sm,
		},
		"&:disabled": {
			opacity: theme.opacity.disabled,
			cursor: "not-allowed",
		},
		"&[data-validation='valid']:not(:disabled)": {
			borderColor: theme.color.status.ready,
		},
		"&[data-validation='invalid']:not(:disabled)": {
			borderColor: theme.color.status.critical,
		},
	},
});

export const urlValidIcon = style({
	position: "absolute",
	right: theme.spacing["3"],
	color: theme.color.status.ready,
	pointerEvents: "none",
});

export const urlInvalidIcon = style({
	position: "absolute",
	right: theme.spacing["3"],
	color: theme.color.status.critical,
	pointerEvents: "none",
});

export const validationError = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	backgroundColor: "rgba(255, 107, 107, 0.1)",
	border: `${theme.border.width.thin} solid ${theme.color.status.critical}`,
	clipPath: theme.clipPath.sm,
	color: theme.color.status.critical,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	marginTop: theme.spacing["2"],
});

export const suggestionButton = style({
	marginLeft: "auto",
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	backgroundColor: "rgba(255, 107, 107, 0.2)",
	border: `${theme.border.width.thin} solid ${theme.color.status.critical}`,
	clipPath: theme.clipPath.sm,
	color: theme.color.foreground.primary,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	cursor: "pointer",
	transition: theme.transition.fast,

	selectors: {
		"&:hover": {
			backgroundColor: "rgba(255, 107, 107, 0.3)",
		},
	},
});

export const responseColumn = style({
	display: "flex",
	flexDirection: "column",
	gridColumn: "3 / 4",
	gridRow: "1 / 2",
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

export const responseInline = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["4"],
	padding: `${theme.spacing["5"]} ${theme.spacing["4"]}`,
	backgroundColor: "rgba(8, 14, 12, 0.96)",
	borderTop: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	marginTop: theme.spacing["4"],
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

export const saveButton = style([
	submitButton,
	{
		backgroundColor: theme.color.status.ready,
		color: theme.color.background.base,
	},
]);

export const actionRow = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["3"],
	marginTop: theme.spacing["3"],
});

export const statusBadge = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	clipPath: theme.clipPath.sm,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
	backgroundColor: "rgba(14, 24, 19, 0.85)",
	transition: theme.transition.base,
});

export const statusCode = style({
	fontWeight: theme.typography.weight.bold,
	fontSize: theme.typography.size.base,
});

export const statusText = style({
	color: theme.color.foreground.secondary,
});

export const statusDivider = style({
	color: theme.color.foreground.tertiary,
	opacity: 0.5,
});

export const statusDuration = style({
	color: theme.color.foreground.secondary,
});

globalStyle(`${statusBadge}[data-status-type="success"]`, {
	borderColor: theme.color.status.ready,
});

globalStyle(`${statusBadge}[data-status-type="success"] ${statusCode}`, {
	color: theme.color.status.ready,
});

globalStyle(`${statusBadge}[data-status-type="redirect"]`, {
	borderColor: theme.color.status.selected,
});

globalStyle(`${statusBadge}[data-status-type="redirect"] ${statusCode}`, {
	color: theme.color.status.selected,
});

globalStyle(`${statusBadge}[data-status-type="client-error"]`, {
	borderColor: theme.color.status.caution,
});

globalStyle(`${statusBadge}[data-status-type="client-error"] ${statusCode}`, {
	color: theme.color.status.caution,
});

globalStyle(`${statusBadge}[data-status-type="server-error"]`, {
	borderColor: theme.color.status.critical,
});

globalStyle(`${statusBadge}[data-status-type="server-error"] ${statusCode}`, {
	color: theme.color.status.critical,
});

export const runButton = style([
	submitButton,
	{
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		gap: theme.spacing["2"],
		backgroundColor: theme.color.interactive.primary,
		color: theme.color.background.base,
	},
]);

export const cancelButton = style([
	submitButton,
	{
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		gap: theme.spacing["2"],
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

const spinAnimation = keyframes({
	from: {
		transform: "rotate(0deg)",
	},
	to: {
		transform: "rotate(360deg)",
	},
});

export const spinner = style({
	"@media": {
		"(prefers-reduced-motion: no-preference)": {
			animation: `${spinAnimation} 1s linear infinite`,
		},
	},
});

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

export const tabContent = style({
	padding: `${theme.spacing["4"]} 0`,
	minHeight: "200px",
});

export const responseTabContent = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["4"],
	padding: `${theme.spacing["4"]} 0`,
	minHeight: 0,
});

export const environmentContent = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["3"],
	minHeight: 0,
});

export const environmentEmptyState = style({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	gap: theme.spacing["2"],
	padding: `${theme.spacing["6"]} ${theme.spacing["4"]}`,
	textAlign: "center",
	color: theme.color.foreground.secondary,
});

export const environmentForm = style({
	display: "grid",
	gridTemplateColumns: "minmax(0, 1fr) auto",
	gap: theme.spacing["2"],
	width: "100%",
	marginTop: theme.spacing["3"],

	"@media": {
		"(max-width: 720px)": {
			gridTemplateColumns: "1fr",
		},
	},
});

export const loadTestPanel = style([
	panel,
	{
		minHeight: "auto",
		paddingBottom: theme.spacing["4"],
	},
]);

export const loadTestControls = style({
	display: "grid",
	gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
	gap: theme.spacing["3"],

	"@media": {
		"(max-width: 1200px)": {
			gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
		},
		"(max-width: 900px)": {
			gridTemplateColumns: "minmax(0, 1fr)",
		},
	},
});

export const loadTestButtonRow = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["3"],
	justifyContent: "flex-start",

	"@media": {
		"(max-width: 900px)": {
			flexDirection: "column",
			alignItems: "stretch",
		},
	},
});

const blastDoorAlertBlink = keyframes({
	"0%, 100%": {
		opacity: 1,
		backgroundColor: theme.color.status.critical,
		boxShadow: `0 0 10px ${theme.color.status.critical}`,
	},
	"50%": {
		opacity: 0.35,
		backgroundColor: "rgba(0, 0, 0, 0)",
		boxShadow: "0 0 0 rgba(0, 0, 0, 0)",
	},
});

export const loadTestStatus = style({
	display: "inline-flex",
	alignItems: "center",
	gap: theme.spacing["2"],
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: "uppercase",
	letterSpacing: theme.typography.letterSpacing.wide,
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	clipPath: theme.clipPath.sm,
	backgroundColor: "rgba(28, 46, 38, 0.8)",
});

export const loadTestStatusIndicator = style({
	display: "inline-block",
	width: "0.65rem",
	height: "0.65rem",
	flexShrink: 0,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "rgba(28, 46, 38, 0.92)",
});

export const loadTestStatusIndicatorActive = style({
	borderColor: theme.color.status.critical,
	backgroundColor: theme.color.status.critical,
	boxShadow: `0 0 10px ${theme.color.status.critical}`,

	"@media": {
		"(prefers-reduced-motion: no-preference)": {
			animation: `${blastDoorAlertBlink} 1s steps(2, end) infinite`,
		},
	},
});

export const loadTestMetrics = style({
	display: "grid",
	gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
	gap: theme.spacing["3"],

	"@media": {
		"(max-width: 1200px)": {
			gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
		},
		"(max-width: 900px)": {
			gridTemplateColumns: "minmax(0, 1fr)",
		},
	},
});

export const metricCard = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["1"],
	padding: `${theme.spacing["3"]} ${theme.spacing["3"]}`,
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	clipPath: theme.clipPath.sm,
	backgroundColor: "rgba(14, 24, 19, 0.85)",
});

export const metricLabel = style({
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	color: theme.color.foreground.secondary,
	textTransform: theme.typography.textTransform.uppercase,
});

export const metricValue = style({
	fontSize: theme.typography.size.lg,
	fontFamily: theme.typography.family.sans,
	color: theme.color.foreground.primary,
});

export const chartWrapper = style({
	width: "100%",
	height: "180px",
	backgroundColor: "rgba(12, 20, 16, 0.9)",
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	clipPath: theme.clipPath.sm,
	padding: theme.spacing["3"],
});

export const chartVisualizationGrid = style({
	display: "grid",
	gap: theme.spacing["4"],
});

export const chartSection = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["2"],
});

export const chartHeader = style({
	display: "flex",
	alignItems: "baseline",
	justifyContent: "space-between",
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
	color: theme.color.foreground.secondary,
});

export const chartRow = style({
	display: "grid",
	gridTemplateColumns: "minmax(140px, 180px) 1fr",
	gap: theme.spacing["3"],
	alignItems: "center",

	"@media": {
		"(max-width: 900px)": {
			gridTemplateColumns: "minmax(0, 1fr)",
		},
	},
});

export const miniBarWrapper = style({
	display: "flex",
	flexDirection: "column",
	gap: theme.spacing["1"],
});

export const miniBarValue = style({
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
	color: theme.color.foreground.primary,
});

export const historyDetailHeader = style({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: theme.spacing["3"],
});

export const historyCloseButton = style({
	border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
	backgroundColor: "transparent",
	color: theme.color.foreground.secondary,
	cursor: "pointer",
	clipPath: theme.clipPath.sm,
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	transition: theme.transition.base,

	selectors: {
		"&:hover": {
			backgroundColor: theme.color.surface.overlay,
			boxShadow: theme.effect.glow.sm,
		},
	},
});

export const latencyBandsCard = style([
	panel,
	{
		minHeight: "auto",
		padding: `${theme.spacing["4"]} ${theme.spacing["4"]}`,
	},
]);

export const latencyBandsHeader = style({
	display: "flex",
	alignItems: "baseline",
	justifyContent: "space-between",
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.sm,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.secondary,
	marginBottom: theme.spacing["2"],
});

export const latencyLegend = style({
	display: "flex",
	gap: theme.spacing["3"],
	flexWrap: "wrap",
	marginTop: theme.spacing["3"],
});

export const latencyLegendItem = style({
	display: "flex",
	alignItems: "center",
	gap: theme.spacing["1"],
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	color: theme.color.foreground.secondary,
});

export const latencyLegendSwatch = style({
	width: 12,
	height: 12,
	clipPath: theme.clipPath.sm,
	display: "inline-block",
});

/**
 * Response Panel Empty States
 */
export const responseEmptyState = style({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	gap: theme.spacing["4"],
	padding: `${theme.spacing["12"]} ${theme.spacing["4"]}`,
	color: theme.color.foreground.secondary,
	textAlign: "center",
	minHeight: "300px",
	backgroundImage: `
		linear-gradient(${theme.color.grid} 1px, transparent 1px),
		linear-gradient(90deg, ${theme.color.grid} 1px, transparent 1px)
	`,
	backgroundSize: "20px 20px",
});

globalStyle(`${responseEmptyState} h3`, {
	fontSize: theme.typography.size.lg,
	fontFamily: theme.typography.family.mono,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.primary,
	margin: 0,
});

globalStyle(`${responseEmptyState} p`, {
	fontSize: theme.typography.size.sm,
	fontFamily: theme.typography.family.mono,
	maxWidth: "400px",
	margin: 0,
});

globalStyle(`${responseEmptyState} kbd`, {
	display: "inline-block",
	padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
	backgroundColor: theme.color.background.raised,
	border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
	clipPath: theme.clipPath.sm,
	fontFamily: theme.typography.family.mono,
	fontSize: theme.typography.size.xs,
	fontWeight: theme.typography.weight.bold,
	color: theme.color.foreground.primary,
});

globalStyle(`${responseEmptyState} svg`, {
	color: theme.color.status.selected,
	opacity: 0.6,
});

export const responseLoadingState = style({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	gap: theme.spacing["4"],
	padding: `${theme.spacing["12"]} ${theme.spacing["4"]}`,
	color: theme.color.foreground.secondary,
	textAlign: "center",
	minHeight: "300px",
	backgroundImage: `
		linear-gradient(${theme.color.grid} 1px, transparent 1px),
		linear-gradient(90deg, ${theme.color.grid} 1px, transparent 1px)
	`,
	backgroundSize: "20px 20px",
});

globalStyle(`${responseLoadingState} h3`, {
	fontSize: theme.typography.size.lg,
	fontFamily: theme.typography.family.mono,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.foreground.primary,
	margin: 0,
});

globalStyle(`${responseLoadingState} p`, {
	fontSize: theme.typography.size.sm,
	fontFamily: theme.typography.family.mono,
	maxWidth: "400px",
	margin: 0,
});

globalStyle(`${responseLoadingState} svg`, {
	color: theme.color.status.selected,
});

export const responseErrorState = style({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	gap: theme.spacing["4"],
	padding: `${theme.spacing["12"]} ${theme.spacing["4"]}`,
	color: theme.color.foreground.secondary,
	textAlign: "center",
	minHeight: "300px",
	backgroundImage: `
		linear-gradient(${theme.color.grid} 1px, transparent 1px),
		linear-gradient(90deg, ${theme.color.grid} 1px, transparent 1px)
	`,
	backgroundSize: "20px 20px",
});

globalStyle(`${responseErrorState} h3`, {
	fontSize: theme.typography.size.lg,
	fontFamily: theme.typography.family.mono,
	textTransform: theme.typography.textTransform.uppercase,
	letterSpacing: theme.typography.letterSpacing.wide,
	color: theme.color.status.critical,
	margin: 0,
});

globalStyle(`${responseErrorState} svg`, {
	color: theme.color.status.critical,
});

export const responseErrorMessage = style({
	fontSize: theme.typography.size.sm,
	fontFamily: theme.typography.family.mono,
	maxWidth: "600px",
	margin: 0,
	padding: theme.spacing["4"],
	backgroundColor: theme.color.background.raised,
	border: `${theme.border.width.thin} solid ${theme.color.status.critical}`,
	clipPath: theme.clipPath.md,
	textAlign: "left",
	color: theme.color.foreground.primary,
	overflowX: "auto",
});
