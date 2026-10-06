/**
 * User management, passkeys, and allowed domains APIs
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
import { API_BASE, apiFetch, parseApiResponse, throwResponseError, } from "./client.js";
/**
 * Fetch users with search, filter, and pagination
 */
export async function fetchUsers(options) {
    const params = new URLSearchParams();
    if (options?.search)
        params.set("search", options.search);
    if (options?.role !== undefined)
        params.set("role", String(options.role));
    if (options?.cursor)
        params.set("cursor", options.cursor);
    if (options?.limit)
        params.set("limit", String(options.limit));
    const url = `${API_BASE}/admin/users${params.toString() ? `?${params}` : ""}`;
    const response = await apiFetch(url);
    return parseApiResponse(response, "Failed to fetch users");
}
/**
 * Fetch a single user with details
 */
export async function fetchUser(id) {
    const response = await apiFetch(`${API_BASE}/admin/users/${id}`);
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`User not found: ${id}`);
        }
        await throwResponseError(response, i18n._(msg `Failed to fetch user`));
    }
    const data = await parseApiResponse(response, i18n._(msg `Failed to fetch user`));
    return data.item;
}
/**
 * Update a user
 */
export async function updateUser(id, input) {
    const response = await apiFetch(`${API_BASE}/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const data = await parseApiResponse(response, "Failed to update user");
    return data.item;
}
/**
 * Disable a user
 */
export async function disableUser(id) {
    const response = await apiFetch(`${API_BASE}/admin/users/${id}/disable`, {
        method: "POST",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to disable user`));
}
/**
 * Send a recovery magic link to a user
 */
export async function sendRecoveryLink(id) {
    const response = await apiFetch(`${API_BASE}/admin/users/${id}/send-recovery`, {
        method: "POST",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to send recovery link`));
}
/**
 * Enable a user
 */
export async function enableUser(id) {
    const response = await apiFetch(`${API_BASE}/admin/users/${id}/enable`, {
        method: "POST",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to enable user`));
}
/**
 * Invite a new user
 *
 * Uses the existing /auth/invite endpoint.
 * When no email provider is configured, the response includes
 * an `inviteUrl` for manual sharing.
 */
export async function inviteUser(email, role) {
    const response = await apiFetch(`${API_BASE}/auth/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
    });
    return parseApiResponse(response, "Failed to invite user");
}
/**
 * Validate an invite token and return the invite data.
 *
 * Uses custom error handling to preserve error codes for the UI.
 */
export async function validateInviteToken(token) {
    const response = await apiFetch(`${API_BASE}/auth/invite/accept?token=${encodeURIComponent(token)}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let message = `Invite validation failed: ${response.statusText}`;
        let code;
        if (typeof errorData === "object" && errorData !== null && "error" in errorData) {
            const err = errorData.error;
            if (typeof err === "object" && err !== null) {
                if ("message" in err && typeof err.message === "string")
                    message = err.message;
                if ("code" in err && typeof err.code === "string")
                    code = err.code;
            }
        }
        const error = new Error(message);
        error.code = code;
        throw error;
    }
    return parseApiResponse(response, "Invite validation failed");
}
/**
 * List all passkeys for the current user
 */
export async function fetchPasskeys() {
    const response = await apiFetch(`${API_BASE}/auth/passkey`);
    const data = await parseApiResponse(response, "Failed to fetch passkeys");
    return data.items;
}
/**
 * Rename a passkey
 */
export async function renamePasskey(id, name) {
    const response = await apiFetch(`${API_BASE}/auth/passkey/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
    });
    const data = await parseApiResponse(response, "Failed to rename passkey");
    return data.passkey;
}
/**
 * Delete a passkey
 */
export async function deletePasskey(id) {
    const response = await apiFetch(`${API_BASE}/auth/passkey/${id}`, {
        method: "DELETE",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete passkey`));
}
/**
 * Fetch all allowed domains
 */
export async function fetchAllowedDomains() {
    const response = await apiFetch(`${API_BASE}/admin/allowed-domains`);
    const data = await parseApiResponse(response, "Failed to fetch allowed domains");
    return data.domains;
}
/**
 * Create an allowed domain
 */
export async function createAllowedDomain(input) {
    const response = await apiFetch(`${API_BASE}/admin/allowed-domains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const data = await parseApiResponse(response, "Failed to create allowed domain");
    return data.domain;
}
/**
 * Update an allowed domain
 */
export async function updateAllowedDomain(domain, input) {
    const response = await apiFetch(`${API_BASE}/admin/allowed-domains/${encodeURIComponent(domain)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const data = await parseApiResponse(response, "Failed to update allowed domain");
    return data.domain;
}
/**
 * Delete an allowed domain
 */
export async function deleteAllowedDomain(domain) {
    const response = await apiFetch(`${API_BASE}/admin/allowed-domains/${encodeURIComponent(domain)}`, {
        method: "DELETE",
    });
    if (!response.ok)
        await throwResponseError(response, i18n._(msg `Failed to delete allowed domain`));
}
/**
 * Request signup - send verification email
 * Always returns success to prevent enumeration
 */
export async function requestSignup(email) {
    const response = await apiFetch(`${API_BASE}/auth/signup/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
    });
    return parseApiResponse(response, "Signup request failed");
}
/**
 * Verify signup token
 *
 * Uses custom error handling to preserve error codes for the UI.
 */
export async function verifySignupToken(token) {
    const response = await apiFetch(`${API_BASE}/auth/signup/verify?token=${encodeURIComponent(token)}`);
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let message = `Token verification failed: ${response.statusText}`;
        let code;
        if (typeof errorData === "object" && errorData !== null && "error" in errorData) {
            const err = errorData.error;
            if (typeof err === "object" && err !== null) {
                if ("message" in err && typeof err.message === "string")
                    message = err.message;
                if ("code" in err && typeof err.code === "string")
                    code = err.code;
            }
        }
        const error = new Error(message);
        error.code = code;
        throw error;
    }
    return parseApiResponse(response, "Token verification failed");
}
/**
 * Complete signup with passkey registration
 *
 * Uses custom error handling to preserve error codes for the UI.
 */
export async function completeSignup(token, credential, name) {
    const response = await apiFetch(`${API_BASE}/auth/signup/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, credential, name }),
    });
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        let message = `Signup completion failed: ${response.statusText}`;
        let code;
        if (typeof errorData === "object" && errorData !== null && "error" in errorData) {
            const err = errorData.error;
            if (typeof err === "object" && err !== null) {
                if ("message" in err && typeof err.message === "string")
                    message = err.message;
                if ("code" in err && typeof err.code === "string")
                    code = err.code;
            }
        }
        const error = new Error(message);
        error.code = code;
        throw error;
    }
    return parseApiResponse(response, "Signup completion failed");
}
/**
 * Check if any allowed domains exist (for showing signup link)
 */
export async function hasAllowedDomains() {
    try {
        const domains = await fetchAllowedDomains();
        return domains.some((d) => d.enabled);
    }
    catch {
        // If we can't fetch (e.g., not logged in), assume no domains
        return false;
    }
}
