// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/schema/registry.ts; complete fingerprint and canonicalizer declarations.
import type { CreateCollectionInput, CreateFieldInput } from "../schema/types.ts";

export async function buildSeedCollectionCaptureFingerprint(
	input: Omit<CreateCollectionInput, "source">,
	fields: readonly CreateFieldInput[],
): Promise<string> {
	const supports = input.supports ?? ["drafts", "revisions"];
	const hasSeo = input.hasSeo ?? supports.includes("seo") ?? false;
	let maxSortOrder = -1;
	const definitions = fields.map((field) => {
		const sortOrder = field.sortOrder ?? maxSortOrder + 1;
		maxSortOrder = Math.max(maxSortOrder, sortOrder);
		return {
			slug: field.slug,
			label: field.label,
			type: field.type,
			required: field.required ?? false,
			unique: field.unique ?? false,
			defaultValue: field.defaultValue === undefined ? null : JSON.stringify(field.defaultValue),
			validation: field.validation ? JSON.stringify(field.validation) : null,
			widget: field.widget ?? null,
			options: field.options ? JSON.stringify(field.options) : null,
			sortOrder,
			searchable: field.searchable ?? false,
			translatable: field.translatable ?? true,
		};
	});
	const payload = JSON.stringify(
		canonicalizeFingerprintValue({
			version: 1,
			collection: {
				slug: input.slug,
				label: input.label,
				labelSingular: input.labelSingular ?? null,
				description: input.description ?? null,
				icon: input.icon ?? null,
				admin: input.admin ?? null,
				supports,
				hasSeo,
				hidden: input.hidden ?? false,
				sortOrder: input.sortOrder ?? null,
				...(input.group ? { group: input.group } : {}),
				commentsEnabled: input.commentsEnabled ?? false,
				...(input.editLocking === false ? { editLocking: false } : {}),
				urlPattern: input.urlPattern ?? null,
				routable: input.routable ?? true,
			},
			fields: definitions,
		}),
	);
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
	const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
	return `media-usage-seed:v1:sha256:${hex}`;
}

function canonicalizeFingerprintValue(value: unknown): unknown {
	if (value === undefined) return { __emdashUndefined: true };
	if (Array.isArray(value)) return value.map(canonicalizeFingerprintValue);
	if (typeof value !== "object" || value === null) return value;

	const canonical: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value).toSorted(([a], [b]) => a.localeCompare(b))) {
		canonical[key] = canonicalizeFingerprintValue(entry);
	}
	return canonical;
}
