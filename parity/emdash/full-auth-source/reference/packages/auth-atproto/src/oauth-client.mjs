/**
 * AT Protocol OAuth Client
 *
 * Creates and manages the @atcute/oauth-node-client OAuthClient instance
 * for AT Protocol PDS authentication.
 *
 * The OAuthClient handles all atproto-specific OAuth complexity:
 * - DPoP (proof-of-possession tokens)
 * - PAR (Pushed Authorization Requests)
 * - PKCE (Proof Key for Code Exchange)
 * - Session management with automatic token refresh
 * - Actor resolution (handle → DID → PDS)
 *
 * Uses a public client with PKCE in all environments. Per the AT Protocol
 * OAuth spec, public clients have a 2-week session lifetime cap (vs unlimited
 * for confidential clients), which is acceptable for a CMS admin panel.
 * This avoids the complexity of key management, JWKS endpoints, and
 * client assertion signing that confidential clients require.
 *
 * In dev (http://localhost), uses a loopback client per RFC 8252 — no client
 * metadata endpoint needed. In production (HTTPS), the PDS fetches the
 * client metadata document to verify the client.
 */
import { CompositeDidDocumentResolver, CompositeHandleResolver, DohJsonHandleResolver, LocalActorResolver, PlcDidDocumentResolver, WebDidDocumentResolver, WellKnownHandleResolver, } from "@atcute/identity-resolver";
import { MemoryStore, OAuthClient, } from "@atcute/oauth-node-client";
import { createDbStore } from "./db-store.js";
function isLoopback(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
    }
    catch {
        return false;
    }
}
/**
 * Create an AT Protocol OAuth client for a single request.
 *
 * Constructed per-request to avoid leaking state between requests on Workers
 * (where module-scope vars persist across isolate reuses) and between
 * concurrent requests on Node.
 *
 * Uses a public client with PKCE in all environments:
 * - Loopback (localhost/127.0.0.1): No client metadata needed — PDS derives
 *   metadata from client_id URL parameters per RFC 8252.
 * - Production (HTTPS): PDS fetches the client metadata document to verify
 *   the client. No JWKS or key management needed.
 *
 * @param baseUrl - The site's public URL.
 * @param storage - Auth provider storage collections from `getAuthProviderStorage()`.
 *                  Pass `null` to use in-memory storage (dev only).
 */
export async function getAtprotoOAuthClient(baseUrl, storage) {
    // RFC 8252 §8.3: loopback redirect URIs MUST use an IP literal (127.0.0.1),
    // not "localhost". The atcute library enforces this — see loopbackRedirectUriSchema.
    // The admin UI normalizes the browser to 127.0.0.1 before initiating the flow
    // (ensureLoopbackIP in admin.tsx) so cookies stay on one origin.
    if (isLoopback(baseUrl)) {
        baseUrl = baseUrl.replace("://localhost", "://127.0.0.1");
    }
    const actorResolver = new LocalActorResolver({
        handleResolver: new CompositeHandleResolver({
            methods: {
                dns: new DohJsonHandleResolver({ dohUrl: "https://cloudflare-dns.com/dns-query" }),
                http: new WellKnownHandleResolver(),
            },
        }),
        didDocumentResolver: new CompositeDidDocumentResolver({
            methods: {
                plc: new PlcDidDocumentResolver(),
                web: new WebDidDocumentResolver(),
            },
        }),
    });
    // Use plugin storage when available (required for multi-instance deployments
    // like Cloudflare Workers where in-memory state doesn't survive across
    // requests). Fall back to MemoryStore for local dev.
    const stores = storage
        ? {
            sessions: createDbStore(() => 
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- plugin storage collections match StorageCollectionLike shape
            storage.sessions),
            states: createDbStore(() => 
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- plugin storage collections match StorageCollectionLike shape
            storage.states),
        }
        : {
            sessions: new MemoryStore(),
            states: new MemoryStore(),
        };
    if (isLoopback(baseUrl)) {
        // Loopback public client for local development.
        // AT Protocol spec allows loopback IPs with public clients.
        // No client metadata endpoints needed — the PDS derives
        // metadata from the client_id URL parameters per RFC 8252.
        // baseUrl is already normalized to 127.0.0.1 above (RFC 8252).
        return new OAuthClient({
            metadata: {
                redirect_uris: [`${baseUrl}/_emdash/api/auth/atproto/callback`],
                scope: "atproto transition:generic",
            },
            stores,
            actorResolver,
        });
    }
    // Public client for production (HTTPS).
    // Uses PKCE for security — no client secret or key management needed.
    // The PDS fetches the client metadata document to verify redirect_uris.
    return new OAuthClient({
        metadata: {
            client_id: `${baseUrl}/.well-known/atproto-client-metadata.json`,
            redirect_uris: [`${baseUrl}/_emdash/api/auth/atproto/callback`],
            scope: "atproto transition:generic",
        },
        stores,
        actorResolver,
    });
}
/**
 * Resolve an AT Protocol user's display name and handle from their PDS.
 *
 * Uses the authenticated session to call com.atproto.repo.getRecord
 * for the app.bsky.actor.profile record. Returns displayName and handle
 * (falls back to DID if resolution fails).
 */
export async function resolveAtprotoProfile(atprotoSession) {
    const did = atprotoSession.did;
    // Resolve handle and displayName as independent best-effort steps.
    // Handle comes from getSession (authoritative PDS record).
    // DisplayName comes from the profile record (optional, cosmetic).
    let handle = did;
    let displayName = null;
    // 1. Handle via getSession (needed for allowlist checks — fetch independently)
    try {
        const sessionRes = await atprotoSession.handle("/xrpc/com.atproto.server.getSession");
        if (sessionRes.ok) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- atproto XRPC getSession returns { handle?: string }
            const sessionData = (await sessionRes.json());
            if (sessionData.handle)
                handle = sessionData.handle;
        }
    }
    catch (error) {
        console.warn("[atproto-auth] Failed to resolve handle via getSession:", error);
    }
    // 2. DisplayName via profile record (cosmetic — failure is fine)
    try {
        const res = await atprotoSession.handle(`/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=app.bsky.actor.profile&rkey=self`);
        if (res.ok) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- atproto XRPC getRecord returns { value?: { displayName?: string } }
            const data = (await res.json());
            displayName = data.value?.displayName || null;
        }
    }
    catch (error) {
        console.warn("[atproto-auth] Failed to resolve profile record:", error);
    }
    return { displayName, handle };
}
