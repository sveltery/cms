import * as v from 'valibot';
import { revisionToken } from '../content/schema.ts';

/** Bounded Native transport envelope; lifecycle owns every accepted mutation. */
export const calendarMutation=v.variant('action',[
  v.strictObject({action:v.literal('publish'),_rev:v.optional(revisionToken)}),
  v.strictObject({action:v.literal('schedule'),scheduledAt:v.pipe(v.string(),v.minLength(1),v.maxLength(128)),_rev:v.optional(revisionToken)}),
  v.strictObject({action:v.literal('unschedule'),_rev:v.optional(revisionToken)})
]);
