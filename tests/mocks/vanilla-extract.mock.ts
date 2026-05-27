/**
 * Mock for app-local `.css.ts` modules in tests.
 *
 * Most imports are consumed as class-name strings, but some style utility
 * modules export functions (`flex`) or token objects (`theme`). Provide
 * lightweight stubs for both cases so component imports can execute.
 */

const classNameProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof prop === "string") {
        return "";
      }
      return undefined;
    },
  },
);

const tokenProxy: Record<string | symbol, unknown> = new Proxy(
  {},
  {
    get(_target, prop) {
      if (prop === Symbol.toPrimitive) {
        return () => "";
      }
      if (prop === "toString" || prop === "valueOf") {
        return () => "";
      }
      return tokenProxy;
    },
  },
);

export const flex = (): string => "";
export const sprinkles = (): string => "";
export const theme = tokenProxy;
export const themeContract = tokenProxy;
export const defaultTheme = "";
export const darkTheme = "";
export const lightTheme = "";
export const darkNordTheme = "";
export const componentsLayer = "";

export default classNameProxy;
