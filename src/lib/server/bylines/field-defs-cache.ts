// EmDash 1.1.0, immutable 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc.; MIT; notices/emdash-MIT.txt.
// Complete Source bodies with native imports/storage hosting; docs/byline-backend.md.
/**
 * Byline field-definitions cache
 *
 * Discussion #1174 / Phase 3. Two-tier cache for the byline custom-field
 * registry, mirroring the `settings/index.ts` pattern.
 *
 * **Tier 1 — per-isolate (globalThis).** Field definitions change rarely
 * but are read on every byline hydration (admin pages, content rendering,
 * API responses). Caching at the isolate level drops the SELECT-from-
 * `_emdash_byline_fields` from once-per-hydration to once-per-isolate-
 * after-bump. The cache holds the resolved *value* behind a reclaimable
 * single-flight lock (see `utils/single-flight-cache.ts`), never an
 * in-flight promise: concurrent cold-isolate readers coalesce onto one
 * query by polling the published value, so a reader whose request is
 * cancelled mid-query can never strand later byline hydrations on the
 * isolate (the workerd never-settling-promise hazard that produced 524s).
 *
 * Stored on globalThis under `Symbol.for("sveltery:byline-field-defs")` so
 * Vite SSR chunk duplication can't produce two independent caches (same
 * pattern as `request-cache.ts` and `request-context.ts`).
 *
 * **Tier 2 — per-request.** Wraps both the version read and the defs
 * fetch in `requestCached` so a single page render that hits byline
 * hydration multiple times (e.g. list view + individual byline lookups
 * in a sidebar) pays at most one version read and one defs fetch in
 * total. The defs cache key includes the version, so a (highly
 * unlikely) mid-request bump still produces a self-consistent view —
 * the second call sees a different key and refetches.
 *
 * **Invalidation.** `options.byline_fields_version` is bumped by every
 * `BylineSchemaRegistry` mutation (Phase 2). Each isolate independently
 * reads the persisted version on the next request and compares against
 * its cached version; mismatch triggers a refetch and overwrite. Other
 * isolates see the change within one request after the bump propagates.
 *
 * **Isolated databases bypass the global cache.** Playground and DO
 * preview sessions set `requestContext.dbIsIsolated = true`, signalling
 * the per-request `db` points at an isolated schema that may diverge
 * from the singleton. Schema-derived caches keyed by the singleton's
 * version would silently leak the singleton's defs into the isolated
 * request. We follow the `loader.ts:74` `getTaxonomyNames` precedent:
 * skip both reading from and writing to the global holder when the
 * request is isolated. The per-request cache (`requestCached`) is keyed
 * by the WeakMap'd `EmDashRequestContext`, so it can't cross-pollinate
 * between requests — it stays in play even for isolated DBs.
 *
 * **Why a versioned cache and not a TTL?** The version counter gives
 * deterministic invalidation without the staleness window a TTL would
 * impose. Field-definition changes need to be visible to the next
 * request, not eventually. The cost is one cheap `options` read per
 * request — cheaper than the field-defs fetch it replaces, and cheaper
 * than maintaining a TTL state machine.
 */

import type { Kysely } from "kysely";

import { after } from "../menus/after.ts";
import type { Database } from "./database-types.ts";
import { requestCached } from "../menus/request-cache.ts";
import { getRequestContext } from "../menus/context.ts";
import { BylineSchemaRegistry } from "./schema.ts";
import { bylineDatabaseOwner } from "./storage.ts";
import type { CmsDatabase } from "../database/contract.ts";
import type { BylineFieldDefinition } from "./types.ts";
import { createInitLock, type InitLock, initWithLock } from "../redirects/init-lock.ts";

interface FieldDefsHolder {
	/** Last resolved defs, valid only when `hasValue` is true. */
	value: BylineFieldDefinition[] | null;
	/** Presence flag, separate from `value` so an empty-array result still caches. */
	hasValue: boolean;
	/** Persisted-version value that `value` was fetched against. */
	cachedVersion: number;
	/** Reclaimable single-flight lock so a cancelled owner can't wedge readers. */
	lock: InitLock;
}

interface DatabaseFieldDefsHolder extends FieldDefsHolder {
	/** A stable request-key namespace for this actual configured owner. */
	requestKey: number;
}
interface FieldDefsCacheState {
	holders: WeakMap<CmsDatabase, DatabaseFieldDefsHolder>;
	nextRequestKey: number;
}
const HOLDER_KEY = Symbol.for("sveltery:byline-field-defs");
const g = globalThis as Record<symbol, unknown>;
const state: FieldDefsCacheState =
	(g[HOLDER_KEY] as FieldDefsCacheState | undefined) ??
	(() => {
		const value: FieldDefsCacheState = { holders: new WeakMap(), nextRequestKey: 0 };
		g[HOLDER_KEY] = value;
		return value;
	})();

