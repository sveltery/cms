// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Source: EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; see docs/cloudflare-runtime-ports.json.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const session = {
		prepare: vi.fn(),
		batch: vi.fn(),
		getBookmark: vi.fn(() => "d1-bookmark-1"),
	};
	const binding = {
		prepare: vi.fn(),
		batch: vi.fn(),
		withSession: vi.fn(() => session),
	};
	return { session, binding };
});

import * as product from "../../src/lib/server/runtime/environment.ts";
// Baseline bridge: main's raw-binding runtime has no request session API.
// Null is that existing no-session behavior; the source assertions remain unchanged.
const createRequestScopedDb = (opts: unknown) => {
  const factory = (product as Record<string, any>).createRequestScopedDb;
  return factory ? factory({ ...(opts as object), binding: mocks.binding }) : null;
};

const config = { binding: "DB", session: "auto" as const };

describe("D1 request scoping bookmark persistence", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.session.getBookmark.mockReturnValue("d1-bookmark-1");
		mocks.binding.withSession.mockReturnValue(mocks.session);
	});

	it("persists the bookmark for a request that started authenticated", () => {
		const cookies = { get: vi.fn(), set: vi.fn() };
		const scoped = createRequestScopedDb({
			config,
			isAuthenticated: true,
			isWrite: false,
			cookies,
			url: new URL("https://example.com/_emdash/admin"),
		});

		expect(scoped).not.toBeNull();
		scoped!.commit();
		expect(cookies.set).toHaveBeenCalledWith(
			"__em_d1_bookmark",
			"d1-bookmark-1",
			expect.objectContaining({ httpOnly: true, secure: true }),
		);
	});

	it("persists the bookmark when the request becomes authenticated mid-request", () => {
		const cookies = { get: vi.fn(), set: vi.fn() };
		const scoped = createRequestScopedDb({
			config,
			isAuthenticated: false,
			endedAuthenticated: () => true,
			isWrite: true,
			cookies,
			url: new URL("https://example.com/_emdash/api/auth/passkey/verify"),
		});

		expect(scoped).not.toBeNull();
		scoped!.commit();
		expect(cookies.set).toHaveBeenCalledWith(
			"__em_d1_bookmark",
			"d1-bookmark-1",
			expect.objectContaining({ httpOnly: true, secure: true }),
		);
	});

	it("persists nothing for a request that stays anonymous", () => {
		const cookies = { get: vi.fn(), set: vi.fn() };
		const scoped = createRequestScopedDb({
			config,
			isAuthenticated: false,
			endedAuthenticated: () => false,
			isWrite: false,
			cookies,
			url: new URL("https://example.com/"),
		});

		expect(scoped).not.toBeNull();
		scoped!.commit();
		expect(cookies.set).not.toHaveBeenCalled();
	});
});
