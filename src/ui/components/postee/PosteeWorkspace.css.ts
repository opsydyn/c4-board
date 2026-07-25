import { globalStyle, keyframes, style } from "@vanilla-extract/css";
import { theme } from "../../../styles/theme.css";

/**
 * The workspace is an instrument panel, not a document: it fills the viewport
 * exactly and never scrolls itself. Designated regions inside it scroll instead.
 *
 * `height` rather than `minHeight` is the whole point — `minHeight` lets the grid
 * grow past the viewport, and once it does no amount of inner overflow discipline
 * can stop the page scrolling. `dvh` because the Tauri webview reports a dynamic
 * viewport (ADR-011).
 */
export const workspace = style({
  display: "grid",
  gridTemplateRows: "1fr",
  gridTemplateColumns: "minmax(260px, 320px) 1fr",
  backgroundColor: theme.color.background.base,
  height: "100dvh",
  overflow: "hidden",
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.sans,
});

export const sidebar = style({
  display: "flex",
  flexDirection: "column",
  gridRow: "1 / 2",
  gridColumn: "1 / 2",
  gap: theme.spacing["4"],
  borderRight: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(8, 14, 11, 0.96)",
  padding: `${theme.spacing["5"]} ${theme.spacing["4"]}`,
  // Without this the sidebar cannot shrink below its content and pushes the shell.
  minHeight: 0,
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
  clipPath: theme.clipPath.sm,
  marginBottom: theme.spacing["2"],
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  boxShadow: theme.effect.glow.sm,
  backgroundColor: "rgba(12, 20, 16, 0.8)",
  padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
  fontSize: theme.typography.size.sm,
});

export const selectionToolbarButton = style({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing["1"],
  transition: theme.transition.base,
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} dashed ${theme.color.border.secondary}`,
  backgroundColor: "transparent",
  cursor: "pointer",
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,

  selectors: {
    "&:hover:not(:disabled)": {
      borderColor: theme.color.border.primary,
      color: theme.color.foreground.primary,
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
    "&[data-selected]": {
      borderColor: theme.color.border.primary,
      boxShadow: theme.effect.glow.sm,
      backgroundColor: "rgba(24, 40, 32, 0.9)",
    },
  },
});

export const treeItemLabel = style({
  display: "flex",
  flex: 1,
  alignItems: "center",
  gap: theme.spacing["2"],
  minWidth: 0,
});

export const treeLabelContent = style({
  display: "flex",
  flex: 1,
  flexDirection: "column",
  gap: theme.spacing["1"],
  minWidth: 0,
});

export const treeNameButton = style({
  all: "unset",
  display: "block",
  cursor: "text",
  width: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.sans,
  fontSize: theme.typography.size.sm,
  fontWeight: theme.typography.weight.semibold,

  selectors: {
    "&:focus-visible": {
      outline: `${theme.border.width.thin} solid ${theme.color.border.focus}`,
    },
  },
});

export const treeIcon = style({
  display: "inline-flex",
  flexShrink: 0,
  alignItems: "center",
  justifyContent: "center",
  width: "20px",
});

export const treeCountBadge = style({
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const treeChevronButton = style({
  display: "inline-flex",
  flexShrink: 0,
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  padding: 0,
  width: "20px",
  height: "20px",
  color: theme.color.foreground.secondary,

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
    "&[data-selected]": {
      borderColor: theme.color.border.primary,
      boxShadow: theme.effect.glow.sm,
      backgroundColor: "rgba(14, 24, 19, 0.9)",
    },
  },
});

export const treeMethodBadge = style({
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const treeRequestName = style({
  flex: 1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const collectionButton = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["1"],
  transition: "background-color 0.2s ease, border-color 0.2s ease",
  clipPath: theme.clipPath.base,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  background: "transparent",
  cursor: "pointer",
  padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
  textAlign: "left",
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.sans,
  fontSize: theme.typography.size.sm,

  selectors: {
    "&:hover": {
      borderColor: theme.color.border.primary,
      backgroundColor: "rgba(20, 32, 26, 0.75)",
    },
  },
});

export const collectionButtonActive = style([
  collectionButton,
  {
    borderColor: theme.color.border.primary,
    boxShadow: theme.effect.glow.sm,
    backgroundColor: "rgba(24, 40, 32, 0.95)",
  },
]);

export const requestList = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["2"],
  marginTop: theme.spacing["4"],
});

export const requestButton = style({
  all: "unset",
  display: "flex",
  alignItems: "center",
  gap: theme.spacing["2"],
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid transparent`,
  cursor: "pointer",
  padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
  color: theme.color.foreground.primary,

  selectors: {
    "&:hover": {
      borderColor: theme.color.border.secondary,
      backgroundColor: "rgba(18, 28, 24, 0.7)",
    },
  },
});

