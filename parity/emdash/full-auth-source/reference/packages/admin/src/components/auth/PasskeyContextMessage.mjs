import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Trans } from "@lingui/react/macro";
export function InsecurePasskeyContextMessage() {
    return (_jsxs(Trans, { children: ["Passkeys require a ", _jsx("strong", { className: "text-kumo-default", children: "secure context" }), ": use", " ", _jsx("strong", { className: "text-kumo-default", children: "HTTPS" }), ", or open the admin at", " ", _jsx("strong", { className: "text-kumo-default", children: "http://localhost" }), " (with your dev port). Plain", " ", _jsx("code", { className: "text-xs", children: "http://" }), " on a custom hostname is not treated as secure, even on loopback."] }));
}
