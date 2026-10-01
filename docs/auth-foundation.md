This document records the original bounded auth foundation. [Session composition](session-composition.md) now registers version-two empty auth migrations, derives request principals and gates HTTP mutations; login and production hosting remain deferred.

# Bounded server-session foundation

This slice resolves an existing server session into a current role-derived principal, denies expired/revoked sessions, and provides the pinned EmDash permission and ownership helpers. It does not implement sign-in or expose an authenticated endpoint. Production remains fail closed: hooks, locals, content remotes, shared database contracts and migration registration are unchanged. The parent owns composition with the collection-aware CRUD slice and must verify their joint tests before enabling writes.

## Proposed integration contract

```ts
interface SessionPrincipal {
  readonly id: string;
  readonly role: 10 | 20 | 30 | 40 | 50;
}
interface SessionStore {
  read(hash: string): Promise<{
    user: { id: string; role: number; disabled: boolean };
    expiresAt: number; // Unix epoch milliseconds
  } | null>;
  revoke(hash: string): Promise<void>;
}
```

`resolvePrincipal(cookieValue, store, { keepAlive })` returns a frozen `{ id, role }` or `null`. The caller obtains the value from the `cms-session` cookie using SvelteKit's cookie API. It must construct the store from trusted server adapter configuration, never request data. Every store read must observe the current session and user; the Node adapter uses one parameterized join. Roles/capabilities in cookies, headers or bodies never enter this function. Missing cookies avoid all storage work. Unknown cookies, missing users, disabled users, invalid roles, expired rows and failed/stalled reads cannot create a principal. Authenticated request context must be resolved afresh; an already-authorized in-flight request is not retroactively cancelled by later revocation.

Pass only that result to the role-based helpers. Role thresholds are `SUBSCRIBER=10`, `CONTRIBUTOR=20`, `AUTHOR=30`, `EDITOR=40`, `ADMIN=50`. Published-content reads require `content:read`; drafts require `content:read_drafts`; creation requires `content:create`. Use `requirePermissionOnResource` with the stored owner for edit/delete/publish own/any distinctions, and `schema:manage` for dashboard schema writes. Normalize a missing owner to `''` when using the upstream string contract; that value never establishes ownership. Collection ownership and validation belong to the CRUD service. These helpers do not implement collection grants, API-token scope intersections or content lifecycle rules. The provisional `content:write` capability in the existing scaffold cannot safely stand in for this policy.

The landed `database/service.ts` separately accepts `ServerPrincipal { id, permissions }`. Before integration, the parent should choose either to retain that interface and derive its supported permission list with `hasPermission(sessionPrincipal, permission)` entirely on the server, or to adopt direct role-helper checks in the service. This auth slice changes neither interface and installs no bridge. A request must never supply the permissions list.

The auth owner owns `src/lib/server/auth/*`, `tests/auth-*.test.ts`, `tests/helpers/auth-worker.ts` and these auth provenance documents. Dependency additions provide the upstream encoding library and local workerd test runtime. Native dependency install scripts remain disabled for `sharp` and `workerd`; the test uses the distributed native binaries, with no added execution trust. No CI workflow or shared application contract is changed.

## Storage and request boundary

`authSchemaStatements` describes empty `_cms_auth_users` and `_cms_auth_sessions` tables plus a user-session index. It is an **unregistered descriptor**, not a completed auth migration or an automatic initializer. The composition owner must integrate it into the storage owner's migration lifecycle, atomic execution, version validation and restart guarantees before production use. The `_cms_*` namespace follows this independent CMS database; these are not upstream `users` tables or an EmDash database upgrade. It gives user rows only the fields this read slice needs: ID, persisted role and disabled status. It neither supplies a default role/admin nor inserts users, grants, tokens or sessions. The session row stores SHA-256 hash, user ID and absolute expiry; it stores no cookie value or role. `createKyselySessionStore` performs only current-record reads and idempotent hash-qualified deletion.

`revokeSession` awaits deletion and propagates failures. A logout boundary must enforce an unsafe method and origin check, await revocation, then clear the cookie using the same path/security flags. Do not report successful server revocation if storage deletion fails. Expired rows are denied without renewal; cleanup is deferred.

The proposed cookie options preserve Astro's production defaults: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`. `SESSION_COOKIE_DELETE_OPTIONS` also supplies `Max-Age=0` and epoch expiry. These are option descriptors, not a cookie-issuing API, and require a real SvelteKit response test when connected. `Secure` stays enabled; no production HTTP or development auth bypass is added.

`requireSessionMutationOrigin` uses a canonical public origin from trusted configuration. Non-safe requests require an exact `Origin` match, including scheme and port; missing/opaque/malformed/foreign origins fail closed, even with `X-EmDash-Request: 1`. Forwarded headers do not select the configured origin. GET/HEAD/OPTIONS pass this guard and must remain read-only. Future logout, renewal and issuance routes must invoke this boundary or demonstrate an equivalent native guard.

## Upstream inspection and bounded substitutions

