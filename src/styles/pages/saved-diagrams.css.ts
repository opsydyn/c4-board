/**
 * Saved Diagrams Page Styles
 *
 * Page-level styling for the saved diagrams list view
 */

import { style } from "@vanilla-extract/css";
import { theme } from "../theme.css";

export const pageMain = style({
  display: "flex",
  flexDirection: "column",
  margin: "0 auto",
  padding: theme.spacing["8"],
  maxWidth: "1400px",
  height: "calc(100vh - 4rem)",
});

export const pageHeading = style({
  marginBottom: theme.spacing["8"],
  color: theme.color.foreground.primary,
  fontSize: theme.typography.size["2xl"],
  fontWeight: theme.typography.weight.bold,
});

export const backLinkContainer = style({
  marginBottom: theme.spacing["4"],
});

export const backLink = style({
  transition: theme.transition.fast,
  textDecoration: "underline",
  color: theme.color.interactive.primary,

  selectors: {
    "&:hover": {
      textDecoration: "none",
      color: theme.color.interactive.hover,
    },
  },
});

export const tableWrapper = style({
  flex: 1,
  minHeight: 0,
});
