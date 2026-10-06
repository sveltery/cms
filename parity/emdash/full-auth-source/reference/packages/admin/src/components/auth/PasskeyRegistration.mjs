import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * PasskeyRegistration - WebAuthn credential registration component
 *
 * Handles the passkey registration flow:
 * 1. Fetches registration options from server
 * 2. Triggers browser's WebAuthn credential creation
 * 3. Sends attestation back to server for verification
 *
 * Used in:
 * - Setup wizard (first admin creation)
 * - User settings (adding additional passkeys)
 */
import { Button, Input, LinkButton, Loader } from "@cloudflare/kumo";
import { useLingui } from "@lingui/react/macro";
import { DeviceMobile, Fingerprint, Info, Key, ShieldCheck, Usb, WindowsLogo, } from "@phosphor-icons/react";
import * as React from "react";
import { apiFetch, parseApiResponse } from "../../lib/api/client";
import { detectPasskeyPlatform, getPasskeyClientCapabilities, isPasskeyEnvironmentUsable, isWebAuthnSecureContext, } from "../../lib/webauthn-environment";
import { InsecurePasskeyContextMessage } from "./PasskeyContextMessage.js";
// ============================================================================
// Constants
// ============================================================================
const BASE64URL_DASH_REGEX = /-/g;
const BASE64URL_UNDERSCORE_REGEX = /_/g;
const BASE64_PLUS_REGEX = /\+/g;
const BASE64_SLASH_REGEX = /\//g;
const EMPTY_DATA = {};
/**
 * Convert base64url to ArrayBuffer
 */
function base64urlToBuffer(base64url) {
    const base64 = base64url
        .replace(BASE64URL_DASH_REGEX, "+")
        .replace(BASE64URL_UNDERSCORE_REGEX, "/");
    const padding = "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(base64 + padding);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
/**
 * Convert ArrayBuffer to base64url (with padding for @oslojs/encoding compatibility)
 */
function bufferToBase64url(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    // Convert to base64url but keep padding (required by @oslojs/encoding)
    return base64.replace(BASE64_PLUS_REGEX, "-").replace(BASE64_SLASH_REGEX, "_");
}
function usePlatformCopy(platform) {
    const { t } = useLingui();
    switch (platform) {
        case "windows":
            return {
                name: t `the Windows passkey prompt`,
                unlock: t `Choose Windows Hello or another available credential manager, then confirm with your PIN, fingerprint, or face.`,
                storage: t `Windows will show which credential manager will save it before creating it.`,
                icon: _jsx(WindowsLogo, { className: "h-5 w-5" }),
            };
        case "macos":
            return {
                name: t `the macOS passkey prompt`,
                unlock: t `Choose Touch ID or another available credential manager, then confirm with your fingerprint or Mac password.`,
                storage: t `Your credential manager, such as iCloud Keychain, saves it and may sync it to your other devices.`,
                icon: _jsx(Fingerprint, { className: "h-5 w-5" }),
            };
        case "ios":
            return {
                name: t `your device's passkey prompt`,
                unlock: t `Confirm with Face ID, Touch ID, or your device passcode.`,
                storage: t `Your credential manager, such as iCloud Keychain, saves it and may sync it to your other devices.`,
                icon: _jsx(DeviceMobile, { className: "h-5 w-5" }),
            };
        case "android":
            return {
                name: t `the Android passkey prompt`,
                unlock: t `Confirm with your fingerprint, face, or PIN.`,
                storage: t `Your credential manager, such as Google Password Manager, saves it and may sync it to your other devices.`,
                icon: _jsx(DeviceMobile, { className: "h-5 w-5" }),
            };
        default:
            return {
                name: t `your device's passkey prompt`,
                unlock: t `Confirm using the secure prompt from your device or credential manager.`,
                storage: t `Your device's credential manager saves it and will show you where before creating it.`,
                icon: _jsx(ShieldCheck, { className: "h-5 w-5" }),
            };
    }
}
function PasskeyIntroduction({ storage }) {
    const { t } = useLingui();
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-kumo-brand/10 text-kumo-link", children: _jsx(Key, { className: "h-7 w-7" }) }), _jsx("h3", { className: "text-lg font-semibold", children: t `With a passkey, you don’t need to remember complex passwords` })] }), _jsxs("div", { className: "space-y-3 text-start", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-kumo-brand/10 text-kumo-link", children: _jsx(Key, { className: "h-4 w-4" }) }), _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium", children: t `What is a passkey?` }), _jsx("p", { className: "mt-1 text-sm text-kumo-subtle", children: t `An encrypted digital key you unlock using your fingerprint, face, PIN, or device password.` })] })] }), _jsxs("div", { className: "flex items-start gap-3", children: [_jsx("div", { className: "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-kumo-brand/10 text-kumo-link", children: _jsx(ShieldCheck, { className: "h-4 w-4" }) }), _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium", children: t `Where is it saved?` }), _jsx("p", { className: "mt-1 text-sm text-kumo-subtle", children: storage })] })] })] })] }));
}
/**
 * PasskeyRegistration Component
 */
