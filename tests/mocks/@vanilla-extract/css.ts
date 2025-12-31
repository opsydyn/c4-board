/**
 * Mock for @vanilla-extract/css package in tests
 *
 * Provides stub implementations of Vanilla Extract APIs
 * so .css.ts files can be imported without errors.
 */

// Mock layer functions (used in layers.css.ts)
export function layer(_name: string): string {
	return "";
}

export function globalLayer(_order: string): void {
	// No-op
}

// Mock style function
export function style(_styles: unknown): string {
	return "";
}

// Mock styleVariants function
export function styleVariants<T extends Record<string, unknown>>(
	variants: T,
): Record<keyof T, string> {
	const result: Record<string, string> = {};
	for (const key in variants) {
		result[key] = "";
	}
	return result as Record<keyof T, string>;
}

// Mock globalStyle function
export function globalStyle(_selector: string, _styles: unknown): void {
	// No-op
}

// Mock createTheme function
export function createTheme(
	_contract: unknown,
	_tokens: unknown,
): string {
	return "";
}

// Mock createThemeContract function
export function createThemeContract<T>(
	_tokens: T,
): T {
	return _tokens;
}

// Re-export everything as default for namespace imports
export default {
	layer,
	globalLayer,
	style,
	styleVariants,
	globalStyle,
	createTheme,
	createThemeContract,
};
