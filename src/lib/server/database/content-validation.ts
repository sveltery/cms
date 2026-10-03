import * as v from 'valibot';
import {identifier,localeInput} from './validation.ts';

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
 fieldFilters:v.optional(v.record(v.string(),v.unknown()))
};
export const genericContentList=v.strictObject({type:identifier,...contentListOptions});
