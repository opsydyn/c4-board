import { globalStyle, style } from "@vanilla-extract/css";
import { theme } from "../../styles/theme.css";

export const root = style({
  display: "grid",
  gridTemplateColumns: "minmax(15rem, 22rem) minmax(0, 1fr)",
  width: "100%",
  minHeight: 0,
  overflow: "hidden",
  "@media": {
    "screen and (max-width: 760px)": {
      gridTemplateColumns: "1fr",
      overflowY: "auto",
    },
  },
});

export const list = style({
  borderRight: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
  overflowY: "auto",
});

export const listHeader = style({
  display: "flex",
  justifyContent: "space-between",
  padding: `${theme.spacing["3"]} ${theme.spacing["4"]}`,
  textTransform: "uppercase",
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const entry = style({
  display: "grid",
  gap: theme.spacing["1"],
  border: 0,
  borderTop: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  background: "transparent",
  cursor: "pointer",
  padding: `${theme.spacing["3"]} ${theme.spacing["4"]}`,
  width: "100%",
  textAlign: "left",
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
  selectors: {
    "&:hover, &:focus-visible": {
      backgroundColor: theme.color.background.raised,
      color: theme.color.foreground.primary,
    },
  },
});

globalStyle(`${entry} strong`, { color: theme.color.foreground.primary });
globalStyle(`${entry} time`, { color: theme.color.foreground.tertiary });

export const entryActive = style({
  borderLeft: `3px solid ${theme.color.status.selected}`,
  backgroundColor: theme.color.background.raised,
});

export const detail = style({ padding: theme.spacing["5"], overflow: "auto" });
export const detailHeader = style({
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "space-between",
  gap: theme.spacing["4"],
  marginBottom: theme.spacing["5"],
});
globalStyle(`${detailHeader} h3`, { margin: `${theme.spacing["1"]} 0 0`, letterSpacing: 0 });
export const eyebrow = style({
  textTransform: "uppercase",
  color: theme.color.status.selected,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});
export const meta = style({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing["3"],
  textTransform: "uppercase",
  color: theme.color.foreground.tertiary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});

export const metrics = style({
  width: "100%",
  borderCollapse: "collapse",
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});
globalStyle(`${metrics} th, ${metrics} td`, {
  borderBottom: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  padding: `${theme.spacing["3"]} ${theme.spacing["2"]}`,
  textAlign: "right",
});
globalStyle(`${metrics} th:first-child`, { textAlign: "left" });
globalStyle(`${metrics} td[data-favored="recommended"]`, { color: theme.color.status.ready });
globalStyle(`${metrics} td[data-favored="original"]`, { color: theme.color.status.caution });

export const emptyState = style({
  display: "flex",
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing["2"],
  textTransform: "uppercase",
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
});
export const singleState = style({
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.sm,
});

export const historyActions = style({
  display: "flex",
  flex: "1 1 100%",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: theme.spacing["2"],
  borderTop: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
  paddingTop: theme.spacing["3"],
});

const actionButton = style({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing["1"],
  border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
  backgroundColor: theme.color.background.surface,
  cursor: "pointer",
  padding: `${theme.spacing["1"]} ${theme.spacing["3"]}`,
  minHeight: "2rem",
  textTransform: "uppercase",
  color: theme.color.foreground.secondary,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
  selectors: {
    "&:disabled": {
      opacity: 0.5,
      cursor: "not-allowed",
    },
  },
});

export const iconButton = style([actionButton, { padding: 0, width: "2rem" }]);
export const clearButton = style([actionButton]);
export const exportButton = style([
  actionButton,
  {
    marginRight: "auto",
    borderColor: theme.color.status.selected,
    color: theme.color.status.selected,
  },
]);
export const cancelButton = style([actionButton, { padding: 0, width: "2rem" }]);
export const dangerButton = style([
  actionButton,
  {
    borderColor: theme.color.status.critical,
    color: theme.color.status.critical,
  },
]);
export const error = style({
  border: `${theme.border.width.thin} solid ${theme.color.status.critical}`,
  padding: theme.spacing["3"],
  color: theme.color.status.critical,
  fontFamily: theme.typography.family.mono,
  fontSize: theme.typography.size.xs,
});
