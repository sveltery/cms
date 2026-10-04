// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; whole Source packages/core/src/media/usage/source-key.ts.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Host adaptations are explicitly inventoried in the block registry proposal.
export const MEDIA_USAGE_CONTENT_SOURCE_VARIANTS = ["columns", "draft_overlay"] as const;

export type MediaUsageContentSourceVariant = (typeof MEDIA_USAGE_CONTENT_SOURCE_VARIANTS)[number];

export interface ContentMediaUsageSourceKeyInput {
	collectionId?: string;
	collectionSlug: string;
	contentId: string;
	sourceVariant: MediaUsageContentSourceVariant;
}

export function isMediaUsageContentSourceVariant(
	value: unknown,
): value is MediaUsageContentSourceVariant {
	return (
		typeof value === "string" &&
		(MEDIA_USAGE_CONTENT_SOURCE_VARIANTS as readonly string[]).includes(value)
	);
}

export function buildContentMediaUsageSourceKey(input: ContentMediaUsageSourceKeyInput): string {
	if (input.collectionId) {
		return `content:${input.collectionId}:${input.contentId}:${input.sourceVariant}`;
	}
	return `content:${input.collectionSlug}:${input.contentId}:${input.sourceVariant}`;
}
