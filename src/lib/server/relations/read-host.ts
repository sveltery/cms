import type {CmsDatabase,Field} from '../database/contract.ts';
import type {ContentItem} from '../database/lifecycle/upstream/database/repositories/types.ts';

/** Shared trusted read seam for the two existing content owners. Keep this
 * module pure so scalar reads never load the relation or Node cache graph. */
export async function hydrateBoundContentReferences(database:CmsDatabase,item:ContentItem,
 fields:readonly Pick<Field,'type'|'validation'>[],includeDrafts:boolean):Promise<ContentItem>{
 if(!fields.some(field=>field.type==='reference'&&field.validation?.relation))return item;
 return (await import('./content-read.ts')).hydrateContentReferences(database,item,includeDrafts);
}
