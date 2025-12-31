import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { validateRequestForm } from "@/core/effects/postee/form-validation";

describe("validateRequestForm", () => {
	it("should accept valid request form with all fields", async () => {
		// Arrange: Create valid form data
		const formData = {
			name: "Get User Profile",
			url: "https://api.example.com/users/123",
			method: "GET",
		};

		// Act: Validate form
		const result = await Effect.runPromise(validateRequestForm(formData));

		// Assert: Should return validated data
		expect(result).toEqual({
			name: "Get User Profile",
			url: "https://api.example.com/users/123",
			method: "GET",
		});
	});

	it("should reject empty request name", async () => {
		// Arrange: Form with empty name
		const formData = {
			name: "",
			url: "https://api.example.com/users/123",
			method: "GET",
		};

		// Act & Assert: Should fail validation
		await expect(
			Effect.runPromise(validateRequestForm(formData)),
		).rejects.toThrow();
	});

	it("should reject empty URL", async () => {
		// Arrange: Form with empty URL
		const formData = {
			name: "Get User",
			url: "",
			method: "GET",
		};

		// Act & Assert: Should fail validation
		await expect(
			Effect.runPromise(validateRequestForm(formData)),
		).rejects.toThrow();
	});

	it("should reject invalid URL format", async () => {
		// Arrange: Form with invalid URL
		const formData = {
			name: "Get User",
			url: "not-a-valid-url",
			method: "GET",
		};

		// Act & Assert: Should fail validation
		await expect(
			Effect.runPromise(validateRequestForm(formData)),
		).rejects.toThrow();
	});

	it("should reject invalid HTTP method", async () => {
		// Arrange: Form with invalid method
		const formData = {
			name: "Get User",
			url: "https://api.example.com/users/123",
			method: "INVALID",
		};

		// Act & Assert: Should fail validation
		await expect(
			Effect.runPromise(validateRequestForm(formData)),
		).rejects.toThrow();
	});

	it("should trim whitespace from inputs", async () => {
		// Arrange: Form with whitespace
		const formData = {
			name: "  Get User Profile  ",
			url: "  https://api.example.com/users/123  ",
			method: "  GET  ",
		};

		// Act: Validate form
		const result = await Effect.runPromise(validateRequestForm(formData));

		// Assert: Should return trimmed data
		expect(result).toEqual({
			name: "Get User Profile",
			url: "https://api.example.com/users/123",
			method: "GET",
		});
	});
});
