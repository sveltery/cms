// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Native D1 sequential field-domain specialization of Source declarations; only native imports differ.
import type { Kysely } from 'kysely';
import { backfillReferenceEdges } from './upstream/database/reference-backfill.ts';
import { RelationRepository, type Relation } from './d1-providers.ts';

import type { Database } from './upstream/database/types.ts';
import { SchemaRegistry, SchemaError } from './registry.ts';
import type { Field, UpdateFieldInput } from '../schema/types.ts';

const RELATION_NAME_MAX_ATTEMPTS = 5;

function isUniqueViolation(error: unknown): boolean {
	const message = error instanceof Error ? error.message.toLowerCase() : "";
	return message.includes("unique constraint failed") || message.includes("duplicate key");
}

export async function createFieldRelation(
	trx: Kysely<Database>,
	collectionSlug: string,
	fieldSlug: string,
	fieldLabel: string,
	targetCollection: string,
	/** How many entries the new field may hold. `null` is unlimited. */
	maxChildrenPerParent: number | null = null,
): Promise<Relation> {
	const registry = new SchemaRegistry(trx);
	const relations = new RelationRepository(trx);

	const parent = await registry.getCollection(collectionSlug);
	if (!parent) {
		throw new SchemaError(`Collection "${collectionSlug}" not found`, "COLLECTION_NOT_FOUND");
	}

	if (!(await registry.getCollection(targetCollection))) {
		throw new SchemaError(
			`Target collection "${targetCollection}" not found`,
			"COLLECTION_NOT_FOUND",
		);
	}

	const baseSlug = `${collectionSlug}_${fieldSlug}`.slice(0, 63);
	for (let attempt = 0; attempt < RELATION_NAME_MAX_ATTEMPTS; attempt++) {
		const suffix = attempt === 0 ? "" : `_${attempt + 1}`;
		const slug = attempt === 0 ? baseSlug : `${baseSlug.slice(0, 63 - suffix.length)}${suffix}`;
		try {
			return await relations.create({
				slug,
				parentCollection: collectionSlug,
				childCollection: targetCollection,
				parentLabel: parent.label,
				parentLabelSingular: parent.labelSingular ?? null,
				childLabel: fieldLabel,
				maxChildrenPerParent,
			});
		} catch (error) {
			const isLastAttempt = attempt === RELATION_NAME_MAX_ATTEMPTS - 1;
			if (isLastAttempt || !isUniqueViolation(error)) throw error;
		}
	}
	throw new SchemaError("Could not allocate a unique relation name", "RELATION_NAME_CONFLICT");
}

export async function bindReferenceField(
	db: Kysely<Database>,
	collectionSlug: string,
	existing: Field,
	input: UpdateFieldInput,
	targetCollection: string,
): Promise<Field> {
	const label = input.label ?? existing.label;
	const maxChildren = input.validation?.multiple ? null : 1;

	const trx=db;
	{
		const relation = await createFieldRelation(
			trx,
			collectionSlug,
			existing.slug,
			label,
			targetCollection,
			maxChildren,
		);
		const registry = new SchemaRegistry(trx);
		const updated = await registry.updateField(collectionSlug, existing.slug, {
			...input,
			indexed: false,
			searchable: false,
			validation: {
				...input.validation,
				relation: relation.slug,
				relationSide: "parent",
				targetCollection,
			},
		});

		await backfillReferenceEdges(trx, {
			parentCollection: collectionSlug,
			childCollection: targetCollection,
			fieldSlug: existing.slug,
			relationId: relation.id,
			maxChildren,
		});

		return updated;
	}
}