/** Never infer database identity from a version, namespace or SQL text. */
function fieldDefsHolder(db: Kysely<Database>): DatabaseFieldDefsHolder | undefined {
	let owner: CmsDatabase;
	try { owner = bylineDatabaseOwner(db); }
	catch { return undefined; }
	let holder = state.holders.get(owner);
	if (!holder) {
		holder = { value: null, hasValue: false, cachedVersion: -1,
			lock: createInitLock(), requestKey: state.nextRequestKey++ };
		state.holders.set(owner, holder);
	}
	return holder;
}

const REQUEST_CACHE_KEY_VERSION = "byline-fields-version";
const REQUEST_CACHE_KEY_DEFS_PREFIX = "byline-field-defs:";

/**
 * Reclaim window for the single-flight lock: if an owner holds it past
 * this without publishing (e.g. its request was cancelled and the
 * anchored fetch hasn't completed yet), the next reader reclaims and
 * refetches. `listFields` is a single fast SELECT, so this only needs to
 * cover a genuinely slow/stranded query. Mutable solely so tests can
 * shorten it; production never changes it.
 */
let reclaimDeadlineMs = 10_000;

/**
 * Read the persisted `options.byline_fields_version` counter. Cached for
 * the duration of the current request via `requestCached`. Returns `0`
 * when the row is missing (matches `BylineSchemaRegistry.getVersion`).
 */
async function getBylineFieldsVersion(db: Kysely<Database>, holder: DatabaseFieldDefsHolder): Promise<number> {
	return requestCached(`${REQUEST_CACHE_KEY_VERSION}:${holder.requestKey}`, () => new BylineSchemaRegistry(db).getVersion());
}

/**
 * Resolve registered byline custom-field definitions. Two-tier cache:
 * per-request via `requestCached`, then per-isolate via the global
 * holder.
 *
 * The global holder is bypassed for isolated requests (playground / DO
 * preview, which point at a divergent schema) and for dirty versions
 * (odd counter — see `BylineSchemaRegistry`'s class JSDoc — indicates
 * an in-flight or crashed mutation). Both bypass paths still hit the
 * per-request cache, so a single render dedupes within itself.
 *
 * Always returns an array. Empty = no custom fields registered.
 */
export async function getBylineFieldDefs(db: Kysely<Database>): Promise<BylineFieldDefinition[]> {
	const holder = fieldDefsHolder(db);
	// Unregistered read-only handles cannot establish trusted owner identity.
	// Bypass both tiers instead of assigning them another database's cache.
	if (!holder) return new BylineSchemaRegistry(db).listFields();
	const isolated = getRequestContext()?.dbIsIsolated === true;
	const version = await getBylineFieldsVersion(db, holder);
	const dirty = version % 2 !== 0;
	return requestCached(`${REQUEST_CACHE_KEY_DEFS_PREFIX}${holder.requestKey}:${version}`, async () => {
		if (isolated || dirty) {
			return new BylineSchemaRegistry(db).listFields();
		}
		// Per-isolate single-flight cache keyed on the persisted version.
		// Coalesce concurrent cold readers via the lock and read the
		// published value; never await another request's in-flight promise
		// (a cancelled owner would otherwise strand every later byline
		// hydration on the isolate). The fetch is anchored so a cancelled
		// originator still drives it to completion and populates the cache.
		return initWithLock<BylineFieldDefinition[]>(
			holder.lock,
			() => (holder.hasValue && holder.cachedVersion === version ? holder.value : null),
			(isCurrentClaim) =>
				(async () => {
					const defs = await new BylineSchemaRegistry(db).listFields();
					// Publish only while still the current claim, and never
					// regress over a newer version a concurrent reader stored.
					if (isCurrentClaim() && version >= holder.cachedVersion) {
						holder.value = defs;
						holder.hasValue = true;
						holder.cachedVersion = version;
					}
					return defs;
				})(),
			{ deadlineMs: reclaimDeadlineMs, anchor: (promise) => after(() => promise) },
		);
	});
}

/**
 * Test/internal helper: clear the per-isolate cache. Useful for unit
 * tests that mutate the registry directly and need to force a refetch
 * without going through the full version-bump path.
 *
 * Production code paths should rely on the version counter for
 * invalidation — calling this from a write path would bypass the
 * coordination that lets other isolates see the change.
 */
export function resetBylineFieldDefsCacheForTests(): void {
	state.holders = new WeakMap();
	reclaimDeadlineMs = 10_000;
}

/**
 * Test-only: shorten the single-flight reclaim window so a "stranded
 * owner" scenario can be exercised without waiting out the production
 * deadline. Reset by `resetBylineFieldDefsCacheForTests`.
 *
 * @internal
 */
export function setBylineFieldDefsReclaimDeadlineForTests(ms: number): void {
	reclaimDeadlineMs = ms;
}
