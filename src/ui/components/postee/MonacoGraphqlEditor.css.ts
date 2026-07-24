import { style } from "@vanilla-extract/css";
import { componentsLayer } from "../../../styles/layers.css";
import { theme } from "../../../styles/theme.css";

export const graphqlEditor = style({
  "@layer": {
    [componentsLayer]: {
      clipPath: theme.clipPath.base,
      border: `${theme.border.width.thin} solid ${theme.color.border.secondary}`,
      backgroundColor: theme.color.background.surface,
      overflow: "hidden",

      ":focus-within": {
        borderColor: theme.color.border.focus,
        boxShadow: theme.effect.glow.sm,
      },
    },
  },
});
