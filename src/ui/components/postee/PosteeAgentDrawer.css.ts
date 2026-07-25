import { style } from "@vanilla-extract/css";
import { componentsLayer } from "../../../styles/layers.css";
import { settingsCard, settingsCardDanger } from "../../../styles/pages/settings.css";
import { theme } from "../../../styles/theme.css";

/**
 * The settings card, minus the 180px floor it needs to keep a two-column grid
 * even. In a drawer the cards are stacked, so a short one should stay short.
 *
 * Composed unlayered, like the styles it overrides — a layered rule would lose
 * the cascade to an unlayered one no matter how specific it is.
 */
export const agentCard = style([settingsCard, { minHeight: 0 }]);

/** settingsCardDanger only tints; the card itself still supplies the box. */
export const agentCardDanger = style([agentCard, settingsCardDanger]);

/** Card rhythm inside the drawer, matching the settings grid's spacing. */
export const agentBody = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      flexDirection: "column",
      gap: theme.spacing["4"],
      minHeight: 0,
    },
  },
});

export const agentPrompt = style([
  {
    "@layer": {
      [componentsLayer]: {
        clipPath: theme.clipPath.sm,
        border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
        backgroundColor: theme.color.background.input,
        resize: "vertical",
        color: theme.color.foreground.primary,
        fontFamily: theme.typography.family.mono,
        fontSize: theme.typography.size.sm,
        ":focus": {
          outline: "none",
          borderColor: theme.color.border.focus,
          boxShadow: theme.effect.glow.sm,
        },
      },
    },
  },
  // Unlayered: the global reset zeroes padding without a layer, so a layered
  // padding never applies. See Drawer.css.ts.
  { padding: theme.spacing["3"] },
]);

export const agentProposalMeta = style({
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      alignItems: "baseline",
      gap: theme.spacing["2"],
      minWidth: 0,
    },
  },
});

export const agentMethod = style({
  "@layer": {
    [componentsLayer]: {
      color: theme.color.status.ready,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
      fontWeight: theme.typography.weight.bold,
    },
  },
});

/** A URL is the longest thing here; it wraps rather than widening the drawer. */
export const agentUrl = style({
  "@layer": {
    [componentsLayer]: {
      overflowWrap: "anywhere",
      color: theme.color.foreground.primary,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
    },
  },
});

export const agentRationale = style({
  "@layer": {
    [componentsLayer]: {
      margin: 0,
      lineHeight: 1.5,
      color: theme.color.foreground.secondary,
      fontFamily: theme.typography.family.sans,
      fontSize: theme.typography.size.sm,
    },
  },
});

/** Sanitizer repairs and model assumptions — read before sending, not after. */
export const agentWarning = style([{
  "@layer": {
    [componentsLayer]: {
      display: "flex",
      gap: theme.spacing["2"],
      margin: 0,
      borderLeft: `${theme.border.width.base} solid ${theme.color.status.caution}`,
      color: theme.color.status.caution,
      fontFamily: theme.typography.family.mono,
      fontSize: theme.typography.size.xs,
    },
  },
}, { paddingLeft: theme.spacing["2"] }]);
