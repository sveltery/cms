// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Immutable EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; source packages/core/src/media/usage/types.ts; blob c25b56f3ef56a90ae3f65502c66263726cfc799a.
import type { BlockType } from "../../../../schema/block-types.ts";
import type { FieldType } from "../../../../schema/types.ts";

export const CONTENT_SOURCE_SCHEMA_VERSION = 2;

export type MediaKind =
	| "image"
	| "video"
	| "audio"
	| "document"
	| "archive"
	| "font"
	| "text"
	| "other";

export type MediaUsageReferenceType = "image_field" | "file_field" | "portable_text_image";

export interface MediaUsageExtractionSubField {
	slug: string;
	type: FieldType;
	label?: string;
}

export interface MediaUsageExtractionValidation {
	subFields?: readonly MediaUsageExtractionSubField[];
}

export interface MediaUsageExtractionField {
	slug: string;
	type: FieldType;
	validation?: MediaUsageExtractionValidation | null;
	blockTypes?: readonly BlockType[];
}

export interface ExtractMediaUsageOccurrencesInput {
	fields: readonly MediaUsageExtractionField[];
	data: Record<string, unknown>;
}

export interface ExtractedMediaUsageOccurrence {
	fieldSlug: string;
	fieldPath: string;
	occurrenceIndex: number;
	referenceType: MediaUsageReferenceType;
	mediaId: string | null;
	provider: string;
	providerAssetId: string;
	mediaKind: MediaKind | null;
	mimeType: string | null;
}
