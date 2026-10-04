// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/seed/default.ts; complete import-adapted body.
/**
 * Default seed applied when no user seed file exists.
 *
 * Provides the baseline schema every EmDash site needs:
 * posts, pages, categories, and tags.
 */

import type { SeedFile } from "./types.ts";

export const defaultSeed: SeedFile = {
	version: "1",
	meta: {
		name: "Default",
		description: "Posts and pages with categories and tags",
	},
	collections: [
		{
			slug: "posts",
			label: "Posts",
			labelSingular: "Post",
			supports: ["drafts", "revisions", "search"],
			fields: [
				{
					slug: "title",
					label: "Title",
					type: "string",
					required: true,
					searchable: true,
				},
				{
					slug: "featured_image",
					label: "Featured Image",
					type: "image",
				},
				{
					slug: "content",
					label: "Content",
					type: "portableText",
					searchable: true,
				},
				{
					slug: "excerpt",
					label: "Excerpt",
					type: "text",
				},
			],
		},
		{
			slug: "pages",
			label: "Pages",
			labelSingular: "Page",
			supports: ["drafts", "revisions", "search"],
			fields: [
				{
					slug: "title",
					label: "Title",
					type: "string",
					required: true,
					searchable: true,
				},
				{
					slug: "content",
					label: "Content",
					type: "portableText",
					searchable: true,
				},
			],
		},
	],
	taxonomies: [
		{
			name: "category",
			label: "Categories",
			labelSingular: "Category",
			hierarchical: true,
			collections: ["posts"],
		},
		{
			name: "tag",
			label: "Tags",
			labelSingular: "Tag",
			hierarchical: false,
			collections: ["posts"],
		},
	],
};
