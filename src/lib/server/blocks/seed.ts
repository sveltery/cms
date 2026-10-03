// Complete pinned exportBlockTypes and exportCollections functions, plus native
// bounded content transport. EmDash913cb1bb, MIT Copyright2026Cloudflare Inc.
// This is an SC3 export, not a full-site seed exporter (other families stay explicit).
import type {Kysely} from 'kysely';
import type {Database} from '../media/source/database/types.ts';
import type {CmsDatabase} from '../database/contract.ts';
import type {SeedBlockType,SeedCollection,SeedField,SeedFile,SeedContentEntry} from '../setup/upstream/types.ts';
import {BlockTypeRegistry} from './registry.ts';
import {blocksDatabase} from './host.ts';
import {SchemaRegistry} from '../database/registry.ts';
import {ContentRepository} from '../database/lifecycle/upstream/database/repositories/content.ts';
async function exportBlockTypes(db: Kysely<Database>): Promise<SeedBlockType[]> {
	const blockTypes = await new BlockTypeRegistry(db).listBlockTypes();
	return blockTypes.map((blockType) => ({
		slug: blockType.slug,
		label: blockType.label,
		description: blockType.description,
		icon: blockType.icon,
		category: blockType.category,
		currentVersion: blockType.currentVersion,
		versions: blockType.versions.map((version) => ({
			version: version.version,
			fields: version.fields,
		})),
	}));
}

async function exportCollections(database: CmsDatabase): Promise<SeedCollection[]> {
	const registry = new SchemaRegistry(database);
	const collections = await registry.listCollections();
	const result: SeedCollection[] = [];

	for (const collection of collections) {
		const fields = await registry.listFields(collection.id);

		const seedCollection: SeedCollection = {
			slug: collection.slug,
			label: collection.label,
			labelSingular: collection.labelSingular || undefined,
			description: collection.description || undefined,
			icon: collection.icon || undefined,
			admin: collection.admin,
			supports: collection.supports.length > 0 ? collection.supports : undefined,
			urlPattern: collection.urlPattern || undefined,
			routable: collection.routable === false ? false : undefined,
			editLocking: collection.editLocking === false ? false : undefined,
			hidden: collection.hidden || undefined,
			sortOrder: collection.sortOrder,
			group: collection.group,
			commentsEnabled: collection.commentsEnabled || undefined,
			titleField: collection.titleField,
			dateField: collection.dateField,
			fields: fields.map(
				(field): SeedField => ({
					slug: field.slug,
					label: field.label,
					type: field.type,
					required: field.required || undefined,
					unique: field.unique || undefined,
					searchable: field.searchable || undefined,
					indexed: field.indexed || undefined,
					translatable: field.translatable === false ? false : undefined,
					defaultValue: field.defaultValue,
					validation: field.validation ? { ...field.validation } : undefined,
					widget: field.widget || undefined,
					options: field.options || undefined,
				}),
			),
		};

		result.push(seedCollection);
	}

	return result;
}

/** Export actual reusable definitions, schemas and optional stored content. */
export async function exportReusableBlocksSeed(database:CmsDatabase,includeContent=false):Promise<SeedFile>{
 const db=blocksDatabase(database),collections=await exportCollections(database);
 const seed:SeedFile={version:'1',blockTypes:await exportBlockTypes(db),collections};
 if(includeContent){
  const content:Record<string,SeedContentEntry[]>={},repository=new ContentRepository(db as any);
  for(const collection of collections){
   const entries:SeedContentEntry[]=[];let cursor:string|undefined;
   do{const page=await repository.findMany(collection.slug,{limit:100,cursor});
    for(const item of page.items){
     // No translation/relation/media-transfer claim from this bounded transport.
     // Retained block identity and versions are copied without rebuilding arrays.
     entries.push({id:item.slug?`${collection.slug}:${item.slug}:${item.locale}`:item.id,slug:item.slug?.trim()?item.slug:collection.routable===false?undefined:item.id,status:item.status==='published'?'published':'draft',locale:item.locale??undefined,data:item.data});
    }cursor=page.nextCursor;
   }while(cursor);
   if(entries.length)content[collection.slug]=entries;
  }seed.content=content;
 }
 return seed;
}
