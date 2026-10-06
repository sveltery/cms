/**
 * Discovery client.
 *
 * Reads from an EmDash plugin registry aggregator. The aggregator implements
 * the `com.emdashcms.experimental.aggregator.*` XRPC methods over plain HTTP,
 * so this client works in any runtime that has `fetch` -- Node, Workers, the
 * browser, the EmDash admin UI.
 *
 * No authentication is required for discovery: the aggregator is a public
 * read-only index. The aggregator applies its required positive-label and
 * hard-enforcement policy server-side. The client may send an
 * `atproto-accept-labelers` declaration for policy and cache identity. The
 * aggregator validates it but does not let it override the configured policy.
 */
import { Client, ok, simpleFetchHandler } from "@atcute/client";
import { safeParse } from "@atcute/lexicons/validations";
import { AggregatorGetLatestRelease, AggregatorGetPackage, AggregatorListReleases, AggregatorResolvePackage, AggregatorSearchPackages, PackageProfile, PackageRelease, } from "@emdash-cms/registry-lexicons";
import { mapListingStatus, registryLabelerPolicy, } from "../listing-policy.js";
export { registryLabelerPolicy, registryLabelerPolicyKey, } from "../listing-policy.js";
/**
 * Validate an untrusted, aggregator-supplied signed `profile` / `release`
 * record against its lexicon. Returns the value when its known fields
 * conform, or `null` when they don't (missing required fields, wrong types).
 *
 * This is the registry's read-side trust boundary: the aggregator hydrates
 * signed records it does not author, so everything inside `profile` /
 * `release` is untrusted until it passes here. Two limits callers must keep
 * in mind:
 *
 *   - **Structure only.** The lexicon's `uri` format permits non-HTTP
 *     schemes (including `javascript:`), so consumers rendering URLs in
 *     markup MUST still apply their own scheme allow-list.
 *   - **Non-stripping.** atcute validation does not remove unrecognised
 *     keys (the lexicon objects are open). Extra keys pass through; they
 *     are inert because consumers only read the typed lexicon fields. We
 *     deliberately do not hand-roll a field whitelist to strip them — that
 *     is the brittle per-record parsing this boundary exists to replace,
 *     and unread keys are not a correctness or security risk.
 */
function validateProfile(raw) {
    const result = safeParse(PackageProfile.mainSchema, raw);
    return result.ok ? result.value : null;
}
function validateRelease(raw) {
    const result = safeParse(PackageRelease.mainSchema, raw);
    return result.ok ? result.value : null;
}
function validateReleaseView(view) {
    return {
        ...view,
        artifactCaches: view.artifactCaches ?? [],
        release: validateRelease(view.release),
    };
}
/**
 * Read-only client over an EmDash plugin registry aggregator.
 *
 * Wraps `@atcute/client` with the aggregator URL pre-bound and the
 * `atproto-accept-labelers` header threaded through every request. Method
 * names mirror the aggregator's XRPC method names (without the NSID prefix).
 *
 * Two layers of validation run at this boundary (the aggregator is an
 * untrusted remote index):
 *
 *   - The **response envelope** (`uri`, `did`, `slug`, `labels`, …) is
 *     validated by `@atcute/client` against the aggregator method's output
 *     lexicon. A non-conforming envelope throws `ClientValidationError`.
 *   - The **embedded signed `profile` / `release` records** — which the
 *     aggregator relays verbatim and types as `unknown` — are validated
 *     against the package lexicons here; a non-conforming record is
 *     surfaced as `null` (callers must null-check) rather than failing the
 *     whole call, so one bad record doesn't blank a search page.
 *
 * @example
 * ```ts
 * const discovery = new DiscoveryClient({
 *   aggregatorUrl: "https://registry.emdashcms.com",
 * });
 * const result = await discovery.searchPackages({ q: "gallery", limit: 10 });
 * for (const pkg of result.packages) {
 *   console.log(pkg.uri, pkg.profile?.name ?? pkg.slug);
 * }
 * ```
 */
