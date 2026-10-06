import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * AT Protocol Auth Provider Admin Components
 *
 * Provides LoginForm and SetupStep components for the pluggable auth system.
 * These are imported at build time via the virtual:emdash/auth-providers module.
 */
import { Button, Input } from "@cloudflare/kumo";
import * as React from "react";
// ============================================================================
// Shared icon
// ============================================================================
function AtprotoIcon({ className }) {
    return (_jsx("svg", { className: className, viewBox: "0 0 600 527", fill: "currentColor", children: _jsx("path", { d: "m135.72 44.03c66.496 49.921 138.02 151.14 164.28 205.46 26.262-54.316 97.782-155.54 164.28-205.46 47.98-36.021 125.72-63.892 125.72 24.795 0 17.712-10.155 148.79-16.111 170.07-20.703 73.984-96.144 92.854-163.25 81.433 117.3 19.964 147.14 86.092 82.697 152.22-122.39 125.59-175.91-31.511-189.63-71.766-2.514-7.3797-3.6904-10.832-3.7077-7.8964-0.0174-2.9357-1.1937 0.51669-3.7077 7.8964-13.714 40.255-67.233 197.36-189.63 71.766-64.444-66.128-34.605-132.26 82.697-152.22-67.108 11.421-142.55-7.4491-163.25-81.433-5.9562-21.282-16.111-152.36-16.111-170.07 0-88.687 77.742-60.816 125.72-24.795z" }) }));
}
// ============================================================================
// LoginButton — compact button shown in the provider grid
// ============================================================================
export function LoginButton() {
    return (_jsxs(Button, { type: "button", variant: "outline", className: "w-full justify-center", children: [_jsx(AtprotoIcon, { className: "h-5 w-5" }), _jsx("span", { children: "Atmosphere" })] }));
}
// ============================================================================
// LoginForm — expanded form shown when LoginButton is clicked
// ============================================================================
export function LoginForm() {
    const [handle, setHandle] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!handle.trim())
            return;
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch("/_emdash/api/auth/atproto/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-EmDash-Request": "1",
                },
                body: JSON.stringify({ handle: handle.trim() }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body?.error?.message || "Failed to start AT Protocol login");
            }
            const result = await response.json();
            window.location.href = result.data.url;
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to start AT Protocol login");
            setIsLoading(false);
        }
    };
    return (_jsxs("form", { onSubmit: handleSubmit, className: "space-y-3", children: [_jsx(Input, { label: "Atmosphere Handle", type: "text", value: handle, onChange: (e) => setHandle(e.target.value), placeholder: "you.bsky.social", disabled: isLoading }), error && (_jsx("div", { className: "rounded-lg bg-kumo-danger/10 p-3 text-sm text-kumo-danger", children: error })), _jsx(Button, { type: "submit", className: "w-full", disabled: isLoading || !handle.trim(), children: isLoading ? "Connecting..." : "Sign in" })] }));
}
// ============================================================================
// SetupStep — shown in the setup wizard
// ============================================================================
export function SetupStep({ onComplete }) {
    const [handle, setHandle] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    // Suppress unused variable warning — onComplete is called after redirect
    void onComplete;
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!handle.trim())
            return;
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch("/_emdash/api/setup/atproto-admin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-EmDash-Request": "1",
                },
                body: JSON.stringify({ handle: handle.trim() }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body?.error?.message || "Failed to start AT Protocol login");
            }
            const result = await response.json();
            // Redirect to PDS authorization page — onComplete will be called after redirect back
            window.location.href = result.data.url;
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to start AT Protocol login");
            setIsLoading(false);
        }
    };
    return (_jsxs("form", { onSubmit: handleSubmit, className: "space-y-3", children: [_jsxs("div", { className: "text-center mb-2", children: [_jsx("p", { className: "text-sm font-medium text-kumo-default", children: "Atmosphere" }), _jsx("p", { className: "text-xs text-kumo-subtle", children: "Sign in with your Bluesky/Atmosphere handle" })] }), _jsx(Input, { label: "Atmosphere Handle", name: "handle", type: "text", value: handle, onChange: (e) => setHandle(e.target.value), placeholder: "you.bsky.social", disabled: isLoading, className: "w-full" }), error && (_jsx("div", { className: "rounded-lg bg-kumo-danger/10 p-3 text-sm text-kumo-danger", children: error })), _jsx(Button, { type: "submit", variant: "outline", className: "w-full", disabled: isLoading || !handle.trim(), children: isLoading ? "Connecting..." : "Sign in" })] }));
}
