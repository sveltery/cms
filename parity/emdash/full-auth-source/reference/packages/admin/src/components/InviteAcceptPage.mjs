import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Standalone invite acceptance page (not wrapped in admin Shell).
 * Validates an invite token, then registers a passkey to complete signup.
 */
import { Input, Loader } from "@cloudflare/kumo";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react/macro";
import { useSearch } from "@tanstack/react-router";
import * as React from "react";
import { useAdminBranding } from "../lib/admin-branding-context";
import { validateInviteToken } from "../lib/api";
import { useAuthProviderList } from "../lib/auth-provider-context";
import { PasskeyRegistration } from "./auth/PasskeyRegistration";
import { BrandLogo } from "./Logo.js";
import { RouterLinkButton } from "./RouterLinkButton.js";
function handleInviteSuccess() {
    window.location.href = "/_emdash/admin";
}
function RegisterStep({ inviteData, token }) {
    const { t } = useLingui();
    const [name, setName] = React.useState("");
    const [passkeyComplete, setPasskeyComplete] = React.useState(false);
    const buttonProviders = useAuthProviderList().filter((p) => p.LoginButton);
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "inline-flex items-center justify-center w-16 h-16 rounded-full bg-kumo-brand/10 mx-auto mb-4", children: _jsx("svg", { className: "w-8 h-8 text-kumo-link", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" }) }) }), _jsx("h2", { className: "text-xl font-semibold", children: t `You've been invited!` }), _jsx("p", { className: "text-kumo-subtle mt-2", children: _jsxs(Trans, { children: ["You'll be joining as", " ", _jsx("span", { className: "font-medium text-kumo-default", children: inviteData.roleName })] }) })] }), _jsx(Input, { label: t `Email`, value: inviteData.email, disabled: true, className: "bg-kumo-tint" }), _jsx(Input, { label: t `Your name (optional)`, type: "text", value: name, onChange: (e) => setName(e.target.value), placeholder: t `Jane Doe`, autoComplete: "name", autoFocus: true }), _jsx("div", { className: "pt-4 border-t", children: _jsx(PasskeyRegistration, { optionsEndpoint: "/_emdash/api/auth/invite/register-options", verifyEndpoint: "/_emdash/api/auth/invite/complete", onSuccess: handleInviteSuccess, additionalData: { token, name: name || undefined }, showEducation: true, showSuccessStep: true, successButtonText: t `Open the dashboard`, onSuccessReady: () => setPasskeyComplete(true) }) }), !passkeyComplete && buttonProviders.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "relative", children: [_jsx("div", { className: "absolute inset-0 flex items-center", children: _jsx("span", { className: "w-full border-t" }) }), _jsx("div", { className: "relative flex justify-center text-xs uppercase", children: _jsx("span", { className: "bg-kumo-base px-2 text-kumo-subtle", children: t `Or continue with` }) })] }), _jsx("div", { className: `grid gap-3 ${buttonProviders.length === 1 ? "grid-cols-1" : "grid-cols-2"}`, children: buttonProviders.map((provider) => {
                            const Btn = provider.LoginButton;
                            return (_jsx("div", { children: _jsx(Btn, { inviteToken: token }) }, provider.id));
                        }) })] }))] }));
}
function ErrorStep({ message, code }) {
    const { t } = useLingui();
    return (_jsxs("div", { className: "space-y-6 text-center", children: [_jsx("div", { className: "inline-flex items-center justify-center w-16 h-16 rounded-full bg-kumo-danger/10 mx-auto", children: _jsx("svg", { className: "w-8 h-8 text-kumo-danger", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }) }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold text-kumo-danger", children: code === "TOKEN_EXPIRED"
                            ? t `Invite expired`
                            : code === "INVALID_TOKEN"
                                ? t `Invalid invite link`
                                : code === "USER_EXISTS"
                                    ? t `Account already exists`
                                    : t `Something went wrong` }), _jsx("p", { className: "text-kumo-subtle mt-2", children: message })] }), _jsx("div", { className: "space-y-2", children: code === "USER_EXISTS" ? (_jsx(RouterLinkButton, { to: "/login", className: "w-full", children: t `Sign in instead` })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-sm text-kumo-subtle", children: t `Please ask your administrator to send a new invite.` }), _jsx(RouterLinkButton, { to: "/login", variant: "ghost", className: "w-full", children: t `Back to login` })] })) })] }));
}
export function InviteAcceptPage() {
    const { t } = useLingui();
    const { logo: brandLogo, siteName: brandSiteName } = useAdminBranding();
    const { token: urlToken } = useSearch({ strict: false });
    const [step, setStep] = React.useState("verify");
    const [error, setError] = React.useState();
    const [errorCode, setErrorCode] = React.useState();
    const [isLoading, setIsLoading] = React.useState(true);
    const [inviteData, setInviteData] = React.useState(null);
    const [token, setToken] = React.useState(null);
    React.useEffect(() => {
        if (!urlToken) {
            setError(t `No invite token provided`);
            setStep("error");
            setIsLoading(false);
            return;
        }
        setToken(urlToken);
        void verifyToken(urlToken);
    }, [urlToken]);
    const verifyToken = async (tokenToVerify) => {
        setIsLoading(true);
        setError(undefined);
        setErrorCode(undefined);
        try {
            const result = await validateInviteToken(tokenToVerify);
            setInviteData(result);
            setStep("register");
        }
        catch (err) {
            const verifyError = err instanceof Error ? err : new Error(String(err));
            const errorWithCode = verifyError;
            setError(verifyError.message);
            setErrorCode(typeof errorWithCode.code === "string" ? errorWithCode.code : undefined);
            setStep("error");
        }
        finally {
            setIsLoading(false);
        }
    };
    if (isLoading) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-kumo-base", children: _jsxs("div", { className: "text-center", children: [_jsx(Loader, {}), _jsx("p", { className: "mt-4 text-kumo-subtle", children: t `Verifying your invite...` })] }) }));
    }
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-kumo-base p-4", children: _jsxs("div", { className: "w-full max-w-md", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx(BrandLogo, { logoUrl: brandLogo, siteName: brandSiteName, className: "h-10 mx-auto mb-2" }), _jsxs("h1", { className: "text-2xl font-semibold text-kumo-default", children: [step === "register" && t `Accept Invite`, step === "error" && t `Invite Error`] })] }), _jsxs("div", { className: "bg-kumo-base border rounded-lg shadow-sm p-6", children: [step === "register" && inviteData && token && (_jsx(RegisterStep, { inviteData: inviteData, token: token })), step === "error" && (_jsx(ErrorStep, { message: error ?? t `An unknown error occurred`, code: errorCode }))] })] }) }));
}
export default InviteAcceptPage;