export class DiscoveryClient {
    aggregatorUrl;
    acceptLabelers;
    labelerPolicy;
    #client;
    constructor(options) {
        this.aggregatorUrl = options.aggregatorUrl;
        const configuredPolicy = registryLabelerPolicy(options.labelerPolicy?.acceptLabelers);
        const legacyPolicy = registryLabelerPolicy(options.acceptLabelers);
        if (configuredPolicy.acceptLabelers !== undefined &&
            legacyPolicy.acceptLabelers !== undefined &&
            configuredPolicy.acceptLabelers !== legacyPolicy.acceptLabelers) {
            throw new TypeError("labelerPolicy.acceptLabelers must match acceptLabelers when both are set");
        }
        this.labelerPolicy = registryLabelerPolicy(configuredPolicy.acceptLabelers ?? legacyPolicy.acceptLabelers);
        this.acceptLabelers = this.labelerPolicy.acceptLabelers;
        const baseHandler = simpleFetchHandler({
            service: options.aggregatorUrl,
            fetch: options.fetch ?? globalThis.fetch,
        });
        // Wrap the handler so every outgoing request carries the
        // `atproto-accept-labelers` header when configured. We always
        // *overwrite* any value the caller might have supplied: this is the
        // client's policy identity, not a per-request setting. Allowing
        // downstream code to substitute another value would make the request
        // disagree with the client's cache identity.
        const acceptLabelers = this.acceptLabelers;
        const handler = acceptLabelers
            ? async (pathname, init) => {
                const headers = new Headers(init.headers);
                headers.set("atproto-accept-labelers", acceptLabelers);
                return baseHandler(pathname, { ...init, headers });
            }
            : baseHandler;
        this.#client = new Client({ handler });
    }
    /**
     * Search packages by free-text query and optional filters. Hard-takedown
     * results are filtered server-side; remaining results have label state
     * hydrated.
     *
     * Throws `ClientResponseError` (from `@atcute/client`) on a non-2xx
     * response (carrying `.error`, `.description`, `.status`, `.headers`), or
     * `ClientValidationError` if the aggregator returns a response whose
     * envelope does not match the method's output lexicon.
     */
    async searchPackages(params) {
        const out = await ok(this.#client.call(AggregatorSearchPackages, { params }));
        return {
            ...out,
            packages: out.packages.map((p) => ({ ...p, profile: validateProfile(p.profile) })),
        };
    }
    /**
     * Fetch a single package's full hydrated view by its AT URI.
     */
    async getPackage(params) {
        const out = await ok(this.#client.call(AggregatorGetPackage, { params }));
        return { ...out, profile: validateProfile(out.profile) };
    }
    /** Fetch a package while mapping the safe ListingUnavailable XRPC error. */
    getPackageStatus(params) {
        return mapListingStatus(this.getPackage(params));
    }
    /**
     * Resolve a package by publisher handle + slug (or DID + slug). Cheaper
     * than `getPackage` when you only have human-readable identifiers.
     */
    async resolvePackage(params) {
        const out = await ok(this.#client.call(AggregatorResolvePackage, { params }));
        return { ...out, profile: validateProfile(out.profile) };
    }
    /** Resolve a package while discarding all remote error text for unavailable listings. */
    resolvePackageStatus(params) {
        return mapListingStatus(this.resolvePackage(params));
    }
    /**
     * List releases for a package, paginated and ordered by descending
     * semver version (newest version first), not by time. Yanked releases
     * are interleaved by version. Use `getLatestRelease` for the
     * convention "give me the highest non-yanked version".
     */
    async listReleases(params) {
        const out = await ok(this.#client.call(AggregatorListReleases, { params }));
        return {
            ...out,
            releases: out.releases.map(validateReleaseView),
        };
    }
    /**
     * Fetch the package's latest non-yanked release. Convenience wrapper around
     * `listReleases` that the aggregator can implement more efficiently than
     * client-side max-version selection (the version constraint engine lives
     * on the aggregator).
     */
    async getLatestRelease(params) {
        const out = await ok(this.#client.call(AggregatorGetLatestRelease, { params }));
        return validateReleaseView(out);
    }
}
