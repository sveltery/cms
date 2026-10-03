// Ported exact assertion expressions from EmDash 1.1.0.
// Source: packages/admin/tests/lib/content-validation-errors.test.ts at
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; MIT Copyright 2026 Cloudflare Inc.
// See notices/emdash-MIT.txt. Node test runner and native HttpError fixture only.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { error } from '@sveltejs/kit';
const expect = (actual: unknown) => ({
  toBe(expected: unknown) { assert.equal(actual, expected); },
  toBeUndefined() { assert.equal(actual, undefined); }
});

// Preserve every source expression while adapting the API error to real Kit
// HttpError. The missing-helper fallback establishes assertion-level baseline
// red before any product implementation edits, and cannot satisfy six cases.
class ApiResponseError {
  constructor(status: number, code: string, message: string, details?: unknown) {
    try { error(status, { code, message, details } as App.Error); }
    catch (cause) { return cause as ApiResponseError; }
  }
}
const moduleURL = new URL('../src/lib/ui/content-validation-errors.ts', import.meta.url);
const { describeContentValidationError } = await import(moduleURL.href).catch(cause => {
  if (cause.code !== 'ERR_MODULE_NOT_FOUND') throw cause;
  return { describeContentValidationError: (_error: unknown, _fields: unknown) => undefined };
});

const FIELDS = {
	title: { kind: "string", label: "Headline" },
	excerpt: { kind: "string", label: "Summary" },
	reading_minutes: { kind: "number", label: "Reading time" },
	subtitle: { kind: "string" },
	related: { kind: "reference", label: "Related post" },
	stops: {
		kind: "repeater",
		label: "Stops",
		validation: { subFields: [{ slug: "name", type: "string", label: "Stop name" }] },
	},
};

function validationError(issues: unknown[]) {
	return new ApiResponseError(400, "VALIDATION_ERROR", "raw server message", { issues });
}

describe("describeContentValidationError", () => {
	it("names each field by its editor label and words the failed bound", () => {
		const error = validationError([
			{ path: "title", code: "required", message: "Invalid input" },
			{ path: "excerpt", code: "too_big", origin: "string", maximum: 160, message: "Too big" },
			{ path: "reading_minutes", code: "too_small", origin: "number", minimum: 1, message: "x" },
			{ path: "stops", code: "too_big", origin: "array", maximum: 1, message: "Too big" },
		]);

		expect(describeContentValidationError(error, FIELDS)).toBe(
			"Headline is required. Summary can have at most 160 characters. Reading time must be at least 1. Stops can have at most 1 item.",
		);
	});

	it("names a repeater sub-field together with its row", () => {
		const error = validationError([
			{ path: "stops.1.name", code: "required", message: "required (empty value not allowed)" },
		]);

		expect(describeContentValidationError(error, FIELDS)).toBe(
			"Stop name (Stops, item 2) is required.",
		);
	});

	it("falls back to the capitalized slug the editor shows for an unlabeled field", () => {
		const error = validationError([
			{ path: "subtitle", code: "too_small", origin: "string", minimum: 3, message: "x" },
		]);

		expect(describeContentValidationError(error, FIELDS)).toBe(
			"Subtitle needs at least 3 characters.",
		);
	});

	it("says once per field that a value is missing when core reports it twice", () => {
		const error = validationError([
			{ path: "title", code: "invalid_type", message: "expected object, received string" },
			{ path: "title", code: "required", message: "required (empty value not allowed)" },
		]);

		expect(describeContentValidationError(error, FIELDS)).toBe("Headline is required.");
	});

	it("names every rule a field breaks", () => {
		const error = validationError([
			{ path: "excerpt", code: "too_small", origin: "string", minimum: 3, message: "x" },
			{ path: "excerpt", code: "invalid_format", format: "regex", message: "x" },
		]);

		expect(describeContentValidationError(error, FIELDS)).toBe(
			"Summary needs at least 3 characters. Summary does not match the required format.",
		);
	});

	it("words references, unknown keys and unrecognized codes without raw validator text", () => {
		const error = validationError([
			{ path: "related", code: "reference_not_found", message: "target 'x' not found" },
			{ path: "legacy_hits", code: "unknown_field", message: "unknown field" },
			{ path: "excerpt", code: "custom", message: "Invalid input" },
		]);

		expect(describeContentValidationError(error, FIELDS)).toBe(
			"Related post links to an entry that does not exist or is in the trash. legacy_hits is not a field in this collection. Summary has an invalid value.",
		);
	});

	it("leaves request-shape issues and other errors to the server message", () => {
		const requestShape = validationError([{ path: "slug", message: "Invalid input" }]);
		const conflict = new ApiResponseError(409, "SLUG_CONFLICT", "Slug exists");

		expect(describeContentValidationError(requestShape, FIELDS)).toBeUndefined();
		expect(describeContentValidationError(conflict, FIELDS)).toBeUndefined();
		expect(describeContentValidationError(new Error("offline"), FIELDS)).toBeUndefined();
	});
});