export const requestButtonActive = style([
  requestButton,
  {
    borderColor: theme.color.border.primary,
    backgroundColor: "rgba(25, 40, 32, 0.9)",
  },
]);

export const mainColumn = style({
  position: "relative",
  display: "flex",
  flexDirection: "column",
  gridRow: "1 / 2",
  gridColumn: "2 / 3",
  gap: theme.spacing["4"],
  padding: `${theme.spacing["5"]} ${theme.spacing["6"]}`,
  minWidth: 0,
  // Pairs with the fixed-height shell: this is the region that scrolls, so it has
  // to be allowed to shrink to the track it was given.
  minHeight: 0,
  overflowY: "auto",
});

export const mainHeader = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  rowGap: theme.spacing["2"],
  columnGap: theme.spacing["3"],
});

export const mainHeaderTitle = style({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing["3"],
});

export const mainHeaderActions = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: theme.spacing["2"],
  marginLeft: "auto",
});

export const scratchBar = style({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing["2"],
  minWidth: 0,
});

export const newScratchButton = style({
  flex: "0 0 auto",
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
  background: "transparent",
  cursor: "pointer",
  padding: `0 ${theme.spacing["2"]}`,
  height: "30px",
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
  selectors: {
    "&:hover": {
      backgroundColor: "rgba(24, 40, 32, 0.9)",
    },
  },
});

export const statusPill = style({
  clipPath: theme.clipPath.sm,
  backgroundColor: "rgba(25, 89, 63, 0.4)",
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  textTransform: "uppercase",
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const panel = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["3"],
  clipPath: theme.clipPath.lg,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  boxShadow: theme.effect.glow.sm,
  backgroundColor: "rgba(10, 18, 14, 0.94)",
  padding: `${theme.spacing["4"]} ${theme.spacing["5"]}`,
  minHeight: "200px",
});

/**
 * Unified Request Bar - Postman-style always-visible request interface
 */
export const requestBar = style({
  display: "flex",
  // No clipPath to prevent clipping dropdown menus
  flexDirection: "column",
  gap: theme.spacing["3"],
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  boxShadow: theme.effect.glow.sm,
  backgroundColor: "rgba(10, 18, 14, 0.94)",
  padding: `${theme.spacing["4"]} ${theme.spacing["5"]}`,
});

export const requestBarRow = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: theme.spacing["2"],
});

export const urlInputWrapper = style({
  position: "relative",
  display: "flex",
  flex: 1,
  alignItems: "center",
  minWidth: "300px",
});

export const requestUrlInput = style({
  flex: 1,
  transition: theme.transition.base,
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: theme.color.background.input,
  padding: `0 ${theme.spacing["8"]} 0 ${theme.spacing["3"]}`,
  width: "100%",
  height: "36px",
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,

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
  pointerEvents: "none",
  color: theme.color.status.ready,
});

export const urlInvalidIcon = style({
  position: "absolute",
  right: theme.spacing["3"],
  pointerEvents: "none",
  color: theme.color.status.critical,
});

