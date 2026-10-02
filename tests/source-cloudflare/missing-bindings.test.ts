// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Source: EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; see docs/cloudflare-runtime-ports.json.
import { describe, expect, it, vi } from "vitest";
import * as product from "../../src/lib/server/runtime/environment.ts";
const EmDashConfigurationError = (product as Record<string, any>).CmsConfigurationError ?? class extends Error {};
const createD1Dialect = ({ binding }: { binding: string }) => product.runtimeConfiguration(
  { SVELTERY_D1_BINDING: binding, SVELTERY_PUBLIC_ORIGIN: "https://cms.example" }, { env: {} }
);
const fakeEnv: Record<string, unknown> = {};
const afterEach = (_fn: () => void) => {};
function thrown(call: () => unknown): Error & { code?: string } {
	try {
		call();
	} catch (error) {
		if (error instanceof Error) return error;
		throw new Error(`expected an Error, received ${String(error)}`, { cause: error });
	}
	throw new Error("expected a missing-binding error, but the call returned");
}

describe("missing binding diagnostics", () => {
	afterEach(() => {
		for (const key of Object.keys(fakeEnv)) delete fakeEnv[key];
	});

	it("names the D1 binding and the wrangler key that declares it", () => {
		const error = thrown(() => createD1Dialect({ binding: "SITE_DB" }));
		const { message } = error;
		expect(message).toContain("SITE_DB");
		expect(message).toContain("d1_databases");
		expect(error).toBeInstanceOf(EmDashConfigurationError);
		expect(error.code).toBe("BINDING_NOT_FOUND");
	});

});
