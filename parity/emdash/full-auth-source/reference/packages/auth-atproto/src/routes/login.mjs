/**
 * POST /_emdash/api/auth/atproto/login
 *
 * Initiates the AT Protocol OAuth flow by generating an authorization URL.
 * The client should redirect the browser to the returned URL.
 */
export const prerender = false;
import { apiError, apiSuccess, getPublicOrigin, handleError, isParseError, parseBody, } from "emdash/api/route-utils";
import { atprotoLoginBody } from "emdash/api/schemas";
export const POST = async ({ request, locals }) => {
    const { emdash } = locals;
    if (!emdash?.db) {
        return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
    }
    try {
        const body = await parseBody(request, atprotoLoginBody);
        if (isParseError(body))
            return body;
        const url = new URL(request.url);
        const baseUrl = getPublicOrigin(url, emdash?.config);
        const { getAtprotoOAuthClient } = await import("@emdash-cms/auth-atproto/oauth-client");
        const { getAtprotoStorage } = await import("../storage.js");
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- emdash locals satisfy EmdashLocals shape required by getAtprotoStorage
        const storage = await getAtprotoStorage(emdash);
        const client = await getAtprotoOAuthClient(baseUrl, storage);
        const { url: authUrl } = await client.authorize({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- body.handle is a validated string, ActorIdentifier is atcute's branded type
            target: { type: "account", identifier: body.handle },
        });
        return apiSuccess({ url: authUrl.toString() });
    }
    catch (error) {
        return handleError(error, "Failed to start AT Protocol login", "ATPROTO_LOGIN_ERROR");
    }
};
