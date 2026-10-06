import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Login Page - Standalone login page for the admin
 *
 * This component is NOT wrapped in the admin Shell.
 * It's a standalone page for authentication.
 *
 * Supports:
 * - Passkey authentication (always available)
 * - Pluggable auth providers (AT Protocol, GitHub, Google, etc.) when configured
 * - Magic link (email) when configured
 *
 * When external auth (e.g., Cloudflare Access) is configured, this page
 * redirects to the admin dashboard since authentication is handled externally.
 */
import { Button, Input, Loader, Select } from "@cloudflare/kumo";
import { Trans, useLingui } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import * as React from "react";
import { useAdminBranding } from "../lib/admin-branding-context";
import { apiFetch, fetchAuthMode } from "../lib/api";
import { useAuthProviderList } from "../lib/auth-provider-context";
import { sanitizeRedirectUrl } from "../lib/url";
import { SUPPORTED_LOCALES } from "../locales/index.js";
import { useLocale } from "../locales/useLocale.js";
import { PasskeyLogin } from "./auth/PasskeyLogin";
import { BrandLogo } from "./Logo.js";
function MagicLinkForm({ onBack }) {
    const { t } = useLingui();
    const [email, setEmail] = React.useState("");
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [sent, setSent] = React.useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            const response = await apiFetch("/_emdash/api/auth/magic-link/send", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });
            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body?.error?.message || t `Failed to send magic link`);
            }
            setSent(true);
        }
        catch (err) {
            setError(err instanceof Error ? err.message : t `Failed to send magic link`);
        }
        finally {
            setIsLoading(false);
        }
    };
    if (sent) {
        return (_jsxs("div", { className: "space-y-6 text-center", children: [_jsx("div", { className: "inline-flex items-center justify-center w-16 h-16 rounded-full bg-kumo-brand/10 mx-auto", children: _jsx("svg", { className: "w-8 h-8 text-kumo-link", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" }) }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold", children: t `Check your email` }), _jsx("p", { className: "text-kumo-subtle mt-2", children: _jsxs(Trans, { children: ["If an account exists for", " ", _jsx("span", { className: "font-medium text-kumo-default", children: email }), ", we've sent a sign-in link."] }) })] }), _jsxs("div", { className: "text-sm text-kumo-subtle", children: [_jsx("p", { children: t `Click the link in the email to sign in.` }), _jsx("p", { className: "mt-2", children: t `The link will expire in 15 minutes.` })] }), _jsx(Button, { variant: "outline", onClick: onBack, className: "mt-4 w-full justify-center", children: t `Back to login` })] }));
    }
    return (_jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [_jsx(Input, { label: t `Email address`, type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "you@example.com", className: error ? "border-kumo-danger" : "", disabled: isLoading, autoComplete: "email", autoFocus: true, required: true }), error && (_jsx("div", { className: "rounded-lg bg-kumo-danger/10 p-3 text-sm text-kumo-danger", children: error })), _jsx(Button, { type: "submit", className: "w-full justify-center", variant: "primary", loading: isLoading, disabled: !email, children: isLoading ? t `Sending...` : t `Send magic link` }), _jsx(Button, { type: "button", variant: "ghost", className: "w-full justify-center", onClick: onBack, children: t `Back to login` })] }));
}
// ============================================================================
// Main Component
// ============================================================================
export function LoginPage({ redirectUrl = "/_emdash/admin" }) {
    // Defense-in-depth: sanitize even if the caller already validated
    const safeRedirectUrl = sanitizeRedirectUrl(redirectUrl);
    const { t } = useLingui();
    const { locale, setLocale } = useLocale();
    const { logo: brandLogo, siteName: brandSiteName } = useAdminBranding();
    const [method, setMethod] = React.useState("passkey");
    const [urlError, setUrlError] = React.useState(null);
    const [activeProvider, setActiveProvider] = React.useState(null);
    // Auth provider components from virtual module (via context)
    const authProviderList = useAuthProviderList();
    // Fetch auth mode from public endpoint (works without authentication)
    const { data: authInfo, isLoading: authModeLoading } = useQuery({
        queryKey: ["authMode"],
        queryFn: fetchAuthMode,
    });
    // Redirect to admin when using external auth (authentication is handled externally)
    React.useEffect(() => {
        if (authInfo?.authMode && authInfo.authMode !== "passkey") {
            window.location.href = safeRedirectUrl;
        }
    }, [authInfo, safeRedirectUrl]);
    // Check for error in URL (from OAuth/provider redirect)
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const error = params.get("error");
        const message = params.get("message");
        if (error) {
            setUrlError(message || t `Authentication error: ${error}`);
            // Clean up URL
            window.history.replaceState({}, "", window.location.pathname);
        }
    }, []);
    const handleSuccess = () => {
        // Redirect after successful login
        window.location.href = safeRedirectUrl;
    };
    // All providers with a LoginButton show in the button grid
    const buttonProviders = authProviderList.filter((p) => p.LoginButton);
    // Show loading state while checking auth mode
    if (authModeLoading || (authInfo?.authMode && authInfo.authMode !== "passkey")) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-kumo-base p-4", children: _jsxs("div", { className: "flex flex-col items-center", children: [_jsx(BrandLogo, { logoUrl: brandLogo, siteName: brandSiteName, className: "h-10 mb-4" }), _jsx(Loader, {})] }) }));
    }
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-kumo-base p-4", children: _jsxs("div", { className: "w-full max-w-md", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx(BrandLogo, { logoUrl: brandLogo, siteName: brandSiteName, className: "h-10 mx-auto mb-2" }), _jsx("h1", { className: "text-2xl font-semibold text-kumo-default", children: method === "magic-link"
                                ? t `Sign in with email`
                                : activeProvider
                                    ? t `Sign in with ${authProviderList.find((p) => p.id === activeProvider)?.label ?? activeProvider}`
                                    : t `Sign in to your site` })] }), urlError && (_jsx("div", { className: "mb-6 rounded-lg bg-kumo-danger/10 border border-kumo-danger/20 p-4 text-sm text-kumo-danger", children: urlError })), _jsxs("div", { className: "bg-kumo-base border rounded-lg shadow-sm p-6", children: [method === "passkey" && !activeProvider && (_jsxs("div", { className: "space-y-6", children: [_jsx(PasskeyLogin, { optionsEndpoint: "/_emdash/api/auth/passkey/options", verifyEndpoint: "/_emdash/api/auth/passkey/verify", onSuccess: handleSuccess, buttonText: t `Sign in with Passkey` }), _jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-0 flex items-center", children: _jsx("span", { className: "w-full border-t" }) }), _jsx("div", { className: "relative flex justify-center text-xs uppercase", children: _jsx("span", { className: "bg-kumo-base px-2 text-kumo-subtle", children: t `Or continue with` }) })] }), buttonProviders.length > 0 && (_jsx("div", { className: `grid gap-3 ${buttonProviders.length === 1 ? "grid-cols-1" : "grid-cols-2"}`, children: buttonProviders.map((provider) => {
                                        const Btn = provider.LoginButton;
                                        const hasForm = !!provider.LoginForm;
                                        const selectProvider = () => setActiveProvider(provider.id);
                                        return (_jsx("div", { onClick: hasForm ? selectProvider : undefined, children: _jsx(Btn, {}) }, provider.id));
                                    }) })), _jsx(Button, { variant: "ghost", className: "w-full justify-center", type: "button", onClick: () => setMethod("magic-link"), children: t `Sign in with email link` })] })), method === "passkey" &&
                            activeProvider &&
                            (() => {
                                const provider = authProviderList.find((p) => p.id === activeProvider);
                                if (!provider?.LoginForm)
                                    return null;
                                const Form = provider.LoginForm;
                                return (_jsxs("div", { className: "space-y-4", children: [_jsx(Form, {}), _jsx(Button, { type: "button", variant: "ghost", className: "w-full justify-center", onClick: () => setActiveProvider(null), children: t `Back to login` })] }));
                            })(), method === "magic-link" && _jsx(MagicLinkForm, { onBack: () => setMethod("passkey") })] }), _jsx("p", { className: "text-center mt-6 text-sm text-kumo-subtle", children: method === "magic-link"
                        ? t `We'll send you a link to sign in without a password.`
                        : activeProvider
                            ? t `Enter your handle to sign in.`
                            : t `Use your registered passkey to sign in securely.` }), authInfo?.signupEnabled && (_jsx("p", { className: "text-center mt-4 text-sm text-kumo-subtle", children: _jsxs(Trans, { children: ["Don't have an account?", " ", _jsx(Link, { to: "/signup", className: "text-kumo-link hover:underline font-medium", children: "Sign up" })] }) })), SUPPORTED_LOCALES.length > 1 && (_jsx("div", { className: "mt-6 flex justify-center", children: _jsx(Select, { "aria-label": t `Language`, className: "w-48", value: locale, onValueChange: (v) => v && setLocale(v), items: Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l.code, l.label])) }) }))] }) }));
}
