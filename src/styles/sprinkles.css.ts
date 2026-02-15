import { recipe, type RecipeVariants } from "@vanilla-extract/recipes";
import { createSprinkles, defineProperties } from "@vanilla-extract/sprinkles";
import { theme } from "./theme.css";

/**
 * Sprinkles utility
 *
 * Central place for atomic layout/style helpers that can be reused across components
 * without creating new CSS classes for one-off adjustments.
 */
const layoutProperties = defineProperties({
  properties: {
    display: ["flex", "inline-flex"],
    flexDirection: ["row", "row-reverse", "column", "column-reverse"],
    alignItems: ["stretch", "flex-start", "center", "flex-end", "baseline"],
    justifyContent: [
      "flex-start",
      "center",
      "flex-end",
      "space-between",
      "space-around",
      "space-evenly",
    ],
    flexWrap: ["nowrap", "wrap", "wrap-reverse"],
    gap: theme.spacing,
    columnGap: theme.spacing,
    rowGap: theme.spacing,
  },
});

export const sprinkles = createSprinkles(layoutProperties);

export type Sprinkles = Parameters<typeof sprinkles>[0];

const spacingTokens = ["0", "1", "2", "3", "4", "5", "6", "8", "10", "12", "16"] as const;

type SpacingToken = (typeof spacingTokens)[number];

const createSpacingVariants = (property: "gap" | "columnGap" | "rowGap") =>
  spacingTokens.reduce<Record<SpacingToken, string>>((acc, token) => {
    acc[token] = sprinkles({ [property]: token } as Sprinkles);
    return acc;
  }, {} as Record<SpacingToken, string>);

const gapVariants = createSpacingVariants("gap");
const columnGapVariants = createSpacingVariants("columnGap");
const rowGapVariants = createSpacingVariants("rowGap");

export const flex = recipe({
  variants: {
    display: {
      flex: sprinkles({ display: "flex" }),
      inline: sprinkles({ display: "inline-flex" }),
    },
    direction: {
      row: sprinkles({ flexDirection: "row" }),
      rowReverse: sprinkles({ flexDirection: "row-reverse" }),
      column: sprinkles({ flexDirection: "column" }),
      columnReverse: sprinkles({ flexDirection: "column-reverse" }),
    },
    align: {
      stretch: sprinkles({ alignItems: "stretch" }),
      start: sprinkles({ alignItems: "flex-start" }),
      center: sprinkles({ alignItems: "center" }),
      end: sprinkles({ alignItems: "flex-end" }),
      baseline: sprinkles({ alignItems: "baseline" }),
    },
    justify: {
      start: sprinkles({ justifyContent: "flex-start" }),
      center: sprinkles({ justifyContent: "center" }),
      end: sprinkles({ justifyContent: "flex-end" }),
      between: sprinkles({ justifyContent: "space-between" }),
      around: sprinkles({ justifyContent: "space-around" }),
      evenly: sprinkles({ justifyContent: "space-evenly" }),
    },
    wrap: {
      nowrap: sprinkles({ flexWrap: "nowrap" }),
      wrap: sprinkles({ flexWrap: "wrap" }),
      wrapReverse: sprinkles({ flexWrap: "wrap-reverse" }),
    },
    gap: gapVariants,
    columnGap: columnGapVariants,
    rowGap: rowGapVariants,
  },
  defaultVariants: {
    display: "flex",
    direction: "row",
    align: "stretch",
    justify: "start",
    wrap: "nowrap",
  },
});

export type FlexVariants = RecipeVariants<typeof flex>;
