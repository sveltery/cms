import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Signup Page - Self-signup for allowed domains
 *
 * This component is NOT wrapped in the admin Shell.
 * It's a standalone public page for self-signup.
 *
 * Flow:
 * 1. Email input form
 * 2. "Check your email" confirmation
 * 3. After clicking email link: Passkey registration
 */
import { Button, Input, Loader } from "@cloudflare/kumo";
import { Trans, useLingui } from "@lingui/react/macro";
import { Link } from "@tanstack/react-router";
import * as React from "react";
import { useAdminBranding } from "../lib/admin-branding-context";
import { requestSignup, verifySignupToken } from "../lib/api";
import { PasskeyRegistration } from "./auth/PasskeyRegistration";
import { BrandLogo } from "./Logo.js";
import { RouterLinkButton } from "./RouterLinkButton.js";
export function VerificationSentMessage({ email }) {
    return (_jsxs(Trans, { children: ["We've sent a verification link to", " ", _jsx("span", { className: "font-medium text-kumo-default", children: email })] }));
}
export function SignupRoleMessage({ roleName }) {
    return (_jsxs(Trans, { children: ["You'll be signing up as ", _jsx("span", { className: "font-medium text-kumo-default", children: roleName })] }));
}
function EmailStep({ onSubmit, isLoading, error }) {
    const { t } = useLingui();
    const [email, setEmail] = React.useState("");
    const [validationError, setValidationError] = React.useState(null);
    const handleSubmit = (e) => {
        e.preventDefault();
        setValidationError(null);
        if (!email.trim()) {
            setValidationError(t `Email is required`);
            return;
        }
        if (!email.includes("@") || !email.includes(".")) {
            setValidationError(t `Please enter a valid email address`);
            return;
        }
        onSubmit(email.trim().toLowerCase());
    };
    return (_jsxs("form", { onSubmit: handleSubmit, className: "space-y-6", children: [_jsx("div", { className: "space-y-4", children: _jsxs("div", { children: [_jsx(Input, { label: t `Email address`, type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: t `you@company.com`, className: validationError ? "border-kumo-danger" : "", disabled: isLoading, autoComplete: "email", autoFocus: true }), validationError && _jsx("p", { className: "text-sm text-kumo-danger mt-1", children: validationError })] }) }), error && (_jsx("div", { className: "rounded-lg bg-kumo-danger/10 p-4 text-sm text-kumo-danger", children: error })), _jsx(Button, { type: "submit", className: "w-full", disabled: isLoading, children: isLoading ? (_jsxs(_Fragment, { children: [_jsx(Loader, { size: "sm" }), t `Sending...`] })) : (t `Continue`) }), _jsx("p", { className: "text-xs text-kumo-subtle text-center", children: t `Only email addresses from allowed domains can sign up.` })] }));
}
function CheckEmailStep({ email, onResend, isResending, resendCooldown }) {
    const { t } = useLingui();
    return (_jsxs("div", { className: "space-y-6 text-center", children: [_jsx("div", { className: "inline-flex items-center justify-center w-16 h-16 rounded-full bg-kumo-brand/10 mx-auto", children: _jsx("svg", { className: "w-8 h-8 text-kumo-link", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" }) }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold", children: t `Check your email` }), _jsx("p", { className: "text-kumo-subtle mt-2", children: _jsx(VerificationSentMessage, { email: email }) })] }), _jsxs("div", { className: "text-sm text-kumo-subtle", children: [_jsx("p", { children: t `Click the link in the email to continue setting up your account.` }), _jsx("p", { className: "mt-2", children: t `The link will expire in 15 minutes.` })] }), _jsxs("div", { className: "pt-4 border-t", children: [_jsx("p", { className: "text-sm text-kumo-subtle mb-2", children: t `Didn't receive the email?` }), _jsx(Button, { variant: "outline", size: "sm", onClick: onResend, disabled: isResending || resendCooldown > 0, children: isResending
                            ? t `Sending...`
                            : resendCooldown > 0
                                ? t `Resend in ${resendCooldown}s`
                                : t `Resend email` })] })] }));
}
function handleSignupSuccess() {
    // Redirect to admin dashboard after successful signup
    window.location.href = "/_emdash/admin";
}
function VerifyStep({ verifyResult, token, onBack: _onBack }) {
    const { t } = useLingui();
    const [name, setName] = React.useState("");
    const [passkeyComplete, setPasskeyComplete] = React.useState(false);
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "inline-flex items-center justify-center w-16 h-16 rounded-full bg-kumo-success/10 mx-auto mb-4", children: _jsx("svg", { className: "w-8 h-8 text-kumo-success", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M5 13l4 4L19 7" }) }) }), _jsx("h2", { className: "text-xl font-semibold", children: t `Email verified!` }), _jsx("p", { className: "text-kumo-subtle mt-2", children: _jsx(SignupRoleMessage, { roleName: verifyResult.roleName }) })] }), !passkeyComplete && (_jsxs(_Fragment, { children: [_jsx(Input, { label: t `Email`, value: verifyResult.email, disabled: true, className: "bg-kumo-tint" }), _jsx(Input, { label: t `Your name (optional)`, type: "text", value: name, onChange: (e) => setName(e.target.value), placeholder: t `Jane Doe`, autoComplete: "name" })] })), _jsx("div", { className: "pt-4 border-t", children: _jsx(PasskeyRegistration, { optionsEndpoint: "/_emdash/api/setup/admin", verifyEndpoint: "/_emdash/api/auth/signup/complete", onSuccess: handleSignupSuccess, additionalData: { token, name: name || undefined }, showEducation: true, showSuccessStep: true, successButtonText: t `Open the dashboard`, onSuccessReady: () => setPasskeyComplete(true) }) })] }));
}
function ErrorStep({ message, code, onRetry }) {
    const { t } = useLingui();
    return (_jsxs("div", { className: "space-y-6 text-center", children: [_jsx("div", { className: "inline-flex items-center justify-center w-16 h-16 rounded-full bg-kumo-danger/10 mx-auto", children: _jsx("svg", { className: "w-8 h-8 text-kumo-danger", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }) }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-xl font-semibold text-kumo-danger", children: code === "token_expired"
                            ? t `Link expired`
                            : code === "invalid_token"
                                ? t `Invalid link`
                                : code === "user_exists"
                                    ? t `Account exists`
                                    : t `Something went wrong` }), _jsx("p", { className: "text-kumo-subtle mt-2", children: message })] }), _jsxs("div", { className: "space-y-2", children: [code === "user_exists" ? (_jsx(RouterLinkButton, { to: "/login", className: "w-full", children: t `Sign in instead` })) : (onRetry && (_jsx(Button, { onClick: onRetry, className: "w-full", children: t `Request a new link` }))), _jsx(RouterLinkButton, { to: "/login", variant: "ghost", className: "w-full", children: t `Back to login` })] })] }));
}
// ============================================================================
// Main Component
// ============================================================================
export function SignupPage() {
    const { logo: brandLogo, siteName: brandSiteName } = useAdminBranding();
    const [step, setStep] = React.useState("email");
    const [email, setEmail] = React.useState("");
    const [error, setError] = React.useState();
    const [errorCode, setErrorCode] = React.useState();
    const [isLoading, setIsLoading] = React.useState(false);
    const [verifyResult, setVerifyResult] = React.useState(null);
    const [token, setToken] = React.useState(null);
    const [resendCooldown, setResendCooldown] = React.useState(0);
    // Check for token in URL on mount
    React.useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get("token");
        if (urlToken) {
            setToken(urlToken);
            void verifyToken(urlToken);
        }
    }, []);
    // Resend cooldown timer
    React.useEffect(() => {
        if (resendCooldown > 0) {
            const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendCooldown]);
    const verifyToken = async (tokenToVerify) => {
        setIsLoading(true);
        setError(undefined);
        setErrorCode(undefined);
        try {
            const result = await verifySignupToken(tokenToVerify);
            setVerifyResult(result);
            setStep("verify");
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
    const handleEmailSubmit = async (submittedEmail) => {
        setIsLoading(true);
        setError(undefined);
        setEmail(submittedEmail);
        try {
            await requestSignup(submittedEmail);
            setStep("check-email");
        }
        catch (err) {
            setError(err instanceof Error ? err.message : t `Failed to send verification email`);
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleResend = async () => {
        if (!email || resendCooldown > 0)
            return;
        setIsLoading(true);
        try {
            await requestSignup(email);
            setResendCooldown(60); // 60 second cooldown
        }
        catch {
            // Silently fail - don't reveal if email exists
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleRetry = () => {
        setStep("email");
        setError(undefined);
        setErrorCode(undefined);
        setToken(null);
        // Clear token from URL
        window.history.replaceState({}, "", window.location.pathname);
    };
    const { t } = useLingui();
    // Loading state for token verification
    if (isLoading && token) {
        return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-kumo-base", children: _jsxs("div", { className: "text-center", children: [_jsx(Loader, {}), _jsx("p", { className: "mt-4 text-kumo-subtle", children: t `Verifying your link...` })] }) }));
    }
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-kumo-base p-4", children: _jsxs("div", { className: "w-full max-w-md", children: [_jsxs("div", { className: "text-center mb-8", children: [_jsx(BrandLogo, { logoUrl: brandLogo, siteName: brandSiteName, className: "h-10 mx-auto mb-2" }), _jsxs("h1", { className: "text-2xl font-semibold text-kumo-default", children: [step === "email" && t `Create an account`, step === "check-email" && t `Check your email`, step === "verify" && t `Complete signup`, step === "error" && t `Oops!`] })] }), _jsxs("div", { className: "bg-kumo-base border rounded-lg shadow-sm p-6", children: [step === "email" && (_jsx(EmailStep, { onSubmit: handleEmailSubmit, isLoading: isLoading, error: error })), step === "check-email" && (_jsx(CheckEmailStep, { email: email, onResend: handleResend, isResending: isLoading, resendCooldown: resendCooldown })), step === "verify" && verifyResult && token && (_jsx(VerifyStep, { verifyResult: verifyResult, token: token, onBack: handleRetry })), step === "error" && (_jsx(ErrorStep, { message: error ?? "An unknown error occurred", code: errorCode, onRetry: handleRetry }))] }), step === "email" && (_jsxs("p", { className: "text-center mt-6 text-sm text-kumo-subtle", children: [t `Already have an account?`, " ", _jsx(Link, { to: "/login", className: "text-kumo-link hover:underline font-medium", children: t `Sign in` })] }))] }) }));
}
export default SignupPage;