export const validationError = style({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing["2"],
  clipPath: theme.clipPath.sm,
  marginTop: theme.spacing["2"],
  border: `${theme.border.width.thin} solid ${theme.color.status.critical}`,
  backgroundColor: "rgba(255, 107, 107, 0.1)",
  padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
  color: theme.color.status.critical,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const suggestionButton = style({
  transition: theme.transition.fast,
  clipPath: theme.clipPath.sm,
  marginLeft: "auto",
  border: `${theme.border.width.thin} solid ${theme.color.status.critical}`,
  backgroundColor: "rgba(255, 107, 107, 0.2)",
  cursor: "pointer",
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,

  selectors: {
    "&:hover": {
      backgroundColor: "rgba(255, 107, 107, 0.3)",
    },
  },
});

/**
 * The response pane, peer to the request rather than stacked beneath it.
 *
 * Track 4 of the shell: sidebar, request, divider, response. The former
 * `max-width: 1360px` rule re-stacked this to `1 / -1`, which reintroduced the
 * page scroll the shell exists to prevent; narrow widths become a tab in Phase 4
 * instead (ADR-011).
 */
export const responseColumn = style({
  display: "flex",
  flexDirection: "column",
  gridRow: "1 / 2",
  gridColumn: "4 / 5",
  gap: theme.spacing["4"],
  borderLeft: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(8, 14, 12, 0.96)",
  padding: `${theme.spacing["5"]} ${theme.spacing["4"]}`,
  minWidth: 0,
  minHeight: 0,
  overflowY: "auto",
});

export const sectionTitle = style({
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const emptyState = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing["2"],
  padding: `${theme.spacing["6"]} ${theme.spacing["4"]}`,
  textAlign: "center",
  color: theme.color.foreground.secondary,
});

export const collectionForm = style({
  display: "grid",
  gridTemplateColumns: "1fr auto",
  alignItems: "center",
  gap: theme.spacing["2"],
  marginBottom: theme.spacing["4"],
});

export const createForm = style({
  display: "grid",
  gridTemplateColumns: "minmax(96px, 110px) minmax(160px, 1fr) minmax(220px, 2fr) auto",
  alignItems: "center",
  gap: theme.spacing["2"],

  "@media": {
    "(max-width: 900px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const textInput = style({
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: theme.color.background.input,
  padding: `0 ${theme.spacing["2"]}`,
  height: "36px",
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.sans,
  fontSize: theme.typography.size.sm,
});

export const submitButton = style({
  transition: theme.transition.base,
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
  backgroundColor: theme.color.interactive.primary,
  cursor: "pointer",
  padding: `0 ${theme.spacing["3"]}`,
  height: "36px",
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.background.base,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,

  selectors: {
    "&:disabled": {
      opacity: theme.opacity.disabled,
      backgroundColor: theme.color.foreground.tertiary,
      cursor: "not-allowed",
      color: theme.color.background.surface,
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
  transition: theme.transition.base,
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(14, 24, 19, 0.85)",
  padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
});

export const statusCode = style({
  fontSize: theme.typography.size.base,
  fontWeight: theme.typography.weight.bold,
});

export const statusText = style({
  color: theme.color.foreground.secondary,
});

export const statusDivider = style({
  opacity: 0.5,
  color: theme.color.foreground.tertiary,
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
    opacity: 0.85,
    backgroundColor: theme.color.status.critical,
    color: theme.color.background.base,

    selectors: {
      "&:not(:disabled):hover": {
        opacity: 1,
        boxShadow: theme.effect.glow.base,
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
  clipPath: theme.clipPath.base,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: theme.color.background.surface,
  padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
  maxHeight: "200px",
  overflowY: "auto",
  lineHeight: theme.typography.lineHeight.normal,
  whiteSpace: "pre-wrap",
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
});

export const tabContent = style({
  padding: `${theme.spacing["4"]} 0`,
  minHeight: "200px",
});

export const graphqlEditorLayout = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["4"],
  marginTop: theme.spacing["4"],
});

export const graphqlEditorSection = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["2"],
});

export const graphqlEditorHeading = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing["2"],
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const graphqlSchemaStatus = style({
  color: theme.color.foreground.tertiary,
});

export const graphqlSchemaControls = style({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing["2"],
});

export const graphqlSchemaRefreshButton = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: theme.transition.fast,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "transparent",
  cursor: "pointer",
  padding: theme.spacing["1"],
  color: theme.color.foreground.secondary,

  selectors: {
    "&:hover:not(:disabled)": {
      borderColor: theme.color.border.focus,
      color: theme.color.foreground.primary,
    },
    "&:disabled": {
      opacity: theme.opacity.disabled,
      cursor: "not-allowed",
    },
  },
});

export const graphqlOperationField = style({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing["2"],
  maxWidth: "320px",
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
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
  marginTop: theme.spacing["3"],
  width: "100%",

  "@media": {
    "(max-width: 720px)": {
      gridTemplateColumns: "1fr",
    },
  },
});

export const loadTestPanel = style([
  panel,
  {
    paddingBottom: theme.spacing["4"],
    minHeight: "auto",
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
  justifyContent: "flex-start",
  gap: theme.spacing["3"],

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
    boxShadow: `0 0 10px ${theme.color.status.critical}`,
    backgroundColor: theme.color.status.critical,
  },
  "50%": {
    opacity: 0.35,
    boxShadow: "0 0 0 rgba(0, 0, 0, 0)",
    backgroundColor: "rgba(0, 0, 0, 0)",
  },
});

export const loadTestStatus = style({
  display: "inline-flex",
  alignItems: "center",
  gap: theme.spacing["2"],
  clipPath: theme.clipPath.sm,
  backgroundColor: "rgba(28, 46, 38, 0.8)",
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  textTransform: "uppercase",
  letterSpacing: theme.typography.letterSpacing.wide,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const loadTestStatusIndicator = style({
  display: "inline-block",
  flexShrink: 0,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(28, 46, 38, 0.92)",
  width: "0.65rem",
  height: "0.65rem",
});

export const loadTestStatusIndicatorActive = style({
  borderColor: theme.color.status.critical,
  boxShadow: `0 0 10px ${theme.color.status.critical}`,
  backgroundColor: theme.color.status.critical,

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
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(14, 24, 19, 0.85)",
  padding: `${theme.spacing["3"]} ${theme.spacing["3"]}`,
});

export const metricLabel = style({
  textTransform: theme.typography.textTransform.uppercase,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const metricValue = style({
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.sans,
  fontSize: theme.typography.size.lg,
});

export const chartWrapper = style({
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "rgba(12, 20, 16, 0.9)",
  padding: theme.spacing["3"],
  width: "100%",
  height: "180px",
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
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
});

export const chartRow = style({
  display: "grid",
  gridTemplateColumns: "minmax(140px, 180px) 1fr",
  alignItems: "center",
  gap: theme.spacing["3"],

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
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
});

export const historyDetailHeader = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: theme.spacing["3"],
});

export const historyCloseButton = style({
  transition: theme.transition.base,
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  backgroundColor: "transparent",
  cursor: "pointer",
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,

  selectors: {
    "&:hover": {
      boxShadow: theme.effect.glow.sm,
      backgroundColor: theme.color.surface.overlay,
    },
  },
});

export const latencyBandsCard = style([
  panel,
  {
    padding: `${theme.spacing["4"]} ${theme.spacing["4"]}`,
    minHeight: "auto",
  },
]);

export const latencyBandsHeader = style({
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  marginBottom: theme.spacing["2"],
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
});

export const latencyLegend = style({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing["3"],
  marginTop: theme.spacing["3"],
});

export const latencyLegendItem = style({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing["1"],
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const latencyLegendSwatch = style({
  display: "inline-block",
  clipPath: theme.clipPath.sm,
  width: 12,
  height: 12,
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
  backgroundImage: `
		linear-gradient(${theme.color.grid} 1px, transparent 1px),
		linear-gradient(90deg, ${theme.color.grid} 1px, transparent 1px)
	`,
  backgroundSize: "20px 20px",
  padding: `${theme.spacing["12"]} ${theme.spacing["4"]}`,
  minHeight: "300px",
  textAlign: "center",
  color: theme.color.foreground.secondary,
});

globalStyle(`${responseEmptyState} h3`, {
  margin: 0,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.lg,
});

globalStyle(`${responseEmptyState} p`, {
  margin: 0,
  maxWidth: "400px",
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
});

globalStyle(`${responseEmptyState} kbd`, {
  display: "inline-block",
  clipPath: theme.clipPath.sm,
  border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
  backgroundColor: theme.color.background.raised,
  padding: `${theme.spacing["1"]} ${theme.spacing["2"]}`,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
  fontWeight: theme.typography.weight.bold,
});

globalStyle(`${responseEmptyState} svg`, {
  opacity: 0.6,
  color: theme.color.status.selected,
});

export const responseLoadingState = style({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing["4"],
  backgroundImage: `
		linear-gradient(${theme.color.grid} 1px, transparent 1px),
		linear-gradient(90deg, ${theme.color.grid} 1px, transparent 1px)
	`,
  backgroundSize: "20px 20px",
  padding: `${theme.spacing["12"]} ${theme.spacing["4"]}`,
  minHeight: "300px",
  textAlign: "center",
  color: theme.color.foreground.secondary,
});

globalStyle(`${responseLoadingState} h3`, {
  margin: 0,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.lg,
});

globalStyle(`${responseLoadingState} p`, {
  margin: 0,
  maxWidth: "400px",
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
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
  backgroundImage: `
		linear-gradient(${theme.color.grid} 1px, transparent 1px),
		linear-gradient(90deg, ${theme.color.grid} 1px, transparent 1px)
	`,
  backgroundSize: "20px 20px",
  padding: `${theme.spacing["12"]} ${theme.spacing["4"]}`,
  minHeight: "300px",
  textAlign: "center",
  color: theme.color.foreground.secondary,
});

globalStyle(`${responseErrorState} h3`, {
  margin: 0,
  textTransform: theme.typography.textTransform.uppercase,
  letterSpacing: theme.typography.letterSpacing.wide,
  color: theme.color.status.critical,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.lg,
});

globalStyle(`${responseErrorState} svg`, {
  color: theme.color.status.critical,
});

export const responseErrorMessage = style({
  clipPath: theme.clipPath.md,
  margin: 0,
  border: `${theme.border.width.thin} solid ${theme.color.status.critical}`,
  backgroundColor: theme.color.background.raised,
  padding: theme.spacing["4"],
  maxWidth: "600px",
  overflowX: "auto",
  textAlign: "left",
  color: theme.color.foreground.primary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
});
