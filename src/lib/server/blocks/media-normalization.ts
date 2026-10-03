// Complete normalizeFieldValues, normalizeImageValue and normalizePrimaryImageValue
// from pinned EmDashRuntime913cb1bb, MIT Copyright2026Cloudflare Inc.
// Native class host only; no whole EmDashRuntime/plugin execution parity claim.
import type {Kysely} from 'kysely';
import type {CmsDatabase} from '../database/contract.ts';
import {SchemaRegistry} from '../database/registry.ts';
import type {CollectionWithFields} from '../schema/types.ts';
import {resolveBlockTypes} from './values.ts';
import {normalizeMediaValue} from '../media/source/media/normalize.ts';
import {createMediaProvider} from '../media/source/media/local-runtime.ts';
import type {MediaProvider,MediaValue} from '../media/source/media/types.ts';
import {blocksDatabase} from './host.ts';
type ImageValue=MediaValue & {darkVariant?:MediaValue};
const ARRAY_FIELD_TYPES=new Set<string>(['portableText','multiSelect','repeater']);
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
export class NativeFieldNormalizer {
 private db:ReturnType<typeof blocksDatabase>;
 private schemaRegistry:{getCollectionWithFields:(slug:string)=>Promise<CollectionWithFields|null>};
 private local:MediaProvider;
 private mediaProviders?:ReadonlyMap<string,MediaProvider>;
 constructor(database:CmsDatabase,mediaProviders?:ReadonlyMap<string,MediaProvider>){
  this.mediaProviders=mediaProviders;
  this.db=blocksDatabase(database);const registry=new SchemaRegistry(database);
  this.schemaRegistry={getCollectionWithFields:async slug=>await registry.getCollectionWithFields(slug) as unknown as CollectionWithFields|null};
  this.local=createMediaProvider({db:this.db});
 }
 private getMediaProvider(id:string){return this.mediaProviders?.get(id)??(id==='local'?this.local:undefined);}
	async normalizeFieldValues(
		collection: string,
		data: Record<string, unknown>,
		preloaded?: CollectionWithFields | null,
		preloadedBlockTypes?: Awaited<ReturnType<typeof resolveBlockTypes>>,
		includeBlocks = true,
	): Promise<Record<string, unknown>> {
		let collectionInfo = preloaded;
		if (collectionInfo === undefined) {
			try {
				collectionInfo = await this.schemaRegistry.getCollectionWithFields(collection);
			} catch {
				return data;
			}
		}
		if (!collectionInfo?.fields) return data;

		const result = { ...data };
		for (const field of collectionInfo.fields) {
			const value = result[field.slug];
			if (ARRAY_FIELD_TYPES.has(field.type) && typeof value === "string" && !value.trim()) {
				result[field.slug] = null;
			}
		}

		const imageFields = collectionInfo.fields.filter(
			(f) => f.type === "image" || f.type === "file",
		);
		// Repeater fields can contain image sub-fields, whose values need the same normalization
		// (a bare media id posted inside a repeater item would otherwise be stored verbatim and
		// render as "Image not found" in the admin).
		const repeaterFields = collectionInfo.fields.filter(
			(f) => f.type === "repeater" && Array.isArray(f.validation?.subFields),
		);
		const blockFields = includeBlocks
			? collectionInfo.fields.filter((field) => field.type === "blocks")
			: [];
		if (imageFields.length === 0 && repeaterFields.length === 0 && blockFields.length === 0) {
			return result;
		}

		const getProvider = (id: string) => this.getMediaProvider(id);

		for (const field of imageFields) {
			const value = result[field.slug];
			if (value == null) continue;

			try {
				// Only image fields carry a dark variant.
				const normalized =
					field.type === "image"
						? await normalizeImageValue(value, getProvider)
						: await normalizeMediaValue(value, getProvider);
				if (normalized) {
					result[field.slug] = normalized;
				}
			} catch {
				// Don't fail the save if normalization fails for a single field
			}
		}

		for (const field of repeaterFields) {
			const value = result[field.slug];
			if (!Array.isArray(value)) continue;

			const mediaSubFieldSlugs = (field.validation?.subFields ?? [])
				.filter((sub) => sub.type === "image")
				.map((sub) => sub.slug);
			if (mediaSubFieldSlugs.length === 0) continue;

			const items: unknown[] = value;
			result[field.slug] = await Promise.all(
				items.map(async (item) => {
					if (!isRecord(item)) return item;
					const normalizedItem: Record<string, unknown> = { ...item };
					for (const slug of mediaSubFieldSlugs) {
						const subValue = normalizedItem[slug];
						if (subValue == null) continue;
						try {
							const normalized = await normalizeImageValue(subValue, getProvider);
							if (normalized) {
								normalizedItem[slug] = normalized;
							}
						} catch {
							// Don't fail the save if normalization fails for a single sub-field
						}
					}
					return normalizedItem;
				}),
			);
		}

		if (blockFields.length > 0) {
			const blockTypes = preloadedBlockTypes ?? (await resolveBlockTypes(this.db));
			for (const field of blockFields) {
				const value = result[field.slug];
				if (!Array.isArray(value)) continue;
				result[field.slug] = await Promise.all(
					value.map(async (block) => {
						if (!isRecord(block) || typeof block._type !== "string") return block;
						const type = blockTypes.get(block._type);
						const version = type?.versions.find(
							(candidate) => candidate.version === block._version,
						);
						if (!version || version.unsupportedTypes?.length) return block;
						const normalizedBlock: Record<string, unknown> = { ...block };
						for (const nestedField of version.fields) {
							const nestedValue = normalizedBlock[nestedField.slug];
							if (nestedValue == null) continue;
							try {
								if (nestedField.type === "image") {
									const normalized = await normalizeImageValue(nestedValue, getProvider);
									if (normalized) normalizedBlock[nestedField.slug] = normalized;
								} else if (nestedField.type === "file") {
									const normalized = await normalizeMediaValue(nestedValue, getProvider);
									if (normalized) normalizedBlock[nestedField.slug] = normalized;
								} else if (nestedField.type === "repeater" && Array.isArray(nestedValue)) {
									const imageSlugs = (nestedField.validation?.subFields ?? [])
										.filter((subField) => subField.type === "image")
										.map((subField) => subField.slug);
									normalizedBlock[nestedField.slug] = await Promise.all(
										nestedValue.map(async (item) => {
											if (!isRecord(item)) return item;
											const normalizedItem = { ...item };
											for (const slug of imageSlugs) {
												try {
													const normalized = await normalizeImageValue(
														normalizedItem[slug],
														getProvider,
													);
													if (normalized) normalizedItem[slug] = normalized;
												} catch {
													continue;
												}
											}
											return normalizedItem;
										}),
									);
								}
							} catch {
								continue;
							}
						}
						return normalizedBlock;
					}),
				);
			}
		}

		return result;
	}

}

async function normalizeImageValue(
	value: unknown,
	getProvider: (id: string) => MediaProvider | undefined,
): Promise<ImageValue | null> {
	const primary = await normalizePrimaryImageValue(value, getProvider);
	if (!primary || !isRecord(value) || value.darkVariant == null) return primary;
	const darkVariant = await normalizeMediaValue(value.darkVariant, getProvider);
	return darkVariant ? { ...primary, darkVariant } : primary;
}

/**
 * Normalize the primary image of an image field value.
 *
 * A legacy string URL that the admin upgraded to `{ id: "", src: url }` so it
 * can carry a dark variant still has to normalize as a string: as an object it
 * counts as local media, which strips `src` and leaves nothing behind. The
 * upgrade outlives the variant — an editor can add one and remove it again —
 * so the shape decides, not the presence of `darkVariant`.
 */
async function normalizePrimaryImageValue(
	value: unknown,
	getProvider: (id: string) => MediaProvider | undefined,
): Promise<ImageValue | null> {
	if (isRecord(value) && !value.id && typeof value.src === "string" && !value.provider) {
		return normalizeMediaValue(value.src, getProvider);
	}
	return normalizeMediaValue(value, getProvider);
}
