/**
 * Mock for Vanilla Extract CSS modules in tests
 *
 * This provides a Proxy that returns empty strings for all imported class names
 * from .css.ts files, allowing components to render without CSS processing.
 */

export default new Proxy(
	{},
	{
		get(_target, prop) {
			// Return empty string for all class name accesses
			if (typeof prop === "string") {
				return "";
			}
			return undefined;
		},
	},
);
