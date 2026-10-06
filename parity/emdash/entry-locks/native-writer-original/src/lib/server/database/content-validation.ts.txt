import * as v from 'valibot';
import {contentSeoInput} from '../seo/content-input.ts';
import {identifier,localeInput,schemaData,updateDraftInput} from './validation.ts';

// Valibot record strips constructor/prototype. These can be real indexed
// field names; preserve their own keys for the pinned repository to validate.
const fieldFilters=v.custom<Record<string,unknown>>(value=>value!==null&&typeof value==='object'&&!Array.isArray(value));

// Wire-neutral bounded admin list inputs. Indexed filter semantics are checked
// by the pinned repository after resolving collection existence and metadata.
export const contentListOptions={
 locale:v.optional(localeInput,'en'),
 limit:v.optional(v.pipe(v.number(),v.safeInteger(),v.minValue(1))),
 cursor:v.optional(v.pipe(v.string(),v.maxLength(2048))),
 status:v.optional(v.pipe(v.string(),v.maxLength(32))),
 authorId:v.optional(v.pipe(v.string(),v.maxLength(128))),
 orderBy:v.optional(v.pipe(v.string(),v.maxLength(128))),
 order:v.optional(v.picklist(['asc','desc'])),
 dateField:v.optional(v.picklist(['createdAt','updatedAt','publishedAt'])),
 dateFrom:v.optional(v.pipe(v.string(),v.maxLength(128))),
 dateTo:v.optional(v.pipe(v.string(),v.maxLength(128))),
 fieldFilters:v.optional(fieldFilters)
};
export const genericContentList=v.strictObject({type:identifier,...contentListOptions});
// Ordinary lifecycle saves distinguish absent data from an explicit {}. The
// legacy draft-only schema retains its required data contract and caller CAS.
// Keep own taxonomy names, including legitimate "constructor"/"prototype"
// keys; the shared slug resolver validates every explicit taxonomy selection.
export const taxonomySlugMap=v.custom<Record<string,string[]>>(value=>
 value!==null&&typeof value==='object'&&!Array.isArray(value)&&
 Object.values(value).every(slugs=>Array.isArray(slugs)&&slugs.every(slug=>typeof slug==='string'&&slug.length>0)));
export const genericContentUpdate=v.strictObject({...updateDraftInput.entries,data:v.optional(schemaData),taxonomies:v.optional(taxonomySlugMap),seo:v.optional(contentSeoInput)});
