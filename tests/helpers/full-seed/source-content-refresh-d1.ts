// Isolated Original D1 constructor transport, with zero Source causal credit.
// Every Original callback uses the corresponding same-owner guarded product
// view; its query observers, data and clock remain unchanged.
export * from '../../../src/lib/server/seed/upstream/media/usage/content-refresh-d1.ts';
import * as actual from '../../../src/lib/server/seed/upstream/media/usage/content-refresh-d1.ts';
import * as native from '../../../src/lib/server/seed/namespace.ts';
import {originalFixtureGuardedHandle} from './source-d1-fixture-handle.ts';
export const refreshContentMediaUsage:typeof actual.refreshContentMediaUsage=(db,...args)=>native.seedNativeRefreshContentMediaUsage(originalFixtureGuardedHandle(db),...args);
export const refreshContentMediaUsageForWorkBatch:typeof actual.refreshContentMediaUsageForWorkBatch=(db,...args)=>native.seedNativeRefreshContentMediaUsageForWorkBatch(originalFixtureGuardedHandle(db),...args);
export const deleteContentMediaUsage:typeof actual.deleteContentMediaUsage=(db,...args)=>native.seedNativeDeleteContentMediaUsage(originalFixtureGuardedHandle(db),...args);
export const deleteContentMediaUsageCollection:typeof actual.deleteContentMediaUsageCollection=(db,...args)=>native.seedNativeDeleteContentMediaUsageCollection(originalFixtureGuardedHandle(db),...args);
export const refreshContentMediaUsageAfterWrite:typeof actual.refreshContentMediaUsageAfterWrite=(db,...args)=>native.seedNativeRefreshContentMediaUsageAfterWrite(originalFixtureGuardedHandle(db),...args);
export const findNonTranslatableSiblingContentIds:typeof actual.findNonTranslatableSiblingContentIds=(db,...args)=>native.seedNativeFindNonTranslatableSiblingContentIds(originalFixtureGuardedHandle(db),...args);
export const markContentMediaUsageCollectionStale:typeof actual.markContentMediaUsageCollectionStale=(db,...args)=>actual.markContentMediaUsageCollectionStale(originalFixtureGuardedHandle(db),...args);
export const markContentMediaUsageCollectionStaleSafely:typeof actual.markContentMediaUsageCollectionStaleSafely=(db,...args)=>actual.markContentMediaUsageCollectionStaleSafely(originalFixtureGuardedHandle(db),...args);
