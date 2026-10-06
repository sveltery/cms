/**
 * Plugin Sandbox Types
 *
 * Defines interfaces for running plugins in sandboxed V8 isolates.
 * The SandboxRunner interface is implemented by platform adapters
 * (e.g., Cloudflare Worker Loader) to provide isolation.
 *
 */
const SANDBOX_ROUTE_ERROR_DEFINITIONS = {
    MEDIA_USAGE_ACTIVATION_IN_PROGRESS: {
        message: "Media usage activation is in progress",
        status: 503,
    },
    MEDIA_USAGE_ACTIVATION_CHECK_FAILED: {
        message: "Unable to verify media usage activation state",
        status: 503,
    },
    TRANSFER_IMPORT_IN_PROGRESS: {
        message: "A site import is in progress or incomplete; writes are disabled",
        status: 503,
    },
    TRANSFER_FENCE_CHECK_FAILED: {
        message: "Unable to verify whether site writes are allowed",
        status: 503,
    },
};
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function isSandboxRouteErrorCode(value) {
    return typeof value === "string" && value in SANDBOX_ROUTE_ERROR_DEFINITIONS;
}
export function getSandboxRouteErrorDetails(error) {
    if (!isRecord(error))
        return null;
    const propertyCode = isSandboxRouteErrorCode(error.code) ? error.code : null;
    const nameCode = error instanceof Error && isSandboxRouteErrorCode(error.name) ? error.name : null;
    if (propertyCode && nameCode && propertyCode !== nameCode)
        return null;
    const code = propertyCode ?? nameCode;
    if (!code || (error.status !== undefined && error.status !== 503))
        return null;
    return {
        code,
        ...SANDBOX_ROUTE_ERROR_DEFINITIONS[code],
    };
}
export function createSandboxRouteError(code) {
    const details = {
        code,
        ...SANDBOX_ROUTE_ERROR_DEFINITIONS[code],
    };
    return Object.assign(new Error(details.message), details, { name: code });
}
export function createSandboxRouteErrorEnvelope(error) {
    const details = getSandboxRouteErrorDetails(error);
    return details ? { __emdashSandboxRouteError: true, error: details } : null;
}
export function getSandboxRouteErrorEnvelope(value) {
    if (!isRecord(value) || value.__emdashSandboxRouteError !== true)
        return null;
    const details = getSandboxRouteErrorDetails(value.error);
    return details ? { __emdashSandboxRouteError: true, error: details } : null;
}
export function withUnavailableReason(message, runner) {
    const reason = runner?.unavailableReason?.();
    return reason ? `${message}: ${reason}` : message;
}
/**
 * Error thrown when the sandbox runtime is unavailable.
 * This happens when the sidecar process has crashed or hasn't started.
 */
export class SandboxUnavailableError extends Error {
    constructor(pluginId, reason) {
        super(`Plugin sandbox unavailable for ${pluginId}: ${reason}`);
        this.name = "SandboxUnavailableError";
    }
}
