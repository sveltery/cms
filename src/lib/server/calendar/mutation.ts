import * as v from 'valibot';
import { revisionToken } from '../content/schema.ts';
import { contentDateTime } from './schema.ts';

/** Bounded Native transport envelope; lifecycle owns every accepted mutation. */
export const calendarMutation=v.variant('action',[
  v.strictObject({action:v.literal('publish'),_rev:v.optional(revisionToken)}),
  v.strictObject({action:v.literal('schedule'),scheduledAt:v.pipe(v.string(),v.minLength(1),v.maxLength(128),v.check(value=>contentDateTime.safeParse(value).success,'must be an ISO 8601 datetime')),_rev:v.optional(revisionToken)}),
  v.strictObject({action:v.literal('unschedule'),_rev:v.optional(revisionToken)})
]);
