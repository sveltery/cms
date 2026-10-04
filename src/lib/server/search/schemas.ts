// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/api/schemas/search.ts
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt. Native import hosting only.
import { z } from "zod";

import { SEARCH_TOKENIZERS } from "../content-picker/types.ts";
import { localeCode } from "../menus/schema-common.ts";

// ---------------------------------------------------------------------------
// Search: Input schemas
// ---------------------------------------------------------------------------

export const searchQuery = z
	.object({
		q: z.string().min(1),
		collections: z.string().optional(),
		status: z.string().optional(),
		locale: localeCode.optional(),
		limit: z.coerce.number().int().min(1).max(100).optional(),
		cursor: z.string().optional(),
		scope: z.enum(["all", "title"]).optional().meta({
			description:
				"Which indexed fields to match against. 'title' matches only the collection's title field; collections without an indexed title field return no results. Defaults to 'all'.",
		}),
	})
	.meta({ id: "SearchQuery" });

export const searchSuggestQuery = z
	.object({
		q: z.string().min(1),
		collections: z.string().optional(),
		locale: localeCode.optional(),
		limit: z.coerce.number().int().min(1).max(20).optional(),
	})
	.meta({ id: "SearchSuggestQuery" });

export const searchRebuildBody = z
	.object({
		collection: z.string().min(1),
	})
	.meta({ id: "SearchRebuildBody" });

export const searchEnableBody = z
	.object({
		collection: z.string().min(1),
		enabled: z.boolean(),
		weights: z.record(z.string(), z.number()).optional(),
		tokenize: z.enum(SEARCH_TOKENIZERS).optional(),
	})
	.meta({ id: "SearchEnableBody" });

// ---------------------------------------------------------------------------
// Search: Response schemas
// ---------------------------------------------------------------------------

export const searchResultSchema = z
	.object({
		collection: z.string(),
		id: z.string(),
		slug: z.string().nullable(),
		locale: z.string(),
		title: z.string().optional(),
		snippet: z.string().optional(),
		score: z.number(),
	})
	.meta({ id: "SearchResult" });

export const searchResponseSchema = z
	.object({
		items: z.array(searchResultSchema),
		nextCursor: z.string().optional(),
	})
	.meta({ id: "SearchResponse" });
