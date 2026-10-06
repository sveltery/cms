/** Current wire-format version for sandbox hook result envelopes. */
export const SANDBOX_HOOK_RESULT_VERSION = 1;
/** Maximum editor-facing rejection reason accepted from a sandboxed plugin. */
export const MAX_SANDBOX_SAVE_REJECTION_REASON_LENGTH = 500;
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
/** Validate and normalize an untrusted value returned across the sandbox boundary. */
export function inspectSandboxHookResult(value) {
    if (!isRecord(value) || !Object.hasOwn(value, "__emdashSandboxHookResult")) {
        return { kind: "value" };
    }
    if (value.__emdashSandboxHookResult !== true ||
        value.version !== SANDBOX_HOOK_RESULT_VERSION ||
        !isRecord(value.error) ||
        value.error.code !== "SAVE_REJECTED" ||
        typeof value.error.reason !== "string") {
        return { kind: "malformed" };
    }
    const reason = value.error.reason.trim();
    if (reason.length === 0 || reason.length > MAX_SANDBOX_SAVE_REJECTION_REASON_LENGTH) {
        return { kind: "malformed" };
    }
    return { kind: "error", error: { code: "SAVE_REJECTED", reason } };
}
