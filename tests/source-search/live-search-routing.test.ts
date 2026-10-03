// EmDash 1.1.0 immutable 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; complete callbacks, native import substitutions.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import { describe, expect, it } from "vitest";

import { buildLiveSearchResultUrl } from "../../src/lib/search/live-search-routing.ts";

describe("buildLiveSearchResultUrl", () => {
	it("uses the default collection URL when no route template exists", () => {
		expect(
			buildLiveSearchResultUrl({
				collection: "posts",
				id: "post-1",
				slug: "hello-world",
			}),
		).toBe("/posts/hello-world");
	});

	it("falls back to the id when a result has no slug", () => {
		expect(
			buildLiveSearchResultUrl({
				collection: "products",
				id: "product-1",
				slug: null,
			}),
		).toBe("/products/product-1");
	});

	it("applies collection route templates", () => {
		expect(
			buildLiveSearchResultUrl(
				{
					collection: "games",
					id: "game-1",
					slug: "mausritter",
				},
				{
					games: "/item/:slug",
				},
			),
		).toBe("/item/mausritter");
	});

	it("replaces all supported route template tokens", () => {
		expect(
			buildLiveSearchResultUrl(
				{
					collection: "games",
					id: "game-1",
					slug: null,
				},
				{
					games: "/:collection/:id/:slug/:path",
				},
			),
		).toBe("/games/game-1/game-1/game-1");
	});

	it("treats dollar signs in route values as literal text", () => {
		expect(
			buildLiveSearchResultUrl(
				{
					collection: "game$collection",
					id: "id$&$1",
					slug: "slug$$",
				},
				{
					game$collection: "/:collection/:id/:slug/:path",
				},
			),
		).toBe("/game$collection/id$&$1/slug$$/slug$$");
	});

	it("treats dollar signs in fallback slug values as literal text", () => {
		expect(
			buildLiveSearchResultUrl(
				{
					collection: "games",
					id: "id$&$1",
					slug: null,
				},
				{
					games: "/:slug/:path",
				},
			),
		).toBe("/id$&$1/id$&$1");
	});
});
