// Original native module/cache fixture. Opaque cache identities give zero D1/SQL credit.
import type {Kysely} from 'kysely';
import type {SettingsTables} from '../../src/lib/server/settings/tables.ts';
import {siteCache} from '../../src/lib/server/settings/cache.ts';
import {singleFlightCached} from '../../src/lib/server/settings/vendor/single-flight-cache.ts';
import {invalidateMediaCache,mediaCacheRevision} from '../../src/lib/server/media/cache.ts';
export default {async fetch(){
 const a={} as Kysely<SettingsTables>,b={} as Kysely<SettingsTables>,ca=siteCache(a),cb=siteCache(b);
 await singleFlightCached(ca,async()=>({title:'Cached A'}));await singleFlightCached(cb,async()=>({title:'Cached B'}));
 const beforeRevision=mediaCacheRevision();invalidateMediaCache();
 const freshA=siteCache(a),freshB=siteCache(b);
 return Response.json({revisionDelta:mediaCacheRevision()-beforeRevision,detachedA:freshA!==ca,detachedB:freshB!==cb,newAHasValue:freshA.hasValue,newBHasValue:freshB.hasValue});
}};
