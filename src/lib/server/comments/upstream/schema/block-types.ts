// EmDash 1.1.0 MIT; Copyright 2026 Cloudflare Inc.; see notices/emdash-MIT.txt.
// Immutable source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/schema/block-types.ts; blob cc89213ee1815cf148a51ec927ab2d106828f5d3.
import type { FieldValidation, RepeaterSubField, UnsupportedFieldType } from "./types.ts";

export const BLOCK_FIELD_TYPES = [
	"string",
	"text",
	"url",
	"number",
	"integer",
	"boolean",
	"datetime",
	"select",
	"multiSelect",
	"portableText",
	"image",
	"file",
	"repeater",
] as const;

export type BlockFieldType = (typeof BLOCK_FIELD_TYPES)[number];
export type BlockTypeSource = "user" | "seed";

export interface BlockFieldOptions {
	darkVariant?: boolean;
}

export interface BlockFieldDefinition {
	slug: string;
	label: string;
	type: BlockFieldType;
	required?: boolean;
	defaultValue?: unknown;
	validation?: Omit<FieldValidation, "required">;
	options?: BlockFieldOptions;
}

export interface BlockTypeVersion {
	id: string;
	blockTypeId: string;
	version: number;
	fields: BlockFieldDefinition[];
	fingerprint: string;
	active: boolean;
	unsupportedTypes?: UnsupportedFieldType[];
	createdAt: string;
	updatedAt: string;
}

export interface BlockType {
	id: string;
	slug: string;
	label: string;
	description?: string;
	icon?: string;
	category?: string;
	currentVersion: number;
	source: BlockTypeSource;
	versions: BlockTypeVersion[];
	createdAt: string;
	updatedAt: string;
}

export interface CreateBlockTypeInput {
	slug: string;
	label: string;
	description?: string;
	icon?: string;
	category?: string;
	source?: BlockTypeSource;
	fields: BlockFieldDefinition[];
}

export interface UpdateBlockTypeInput {
	expectedFingerprint: string;
	label?: string;
	description?: string | null;
	icon?: string | null;
	category?: string | null;
	fields?: BlockFieldDefinition[];
	breaking?: boolean;
}

export interface SeedBlockTypeVersionInput {
	version: number;
	fields: BlockFieldDefinition[];
}

export interface ApplySeedBlockTypeInput {
	slug: string;
	label: string;
	description?: string;
	icon?: string;
	category?: string;
	currentVersion: number;
	versions: SeedBlockTypeVersionInput[];
}

export type BlockTypeDifferenceCompatibility = "compatible" | "breaking";

export interface BlockTypeDifference {
	path: string;
	change: string;
	compatibility: BlockTypeDifferenceCompatibility;
}

export interface BlockTypeCompatibility {
	compatible: boolean;
	differences: BlockTypeDifference[];
}

export type BlockRepeaterSubField = RepeaterSubField;
