import * as v from 'valibot';
import { contentKey, revisionToken } from '../content/schema.ts';
import { entryId } from '../database/validation.ts';
import { CmsError, type DraftEntry } from '../database/contract.ts';
import type { ContentItem } from '../database/lifecycle/upstream/database/repositories/types.ts';

export const lifecycleMutation=v.strictObject({...contentKey.entries,_rev:revisionToken});
export const publishInput=v.strictObject({...lifecycleMutation.entries,
  publishedAt:v.optional(v.pipe(v.string(),v.minLength(1),v.maxLength(128)))});
export const revisionList=v.strictObject({...contentKey.entries,
  limit:v.optional(v.pipe(v.number(),v.safeInteger(),v.minValue(1),v.maxValue(100)))});
export const restoreRevisionInput=v.strictObject({...lifecycleMutation.entries,revisionId:entryId});

// This port's physical content table retains its existing NOT NULL locale.
// Fail on corruption rather than inventing a locale for an opaque token.
export function contentEntry(item:ContentItem):DraftEntry {
  if(typeof item.locale!=='string')throw new CmsError('VALIDATION_ERROR','Persisted content locale is missing');
  return {...item,locale:item.locale};
}
