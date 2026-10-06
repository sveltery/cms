/**
 * Base API client configuration and shared types
 */
import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";
export const API_BASE = "/_emdash/api";
/**
 * Fetch wrapper that adds the X-EmDash-Request CSRF protection header
 * to all requests. All API calls should use this instead of raw fetch().
 */
export function apiFetch(input, init) {
    const headers = new Headers(init?.headers);
    headers.set("X-EmDash-Request", "1");
    return fetch(input, { ...init, headers });
}
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
export class ApiResponseError extends Error {
    status;
    code;
    details;
    constructor(status, code, message, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.name = "ApiResponseError";
    }
}
/**
 * Extract per-field validation issue messages from a `VALIDATION_ERROR`
 * response's `error.details.issues` array (see `packages/core/src/api/parse.ts`).
 * Returns undefined when the shape doesn't match, so callers can fall back
 * to the generic top-level message.
 */
function formatValidationIssues(error) {
    if (error.code !== "VALIDATION_ERROR")
        return undefined;
    if (!isRecord(error.details))
        return undefined;
    const issues = error.details.issues;
    if (!Array.isArray(issues) || issues.length === 0)
        return undefined;
    const messages = issues
        .map((issue) => {
        if (!isRecord(issue))
            return undefined;
        const { path, message } = issue;
        if (typeof message !== "string")
            return undefined;
        return typeof path === "string" && path.length > 0 ? `${path}: ${message}` : message;
    })
        .filter((m) => m !== undefined);
    return messages.length > 0 ? messages.join("; ") : undefined;
}
function formatSandboxedSaveRejection(error) {
    if (error.code !== "SAVE_REJECTED" || !isRecord(error.details))
        return undefined;
    const { pluginId, reason } = error.details;
    if (typeof pluginId !== "string" || typeof reason !== "string")
        return undefined;
    if (pluginId.length === 0 || reason.length === 0)
        return undefined;
    return i18n._(msg `Plugin ${pluginId} rejected the save: ${reason}`);
}
/**
 * Client errors that pass no verdict on the request body, so resending it
 * unchanged can still succeed. Every other 4xx repeats its verdict on every
 * attempt.
 */
const RETRYABLE_CLIENT_ERROR_STATUSES = new Set([
    408, // Request Timeout: the server gave up waiting for the request
    421, // Misdirected Request: another connection can be routed correctly
    425, // Too Early: sent as TLS early data, replayable after the handshake
    429, // Too Many Requests: succeeds once the rate limit window has passed
]);
/** Whether retrying the same request unchanged can never succeed. */
export function isTerminalRequestError(error) {
    if (!(error instanceof ApiResponseError))
        return false;
    return (error.status >= 400 && error.status < 500 && !RETRYABLE_CLIENT_ERROR_STATUSES.has(error.status));
}
/**
 * Throw an error with the message from the API response body if available,
 * falling back to a generic message. All API error responses use the shape
 * `{ success: false, error: { code, message, details? } }`. For validation
 * errors, the field-level messages in `error.details.issues` are surfaced
 * instead of the generic "Invalid request data" top-level message.
 */
export async function throwResponseError(res, fallback) {
    const body = await res.json().catch(() => ({}));
    let message;
    let code = "UNKNOWN_ERROR";
    let details;
    if (isRecord(body) && isRecord(body.error)) {
        const { error } = body;
        message = formatValidationIssues(error);
        if (!message)
            message = formatSandboxedSaveRejection(error);
        if (!message && typeof error.message === "string")
            message = error.message;
        if (typeof error.code === "string")
            code = error.code;
        if (isRecord(error.details))
            details = error.details;
    }
    throw new ApiResponseError(res.status, code, message || `${fallback}: ${res.statusText}`, details);
}
/**
 * Parse an API response with the { success, data: T } envelope.
 *
 * Handles error responses via throwResponseError, then unwraps the data envelope.
 * Replaces both bare `response.json()` and field-unwrap patterns.
 */
export async function parseApiResponse(response, fallbackMessage = i18n._(msg `Request failed`)) {
    if (!response.ok)
        await throwResponseError(response, fallbackMessage);
    const body = await response.json();
    return body.data;
}
/**
 * Fetch admin manifest
 */
export async function fetchManifest() {
    const response = await apiFetch(`${API_BASE}/manifest`);
    return parseApiResponse(response, i18n._(msg `Failed to fetch manifest`));
}
/**
 * Fetch auth mode (public endpoint — works without authentication).
 * Used by the login page to determine which login UI to render.
 */
export async function fetchAuthMode() {
    const response = await apiFetch(`${API_BASE}/auth/mode`);
    return parseApiResponse(response, i18n._(msg `Failed to fetch auth mode`));
}
