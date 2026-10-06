import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Device Authorization Page
 *
 * Standalone page where users enter the code displayed by `emdash login`
 * to authorize a CLI or agent to access their account.
 *
 * Flow:
 * 1. User runs `emdash login` → sees a code like ABCD-1234
 * 2. User opens this page in their browser (already logged in)
 * 3. User enters the code → clicks Authorize
 * 4. CLI receives tokens and saves them
 */
import { Button, Input, Loader } from "@cloudflare/kumo";
import { useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import * as React from "react";
import { apiFetch, API_BASE, ApiResponseError, parseApiResponse } from "../lib/api";
import { cn } from "../lib/utils";
import { API_TOKEN_SCOPE_VALUES } from "./settings/ApiTokenSettings.js";
// ============================================================================
// Constants
// ============================================================================
const ROLE_NAMES = {
    10: "Subscriber",
    20: "Contributor",
    30: "Author",
    40: "Editor",
    50: "Admin",
};
const DEVICE_CODE_INVALID_CHARS_REGEX = /[^A-Z0-9-]/g;
const DEVICE_CODE_HYPHEN_REGEX = /-/g;
const DEVICE_CODE_LENGTH = 8;
const SCOPE_DETAILS = new Map(API_TOKEN_SCOPE_VALUES.map((entry) => [entry.scope, entry]));
const PLUGIN_MCP_SCOPE_PREFIX = "mcp:tools:";
/** Uppercase, strip invalid characters, cap at 9 characters, and insert a hyphen once 4 are typed */
function formatDeviceCode(raw) {
    let value = raw.toUpperCase().replace(DEVICE_CODE_INVALID_CHARS_REGEX, "");
    // Auto-insert hyphen after 4 chars if not already present
    if (value.length === 4 && !value.includes("-")) {
        value = value + "-";
    }
    // Limit to 9 chars (XXXX-XXXX)
    if (value.length > 9) {
        value = value.slice(0, 9);
    }
    return value;
}
// ============================================================================
// Component
// ============================================================================
export function DeviceAuthorizePage() {
    const { t } = useLingui();
    const [code, setCode] = React.useState("");
    const [pageState, setPageState] = React.useState("input");
    const [errorMessage, setErrorMessage] = React.useState("");
    // Check if user is logged in
    const { data: user, isLoading, error: authError, } = useQuery({
        queryKey: ["auth-me"],
        queryFn: async () => {
            const res = await apiFetch(`${API_BASE}/auth/me`);
            return parseApiResponse(res, "Not authenticated");
        },
        retry: false,
    });
    const normalizedCode = code.replace(DEVICE_CODE_HYPHEN_REGEX, "");
    const codeComplete = normalizedCode.length === DEVICE_CODE_LENGTH;
    const scopesQuery = useQuery({
        queryKey: ["device-code-scopes", normalizedCode],
        queryFn: async () => {
            const params = new URLSearchParams({ user_code: normalizedCode });
            const res = await apiFetch(`${API_BASE}/oauth/device/authorize?${params}`);
            return parseApiResponse(res, t `Could not check this code`);
        },
        enabled: !!user && codeComplete && (pageState === "input" || pageState === "error"),
        retry: false,
    });
    const canApprove = (scopesQuery.data?.grantedScopes.length ?? 0) > 0;
    // Pre-populate from URL query param (?code=ABCD-1234)
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlCode = params.get("code");
        if (urlCode) {
            setCode(formatDeviceCode(urlCode));
        }
    }, []);
    // Not authenticated — redirect to login
    React.useEffect(() => {
        if (!isLoading && (authError || !user)) {
            const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/_emdash/admin/login?redirect=${returnUrl}`;
        }
    }, [isLoading, authError, user]);
    async function handleSubmit(e) {
        e.preventDefault();
        const trimmed = code.trim();
        if (!trimmed || !canApprove)
            return;
        setPageState("submitting");
        setErrorMessage("");
        try {
            const res = await apiFetch(`${API_BASE}/oauth/device/authorize`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_code: trimmed, action: "approve" }),
            });
            const data = await parseApiResponse(res, t `Authorization failed`);
            setPageState(data.authorized ? "success" : "denied");
        }
        catch (err) {
            setErrorMessage(err instanceof Error ? err.message : "Network error");
            setPageState("error");
        }
    }
    async function handleDeny(e) {
        e.preventDefault();
        const trimmed = code.trim();
        if (!trimmed)
            return;
        setPageState("submitting");
        try {
            await apiFetch(`${API_BASE}/oauth/device/authorize`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_code: trimmed, action: "deny" }),
            });
            setPageState("denied");
        }
        catch {
            setPageState("denied");
        }
    }
    function handleCodeChange(e) {
        setCode(formatDeviceCode(e.target.value));
    }
    if (isLoading) {
        return (_jsx(PageWrapper, { children: _jsx("p", { className: "text-kumo-subtle text-sm", children: t `Checking authentication...` }) }));
    }
    if (!user) {
        return (_jsx(PageWrapper, { children: _jsx("p", { className: "text-kumo-subtle text-sm", children: t `Redirecting to login...` }) }));
    }
    return (_jsx(PageWrapper, { children: _jsxs("div", { className: "w-full max-w-sm", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx("div", { className: "inline-flex items-center justify-center w-12 h-12 rounded-xl bg-kumo-brand/10 mb-4", children: _jsx(TerminalIcon, { className: "w-6 h-6 text-kumo-link" }) }), _jsx("h1", { className: "text-xl font-semibold tracking-tight", children: t `Authorize Device` }), _jsx("p", { className: "text-kumo-subtle text-sm mt-1.5", children: t `Enter the code from your terminal` })] }), pageState === "success" && (_jsxs("div", { className: "rounded-lg border border-kumo-success/50 bg-kumo-success-tint p-6 text-center", children: [_jsx("div", { className: "inline-flex items-center justify-center w-10 h-10 rounded-full bg-kumo-success/15 mb-3", children: _jsx(CheckIcon, { className: "w-5 h-5 text-kumo-success" }) }), _jsx("h2", { className: "font-medium text-kumo-success", children: t `Device authorized` }), _jsx("p", { className: "text-sm text-kumo-subtle mt-1", children: t `You can close this page and return to your terminal.` }), _jsx("p", { className: "text-xs text-kumo-subtle mt-3", children: t `Signed in as ${user.email}` })] })), pageState === "denied" && (_jsxs("div", { className: "rounded-lg border border-kumo-line bg-kumo-base p-6 text-center", children: [_jsx("h2", { className: "font-medium", children: t `Authorization denied` }), _jsx("p", { className: "text-sm text-kumo-subtle mt-1", children: t `The device will not be granted access.` }), _jsx(Button, { className: "mt-4", variant: "outline", onClick: () => {
                                setPageState("input");
                                setCode("");
                            }, children: t `Try another code` })] })), (pageState === "input" || pageState === "submitting" || pageState === "error") && (_jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("div", { className: "rounded-lg border border-kumo-line bg-kumo-base p-6", children: [_jsxs("div", { className: "flex items-center gap-2 mb-5 pb-4 border-b border-kumo-line", children: [_jsx("div", { className: "w-8 h-8 rounded-full bg-kumo-tint flex items-center justify-center text-xs font-medium", children: (user.name || user.email).charAt(0).toUpperCase() }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-sm font-medium truncate", children: user.name || user.email }), _jsx("p", { className: "text-xs text-kumo-subtle", children: ROLE_NAMES[user.role] || t `User` })] })] }), _jsx("label", { className: "block text-sm font-medium mb-2", htmlFor: "user-code", children: t `Device code` }), _jsx(Input, { id: "user-code", type: "text", value: code, onChange: handleCodeChange, placeholder: "XXXX-XXXX", className: "text-center text-lg font-mono tracking-widest", autoFocus: true, autoComplete: "off", spellCheck: false, disabled: pageState === "submitting" }), pageState === "error" && errorMessage && (_jsx("p", { className: "text-sm text-kumo-danger mt-2", children: errorMessage })), codeComplete && (_jsx(RequestedScopes, { isLoading: scopesQuery.isLoading, error: scopesQuery.error, scopes: scopesQuery.data })), _jsxs("div", { className: "flex gap-2 mt-4", children: [_jsx(Button, { type: "submit", className: "flex-1", disabled: !codeComplete || !canApprove || pageState === "submitting", children: pageState === "submitting" ? t `Authorizing...` : t `Authorize` }), _jsx(Button, { type: "button", variant: "outline", onClick: handleDeny, disabled: !codeComplete || pageState === "submitting", children: t `Deny` })] })] }), _jsx("p", { className: "text-xs text-kumo-subtle text-center mt-4", children: t `Only authorize codes you recognize.` })] }))] }) }));
}
// ============================================================================
// Requested scopes
// ============================================================================
function RequestedScopes({ isLoading, error, scopes, }) {
    const { t } = useLingui();
    const grantedHeadingId = React.useId();
    const withheldHeadingId = React.useId();
    if (isLoading) {
        return (_jsxs("div", { className: "flex items-center gap-2 text-sm text-kumo-subtle mt-4", children: [_jsx(Loader, { size: "sm" }), t `Checking code...`] }));
    }
    if (error) {
        let message = t `Could not check this code.`;
        if (error instanceof ApiResponseError && error.code === "INVALID_CODE") {
            message = t `This code is invalid or has already been used.`;
        }
        else if (error instanceof ApiResponseError && error.code === "EXPIRED_CODE") {
            message = t `This code has expired. Start the sign-in again from your terminal to get a new one.`;
        }
        return (_jsx("p", { className: "text-sm text-kumo-danger mt-2", role: "alert", children: message }));
    }
    if (!scopes)
        return null;
    const withheld = scopes.requestedScopes.filter((scope) => !scopes.grantedScopes.includes(scope));
    return (_jsxs("div", { className: "mt-4 space-y-4", children: [scopes.grantedScopes.length > 0 ? (_jsxs("section", { "aria-labelledby": grantedHeadingId, children: [_jsx("h2", { id: grantedHeadingId, className: "text-sm font-medium mb-2", children: t `This device is requesting permission to use:` }), _jsx(ScopeList, { scopes: scopes.grantedScopes })] })) : (_jsx("p", { className: "text-sm text-kumo-danger", role: "alert", children: t `Your role does not permit any of the permissions this device requested.` })), withheld.length > 0 && (_jsxs("section", { "aria-labelledby": withheldHeadingId, children: [_jsx("h2", { id: withheldHeadingId, className: "text-sm font-medium mb-2 text-kumo-subtle", children: t `Also requested, but not available to your role:` }), _jsx(ScopeList, { scopes: withheld, muted: true })] }))] }));
}
function ScopeList({ scopes, muted = false }) {
    const { t } = useLingui();
    return (_jsx("ul", { className: cn("rounded-md border border-kumo-line divide-y divide-kumo-line", muted && "opacity-70"), children: scopes.map((scope) => {
            const details = SCOPE_DETAILS.get(scope);
            let label = scope;
            let description;
            if (details) {
                label = t(details.label);
                description = t(details.description);
            }
            else if (scope.startsWith(PLUGIN_MCP_SCOPE_PREFIX)) {
                const pluginId = scope.slice(PLUGIN_MCP_SCOPE_PREFIX.length);
                label = t `Plugin MCP Tools`;
                description = t `Invoke MCP tools from the ${pluginId} plugin`;
            }
            return (_jsxs("li", { className: "px-3 py-2", children: [_jsx("div", { className: "text-sm font-medium", children: label }), description && _jsx("div", { className: "text-xs text-kumo-subtle mt-0.5", children: description })] }, scope));
        }) }));
}
// ============================================================================
// Layout wrapper
// ============================================================================
function PageWrapper({ children }) {
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-kumo-base p-4", children: _jsx("div", { className: "w-full max-w-sm", children: children }) }));
}
// ============================================================================
// Icons (inline SVG to avoid dependency on icon library for this simple page)
// ============================================================================
function TerminalIcon({ className }) {
    return (_jsxs("svg", { className: className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", children: [_jsx("polyline", { points: "4 17 10 11 4 5" }), _jsx("line", { x1: "12", y1: "19", x2: "20", y2: "19" })] }));
}
function CheckIcon({ className }) {
    return (_jsx("svg", { className: className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("polyline", { points: "20 6 9 17 4 12" }) }));
}
