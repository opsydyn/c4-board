/**
 * URL Validation Tests
 */

import { describe, it, expect } from "vitest";
import { validateUrl } from "@/core/effects/postee/url-validation";

describe("validateUrl", () => {
	it("should return Empty for empty string", () => {
		const result = validateUrl("");
		expect(result._tag).toBe("Empty");
	});

	it("should return Empty for whitespace-only string", () => {
		const result = validateUrl("   ");
		expect(result._tag).toBe("Empty");
	});

	it("should return Valid for https URL", () => {
		const result = validateUrl("https://api.example.com/users");
		expect(result._tag).toBe("Valid");
		if (result._tag === "Valid") {
			expect(result.url).toBe("https://api.example.com/users");
		}
	});

	it("should return Valid for http URL", () => {
		const result = validateUrl("http://localhost:3000/api");
		expect(result._tag).toBe("Valid");
	});

	it("should return Valid for relative path", () => {
		const result = validateUrl("/api/users");
		expect(result._tag).toBe("Valid");
	});

	it("should return Valid for URL with variables", () => {
		const result = validateUrl("https://{{baseUrl}}/users");
		expect(result._tag).toBe("Valid");
	});

	it("should return Invalid with suggestion for missing protocol", () => {
		const result = validateUrl("api.example.com/users");
		expect(result._tag).toBe("Invalid");
		if (result._tag === "Invalid") {
			expect(result.error).toBe("Missing protocol");
			expect(result.suggestion).toBe("https://api.example.com/users");
		}
	});

	it("should return Invalid for malformed URL", () => {
		const result = validateUrl("ht!tp://bad url");
		expect(result._tag).toBe("Invalid");
		if (result._tag === "Invalid") {
			expect(result.error).toBe("Invalid URL format");
		}
	});

	it("should return Invalid for invalid format", () => {
		const result = validateUrl("not a url");
		expect(result._tag).toBe("Invalid");
		if (result._tag === "Invalid") {
			expect(result.error).toBe("Invalid URL format");
		}
	});

	it("should return Valid for localhost", () => {
		const result = validateUrl("http://localhost:8080");
		expect(result._tag).toBe("Valid");
	});

	it("should return Valid for IP address", () => {
		const result = validateUrl("http://192.168.1.1:3000/api");
		expect(result._tag).toBe("Valid");
	});
});
