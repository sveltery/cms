import {invalidateSiteSettingsCache} from '../settings/index.ts';
/** Source consumers invalidate cached settings after a successful media write. */
let revision=0;
export function mediaCacheRevision() {return revision;}
export function invalidateMediaCache() {revision++;invalidateSiteSettingsCache();}
