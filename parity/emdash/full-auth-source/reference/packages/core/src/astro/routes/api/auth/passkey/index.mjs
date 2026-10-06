/**
 * GET /_emdash/api/auth/passkey
 *
 * List all passkeys for the authenticated user
 */
export const prerender = false;
import { createKyselyAdapter } from "@emdash-cms/auth/adapters/kysely";
import { apiError, apiSuccess, handleError } from "#api/error.js";
export const GET = async ({ locals }) => {
    const { emdash, user } = locals;
    if (!emdash?.db) {
        return apiError("NOT_CONFIGURED", "EmDash is not initialized", 500);
    }
    // Require authentication
    if (!user) {
        return apiError("NOT_AUTHENTICATED", "Not authenticated", 401);
    }
    try {
        const adapter = createKyselyAdapter(emdash.db);
        const credentials = await adapter.getCredentialsByUserId(user.id);
        // Map to public response format (exclude sensitive fields)
        const passkeys = credentials.map((cred) => ({
            id: cred.id,
            name: cred.name,
            deviceType: cred.deviceType,
            backedUp: cred.backedUp,
            createdAt: cred.createdAt.toISOString(),
            lastUsedAt: cred.lastUsedAt.toISOString(),
        }));
        return apiSuccess({ items: passkeys });
    }
    catch (error) {
        return handleError(error, "Failed to list passkeys", "PASSKEY_LIST_ERROR");
    }
};