export function PasskeyRegistration({ optionsEndpoint, verifyEndpoint, onSuccess, onError, buttonText, showNameInput = false, additionalData = EMPTY_DATA, showEducation = false, showSuccessStep = false, successButtonText, onSuccessReady, onBack, }) {
    const { t } = useLingui();
    const resolvedButtonText = buttonText ?? t `Register Passkey`;
    const resolvedSuccessButtonText = successButtonText ?? t `Continue`;
    const [state, setState] = React.useState({
        status: "idle",
    });
    const [passkeyName, setPasskeyName] = React.useState("");
    const [preference, setPreference] = React.useState(null);
    const [showWindowsHelloHelp, setShowWindowsHelloHelp] = React.useState(false);
    const [recheckFailed, setRecheckFailed] = React.useState(false);
    const [capabilityState, setCapabilityState] = React.useState({
        status: "checking",
    });
    // Secure context (HTTPS or http://localhost) + PublicKeyCredential
    const isSupported = React.useMemo(() => isPasskeyEnvironmentUsable(), []);
    const platform = React.useMemo(() => detectPasskeyPlatform(), []);
    const platformCopy = usePlatformCopy(platform);
    const insecureContext = React.useMemo(() => typeof window !== "undefined" && !isWebAuthnSecureContext(), []);
    const checkCapabilities = React.useCallback(async () => {
        setCapabilityState({ status: "checking" });
        const capabilities = await getPasskeyClientCapabilities();
        setCapabilityState({ status: "ready", capabilities });
        return capabilities;
    }, []);
    React.useEffect(() => {
        if (!showEducation || !isSupported)
            return;
        let active = true;
        void (async () => {
            const capabilities = await getPasskeyClientCapabilities();
            if (active)
                setCapabilityState({ status: "ready", capabilities });
        })();
        return () => {
            active = false;
        };
    }, [isSupported, showEducation]);
    const handleRegister = React.useCallback(async (selectedPreference) => {
        if (!isSupported) {
            setState({
                status: "error",
                message: t `WebAuthn is not supported in this browser`,
            });
            return;
        }
        try {
            // Step 1: Get registration options from server
            setState({ status: "loading", message: t `Preparing registration...` });
            const optionsResponse = await apiFetch(optionsEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(additionalData),
            });
            const optionsData = await parseApiResponse(optionsResponse, t `Failed to get registration options`);
            const { options } = optionsData;
            // Step 2: Create credential with browser
            setState({ status: "loading", message: t `Waiting for passkey...` });
            // Convert options to the format expected by the browser
            const publicKeyOptions = {
                challenge: base64urlToBuffer(options.challenge),
                rp: options.rp,
                user: {
                    id: base64urlToBuffer(options.user.id),
                    name: options.user.name,
                    displayName: options.user.displayName,
                },
                pubKeyCredParams: options.pubKeyCredParams,
                timeout: options.timeout,
                attestation: options.attestation,
                authenticatorSelection: options.authenticatorSelection,
                excludeCredentials: options.excludeCredentials?.map((cred) => ({
                    type: cred.type,
                    id: base64urlToBuffer(cred.id),
                    transports: cred.transports,
                })),
                hints: selectedPreference ? [selectedPreference] : options.hints,
            };
            const rawCredential = await navigator.credentials.create({
                publicKey: publicKeyOptions,
            });
            if (!rawCredential) {
                throw new Error("No credential returned from authenticator");
            }
            // Step 3: Send credential to server for verification
            setState({ status: "loading", message: t `Verifying...` });
            // navigator.credentials.create() with publicKey returns PublicKeyCredential
            const credential = rawCredential;
            const attestationResponse = credential.response;
            // authenticatorAttachment exists at runtime on PublicKeyCredential but isn't in the base type definition
            const rawAttachment = "authenticatorAttachment" in credential ? credential.authenticatorAttachment : undefined;
            const authenticatorAttachment = rawAttachment === "platform" || rawAttachment === "cross-platform"
                ? rawAttachment
                : undefined;
            const registrationResponse = {
                id: credential.id,
                rawId: bufferToBase64url(credential.rawId),
                type: "public-key",
                response: {
                    clientDataJSON: bufferToBase64url(attestationResponse.clientDataJSON),
                    attestationObject: bufferToBase64url(attestationResponse.attestationObject),
                    transports: attestationResponse.getTransports?.(),
                },
                authenticatorAttachment,
            };
            const verifyResponse = await apiFetch(verifyEndpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    credential: registrationResponse,
                    name: passkeyName || undefined,
                    ...additionalData,
                }),
            });
            const result = await parseApiResponse(verifyResponse, t `Failed to verify registration`);
            setState({ status: "success", result });
            if (showSuccessStep)
                onSuccessReady?.();
            else
                onSuccess(result);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : t `Registration failed`;
            // Handle specific WebAuthn errors
            let userMessage = message;
            if (error instanceof DOMException) {
                switch (error.name) {
                    case "NotAllowedError":
                        userMessage = t `Registration was cancelled or timed out. Please try again.`;
                        break;
                    case "InvalidStateError":
                        userMessage = t `This passkey is already registered on this device.`;
                        break;
                    case "NotSupportedError":
                        userMessage = t `Your device doesn't support the required security features.`;
                        break;
                    case "SecurityError":
                        userMessage = t `Security error. Make sure you're on a secure connection.`;
                        break;
                    default:
                        userMessage = t `Authentication error: ${error.message}`;
                }
            }
            setState({ status: "error", message: userMessage });
            onError?.(new Error(userMessage));
        }
    }, [
        isSupported,
        optionsEndpoint,
        verifyEndpoint,
        additionalData,
        passkeyName,
        onSuccess,
        onError,
        onSuccessReady,
        showSuccessStep,
        t,
    ]);
    const handleCheckAgain = React.useCallback(async () => {
        setRecheckFailed(false);
        const capabilities = await checkCapabilities();
        if (capabilities.platformAuthenticator) {
            setShowWindowsHelloHelp(false);
            setPreference("client-device");
        }
        else {
            setRecheckFailed(true);
        }
    }, [checkCapabilities]);
    // Not usable (insecure origin vs missing API — browser hides WebAuthn the same way)
    if (!isSupported) {
        return (_jsxs("div", { className: "rounded-lg border border-kumo-danger/50 bg-kumo-danger/10 p-4", children: [_jsx("h3", { className: "font-medium text-kumo-danger", children: t `Passkeys Not Available Here` }), _jsx("p", { className: "mt-1 text-sm text-kumo-subtle", children: insecureContext ? (_jsx(InsecurePasskeyContextMessage, {})) : (_jsx(_Fragment, { children: t `Your browser doesn't support passkeys. Please use a modern browser like Chrome, Safari, Firefox, or Edge.` })) })] }));
    }
    if (showEducation && capabilityState.status === "checking") {
        return (_jsxs("div", { className: "flex items-center justify-center gap-3 py-8 text-sm text-kumo-subtle", children: [_jsx(Loader, {}), t `Checking this device for passkey support...`] }));
    }
    if (showEducation && showSuccessStep && state.status === "success") {
        return (_jsxs("div", { className: "space-y-5 text-center", children: [_jsx("div", { className: "mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-kumo-success/10 text-kumo-success", children: _jsx(ShieldCheck, { className: "h-7 w-7" }) }), _jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold", children: t `Passkey created` }), _jsx("p", { className: "mt-2 text-sm text-kumo-subtle", children: t `It is stored by the authenticator or credential manager you selected in the secure system prompt.` })] }), _jsx("p", { className: "rounded-lg bg-kumo-tint p-3 text-start text-sm text-kumo-subtle", children: t `You can view, rename, or add more passkeys later in Security settings.` }), _jsx(Button, { type: "button", className: "w-full justify-center", onClick: () => onSuccess(state.result), children: resolvedSuccessButtonText })] }));
    }
    const capabilities = capabilityState.status === "ready" ? capabilityState.capabilities : null;
    const noPlatformAuthenticator = capabilities?.platformAuthenticator === false;
    if (showEducation && showWindowsHelloHelp) {
        return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "text-center", children: [_jsx("div", { className: "mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-kumo-brand/10 text-kumo-link", children: _jsx(WindowsLogo, { className: "h-7 w-7" }) }), _jsx("h3", { className: "text-lg font-semibold", children: t `Set up Windows Hello` }), _jsx("p", { className: "mt-2 text-sm text-kumo-subtle", children: t `In Windows Settings, open Accounts, then Sign-in options, and set up a PIN. Fingerprint and face recognition are optional.` })] }), _jsx(LinkButton, { href: "ms-settings:signinoptions", external: true, icon: _jsx(WindowsLogo, {}), className: "w-full justify-center", children: t `Open Windows settings` }), _jsx(Button, { type: "button", variant: "outline", className: "w-full justify-center", loading: capabilityState.status === "checking", onClick: () => void handleCheckAgain(), children: t `I've set it up — check again` }), recheckFailed && (_jsx("p", { className: "rounded-lg bg-kumo-warning/10 p-3 text-sm text-kumo-warning", children: t `Windows Hello still isn't available to this browser. You can try another device or a security key instead.` })), _jsx(Button, { type: "button", variant: "ghost", className: "w-full justify-center", onClick: () => setShowWindowsHelloHelp(false), children: t `Choose another option` })] }));
    }
    if (showEducation && noPlatformAuthenticator && preference === null) {
        return (_jsxs("div", { className: "space-y-5", children: [_jsx(PasskeyIntroduction, { storage: t `Choose a credential manager on this device, another device, or a security key.` }), _jsxs("div", { className: "flex items-start gap-3 rounded-lg bg-kumo-warning/10 p-3 text-start", children: [_jsx(Info, { className: "mt-0.5 h-5 w-5 shrink-0 text-kumo-warning" }), _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium text-kumo-warning", children: platform === "windows"
                                        ? t `No Windows Hello authenticator found`
                                        : t `No built-in passkey authenticator found` }), _jsx("p", { className: "mt-1 text-sm text-kumo-subtle", children: t `We checked before opening the browser's passkey prompt so you can choose what happens next.` })] })] }), _jsxs("div", { className: "space-y-3", children: [platform === "windows" && (_jsx(Button, { type: "button", variant: "outline", icon: _jsx(WindowsLogo, {}), className: "w-full justify-start", onClick: () => setShowWindowsHelloHelp(true), children: t `Set up Windows Hello` })), capabilities?.hybridTransport !== false && (_jsx(Button, { type: "button", variant: "outline", icon: _jsx(DeviceMobile, {}), className: "w-full justify-start", onClick: () => setPreference("hybrid"), children: t `Use another device` })), _jsx(Button, { type: "button", variant: "outline", icon: _jsx(Usb, {}), className: "w-full justify-start", onClick: () => setPreference("security-key"), children: t `Use a security key` })] }), onBack && (_jsx(Button, { type: "button", variant: "ghost", className: "w-full justify-center", onClick: onBack, children: t `Back` }))] }));
    }
    if (showEducation && preference === "hybrid") {
        return (_jsxs("div", { className: "space-y-5", children: [_jsx(PasskeyIntroduction, { storage: t `The credential manager on the phone or tablet you choose saves it. EmDash does not receive the passkey.` }), _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium", children: t `What happens next?` }), _jsxs("ol", { className: "mt-3 space-y-2 ps-5 text-sm text-kumo-subtle", children: [_jsx("li", { children: t `The browser will usually show a QR code.` }), _jsx("li", { children: t `Scan it with a nearby phone or tablet.` }), _jsx("li", { children: t `Approve with that device's face, fingerprint, PIN, or passcode.` })] })] }), _jsxs("div", { className: "flex items-start gap-3 rounded-lg bg-kumo-tint p-3 text-start", children: [_jsx(DeviceMobile, { className: "mt-0.5 h-5 w-5 shrink-0 text-kumo-link" }), _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium", children: t `Next, the browser's passkey window will open` }), _jsx("p", { className: "mt-1 text-sm text-kumo-subtle", children: t `The browser controls the exact prompt and may offer another compatible method.` })] })] }), state.status === "error" && (_jsx("div", { className: "rounded-lg bg-kumo-danger/10 p-4 text-sm text-kumo-danger", children: state.message })), _jsxs("div", { className: "flex gap-3", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setPreference(null), children: t `Back` }), _jsx(Button, { type: "button", className: "flex-1 justify-center", loading: state.status === "loading", onClick: () => void handleRegister("hybrid"), children: t `Continue with another device` })] })] }));
    }
    if (showEducation && preference === "security-key") {
        return (_jsxs("div", { className: "space-y-5", children: [_jsx(PasskeyIntroduction, { storage: t `The passkey is saved on your physical security key and can be used on compatible devices.` }), _jsxs("div", { className: "flex items-start gap-3 rounded-lg bg-kumo-tint p-3 text-start", children: [_jsx(Usb, { className: "mt-0.5 h-5 w-5 shrink-0 text-kumo-link" }), _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium", children: t `Next, the browser's passkey window will open` }), _jsx("p", { className: "mt-1 text-sm text-kumo-subtle", children: t `Insert or tap your security key when the browser asks.` })] })] }), state.status === "error" && (_jsx("div", { className: "rounded-lg bg-kumo-danger/10 p-4 text-sm text-kumo-danger", children: state.message })), _jsxs("div", { className: "flex gap-3", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => setPreference(null), children: t `Back` }), _jsx(Button, { type: "button", className: "flex-1 justify-center", loading: state.status === "loading", onClick: () => void handleRegister("security-key"), children: t `Continue with security key` })] })] }));
    }
    if (showEducation) {
        const selectedPreference = preference ?? (capabilities?.platformAuthenticator === true ? "client-device" : undefined);
        return (_jsxs("div", { className: "space-y-5", children: [_jsx(PasskeyIntroduction, { storage: platformCopy.storage }), _jsxs("div", { className: "flex items-start gap-3 rounded-lg bg-kumo-tint p-3 text-start", children: [_jsx("div", { className: "mt-0.5 shrink-0 text-kumo-link", children: platformCopy.icon }), _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-medium", children: t `Next, ${platformCopy.name} will open` }), _jsx("p", { className: "mt-1 text-sm text-kumo-subtle", children: platformCopy.unlock })] })] }), state.status === "error" && (_jsx("div", { className: "rounded-lg bg-kumo-danger/10 p-4 text-sm text-kumo-danger", children: state.message })), _jsx(Button, { type: "button", className: "w-full justify-center", loading: state.status === "loading", onClick: () => void handleRegister(selectedPreference), children: t `Create passkey` }), _jsx("p", { className: "text-center text-xs text-kumo-subtle", children: t `EmDash never receives your PIN, password, or biometric information.` }), onBack && (_jsx(Button, { type: "button", variant: "ghost", className: "w-full justify-center", onClick: onBack, children: t `Back` }))] }));
    }
    return (_jsxs("div", { className: "space-y-4", children: [showNameInput && (_jsxs("div", { children: [_jsx(Input, { label: t `Passkey Name (optional)`, type: "text", value: passkeyName, onChange: (e) => setPasskeyName(e.target.value), placeholder: t `e.g., MacBook Pro, iPhone`, disabled: state.status === "loading" }), _jsx("p", { className: "mt-1 text-xs text-kumo-subtle", children: t `Give this passkey a name to help you identify it later.` })] })), state.status === "error" && (_jsx("div", { className: "rounded-lg bg-kumo-danger/10 p-4 text-sm text-kumo-danger", children: state.message })), state.status === "success" && (_jsx("div", { className: "rounded-lg bg-kumo-success/10 p-4 text-sm text-kumo-success", children: t `Passkey registered successfully!` })), _jsx(Button, { type: "button", onClick: () => void handleRegister(), loading: state.status === "loading", className: "w-full justify-center", variant: "primary", children: state.status === "loading" ? _jsx(_Fragment, { children: state.message }) : resolvedButtonText }), _jsx("p", { className: "text-xs text-kumo-subtle text-center", children: t `You'll be prompted to use your device's biometric authentication, security key, or PIN.` })] }));
}