The baseline is [EmDash 1.1.0 at `913cb1bb`](https://github.com/emdash-cms/emdash/commit/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e), with the inventory on CMS main `ec0376fc4d83ba70ec896e6cb34e5ad301f27788`. [The machine-readable mapping](auth-ports.json) records inspected blob identities, exact retained assertions, fixtures, runtime expansions, red commits and limitations. Copied RBAC and resolver code/tests retain the existing [MIT notice](../notices/emdash-MIT.txt).

Upstream [session middleware](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/packages/core/src/astro/middleware/auth.ts) reads `{ id }` from the Astro server session, then reloads the user and rejects missing/disabled accounts. It does not trust a cookie role. [The resolver and its four tests](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/packages/core/tests/unit/astro/session-user.test.ts) require resolved identity, absent-session denial, a 20 ms stalled-read backstop and rejection denial. Production's default timeout is 3,000 ms. This slice retains all four assertions and adds synchronous-throw handling. On workerd the parent supplies request `waitUntil` as `keepAlive`; the local test verifies callback forwarding, not isolate cancellation recovery.

[Upstream RBAC](https://github.com/emdash-cms/emdash/blob/913cb1bb9b7f08c3ff0d258b4420e53835b6a58e/packages/auth/src/rbac.ts) supplies the permission map and nonempty-owner rule. All 28 source cases outside API scope clamping preserve their fixtures and assertion semantics using Node's assertions. The full upstream permission map is retained as policy definitions; this does not implement the corresponding product features. Two scope-clamping declarations (five expanded cases) remain deferred. Runtime role validation and unknown-permission checks add fail-closed local requirements.

SvelteKit [documents server sessions as an application responsibility](https://svelte.dev/docs/kit/auth). The inspected upstream lockfile pins Astro 7.3.2, whose session runtime delegates storage to its framework driver; its defaults are session cookie `HttpOnly`, `SameSite=Lax`, production `Secure` and path `/`. The routes use `session.set('user', { id })` and logout calls `destroy()`. The inspected passkey verifier does not call `regenerate()`.

The following substitutions are explicit and do not claim byte-for-byte Astro session compatibility:

| Substitution | Reason and retained property | Limit |
| --- | --- | --- |
| Astro session API becomes the explicit store seam and an auth-only schema descriptor | SvelteKit supplies no Astro driver; ID-only session data plus current database role remain authoritative | Node SQLite persistence is tested. Production migrations, D1/KV adapter composition and deployed support are deferred. |
| Cookie uses canonical base64url of 32 random bytes, with only decoded-byte SHA-256/base64url hash in storage | Matches the pinned upstream token hashing algorithm with Web Crypto and the same encoding library; rejects oversized/ambiguous client input before a query | Astro's framework cookie is a UUID; upstream `generateSessionId` uses 20 bytes and generic `hashToken` accepts padded/malformed input. Those formats are deliberately not accepted by this new cookie contract. No production token/session issuance is present. |
| Session mutations require exact trusted origin rather than the EmDash custom-header bypass | SvelteKit 2.70.3 production remotes require origin equality for every non-GET remote request (`respond.js`); native forms/remotes need no EmDash-specific header | This is stricter than upstream `checkPublicCsrf`, which permits missing origins and custom-header bypass. Only denial behavior is claimed; remote/browser composition remains joint work. |
| Explicit absolute expiry, including equality, rather than implicit driver TTL | The portable resolver needs a deterministic stored boundary; it checks time after the awaited read and never renews while resolving | Upstream auth config declares 30-day/sliding defaults, but the inspected routes do not wire these to the Astro session TTL. Astro 7.3.2's runtime expires values when stored expiry is less than current time. No 30-day/sliding-equivalence claim is made; creation/renewal/rotation policy remains deferred. |

## Test evidence and remaining work

The committed test-first sequence is:

- `de6753e`: 41 auth cases reach assertions against inert policy/resolver seams; 21 fail and 20 pass. Passing negative cases are not credited as implemented behavior.
- `c293aa6`: real SQLite schema and synthetic persisted rows reach a principal assertion against the inert storage seam; one of two cases fails.
- `9ae890e`: six request/policy cases reach assertions; two fail against the inert origin seam.

The green source ports comprise 28 Node RBAC cases and four Node session-read cases. A local workerd harness repeats the four session-read assertions and two exact own/other role cases. It also exercises nine local security checks; these are supplemental, not nine more upstream ports. Node SQLite local requirements check empty/no-admin tables, hash-only storage, current role demotion, disabled/deleted users, exact expiry, isolated/idempotent revocation and reopening before/after revocation. A gated pending-store test rejects a session that expires while its lookup is in progress.

On Node 24.19.0 / pnpm 12.6.0, `sh scripts/bootstrap.sh` passes: Svelte check has zero errors/warnings, all 111 unit/service/core cases pass without skips, the build succeeds, and all 10 production HTTP cases pass. The workerd core test uses Miniflare 4.20260507.1 / workerd 1.20260507.1, compatibility date 2026-05-07, with **no `nodejs_compat` flag**. Its store is synthetic; it proves portable executable core only, not Cloudflare persistence, framework adapters or cancellation recovery. Local browser execution is blocked because Chromium downloads receive HTTP 403 `Domain forbidden`; the hosted browser job must provide the browser evidence.

Sign-in, passkeys, magic links, invitation/signup, external providers, account/grant provisioning, API tokens, session creation, fixation-resistant rotation at login/reauthentication, sliding renewal, expiry cleanup, production logout wiring, HTTP cookie emission, CSRF integration and production D1/KV composition remain deferred. The later [bounded D1 adapter](d1-database.md) adds real local D1 session storage/read/revocation and reopen evidence, without a login or account API. Rotation must revoke the predecessor at authentication boundaries and needs joint persistence/cookie/no-reuse tests before a login feature can be advertised. This foundation cannot sign anyone in and does not establish a complete authentication system.

Independent review found no executable correctness/security defect. Its regression-coverage observation led to the gated pending-read expiry test; its evidence observations are reflected in the cookie-format and workerd limits above. The draft PR stays unmerged for the parent, hosted CI, the latest automatic review and joint collection-aware integration checks.
