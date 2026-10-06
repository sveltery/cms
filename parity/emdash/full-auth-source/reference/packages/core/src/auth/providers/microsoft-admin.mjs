import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Microsoft OAuth Admin Components
 *
 * LoginButton for the login page, rendered via the auth provider virtual module.
 */
import { LinkButton } from "@cloudflare/kumo";
import * as React from "react";
function MicrosoftIcon({ className }) {
    return (_jsxs("svg", { className: className, viewBox: "0 0 24 24", children: [_jsx("path", { fill: "#F25022", d: "M1 1h10.5v10.5H1z" }), _jsx("path", { fill: "#7FBA00", d: "M12.5 1H23v10.5H12.5z" }), _jsx("path", { fill: "#00A4EF", d: "M1 12.5h10.5V23H1z" }), _jsx("path", { fill: "#FFB900", d: "M12.5 12.5H23V23H12.5z" })] }));
}
export function LoginButton({ inviteToken } = {}) {
    const href = inviteToken
        ? `/_emdash/api/auth/oauth/microsoft?invite=${encodeURIComponent(inviteToken)}`
        : "/_emdash/api/auth/oauth/microsoft";
    return (_jsxs(LinkButton, { href: href, variant: "outline", className: "w-full justify-center", children: [_jsx(MicrosoftIcon, { className: "h-5 w-5" }), _jsx("span", { children: "Microsoft" })] }));
}
