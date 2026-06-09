type StyleArg = string | false | null | undefined;

const joinClassNames = (...args: StyleArg[]): string =>
  args.filter((value): value is string => typeof value === "string" && value.length > 0).join(" ");

export const style = (...args: StyleArg[]): string => joinClassNames(...args);
export const globalStyle = (): void => {};
export const keyframes = (): string => "vanilla-extract-keyframes";
export const createVar = (name = "vanilla-extract-var"): string => name;
export const assignVars = (): void => {};
export const composeStyles = (...args: StyleArg[]): string => joinClassNames(...args);
export const fallbackVar = (value: string | undefined, fallback: string): string => value ?? fallback;
export const createTheme = <T>(vars: T): [T, string] => [vars, "vanilla-extract-theme"];
export const createThemeContract = <T>(contract: T): T => contract;
export const recipe = () => () => "vanilla-extract-recipe";

const stubDefault = new Proxy(
  {},
  {
    get: (_target, prop: string) => prop,
  },
);

export default stubDefault;
