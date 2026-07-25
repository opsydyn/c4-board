import { style } from "@vanilla-extract/css";
import { componentsLayer } from "../../../styles/layers.css";
import { theme } from "../../../styles/theme.css";

export const agentField = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing["2"],
      textTransform: theme.typography.textTransform.uppercase,
      letterSpacing: theme.typography.letterSpacing.wide,
      color: theme.color.foreground.secondary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
    },
  },
});

export const agentInput = style({
  "@layer": {
    [componentsLayer]: {
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.input,
      padding: theme.spacing["3"],
      resize: "vertical",
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.sm,
      ":focus": {
        outline: "none",
        borderColor: theme.color.border.focus,
      },
    },
  },
});

/** Kept adjacent to the submit control: egress consent should not be hidden. */
export const agentConsent = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      alignItems: "center",
      gap: theme.spacing["2"],
      color: theme.color.foreground.secondary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
    },
  },
});

export const agentSubmit = style({
  "@layer": {
    [componentsLayer]: {
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.thin} solid ${theme.color.border.primary}`,
      backgroundColor: theme.color.interactive.primary,
      cursor: "pointer",
      padding: `${theme.spacing["2"]} ${theme.spacing["3"]}`,
      textTransform: theme.typography.textTransform.uppercase,
      letterSpacing: theme.typography.letterSpacing.wide,
      color: theme.color.background.base,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
      ":disabled": {
        opacity: theme.opacity.disabled,
        cursor: "not-allowed",
      },
    },
  },
});

export const agentError = style({
  "@layer": {
    [componentsLayer]: {
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.thin} solid ${theme.color.status.critical}`,
      padding: theme.spacing["3"],
      color: theme.color.status.critical,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
    },
  },
});

export const agentProposal = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing["2"],
      clipPath: theme.clipPath.sm,
      border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
      padding: theme.spacing["4"],
      color: theme.color.foreground.primary,
      fontSize: theme.typography.size.sm,
    },
  },
});

export const agentProposalRow = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      gap: theme.spacing["2"],
      color: theme.color.foreground.secondary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
    },
  },
});

export const agentWarning = style({
  "@layer": {
    [componentsLayer]: {
      margin: 0,
      color: theme.color.status.caution,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
    },
  },
});
