import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button, Dialog, Input, Select } from "@cloudflare/kumo";
import { useLingui } from "@lingui/react/macro";
import { Check, Copy, X } from "@phosphor-icons/react";
import * as React from "react";
import { useRolesConfig } from "./useRolesConfig.js";
/**
 * Invite user modal — sends invite email or shows copy-link fallback
 */
export function InviteUserModal({ open, isSending, error, inviteUrl, onOpenChange, onInvite, }) {
    const { t } = useLingui();
    const { roles, roleLabels } = useRolesConfig();
    const [email, setEmail] = React.useState("");
    const [role, setRole] = React.useState(30); // Default to Author
    const [copied, setCopied] = React.useState(false);
    const [copyError, setCopyError] = React.useState(false);
    const copyTimeoutRef = React.useRef(undefined);
    // Reset form when modal opens
    React.useEffect(() => {
        if (open) {
            setEmail("");
            setRole(30);
            setCopied(false);
            setCopyError(false);
        }
    }, [open]);
    // Clean up timeout on unmount
    React.useEffect(() => {
        return () => {
            if (copyTimeoutRef.current)
                clearTimeout(copyTimeoutRef.current);
        };
    }, []);
    const handleSubmit = (e) => {
        e.preventDefault();
        onInvite(email, role);
    };
    const handleCopyUrl = async () => {
        if (!inviteUrl)
            return;
        try {
            await navigator.clipboard.writeText(inviteUrl);
            setCopied(true);
            setCopyError(false);
            copyTimeoutRef.current = setTimeout(setCopied, 2000, false);
        }
        catch {
            // Clipboard API can fail in insecure contexts
            setCopyError(true);
        }
    };
    return (_jsx(Dialog.Root, { open: open, onOpenChange: onOpenChange, children: _jsxs(Dialog, { className: "p-6 max-w-md", size: "lg", children: [_jsxs("div", { className: "flex items-start justify-between gap-4 mb-4", children: [_jsxs("div", { className: "flex flex-col space-y-1.5", children: [_jsx(Dialog.Title, { className: "text-lg font-semibold leading-none tracking-tight", children: inviteUrl ? t `Invite Link Created` : t `Invite User` }), _jsx(Dialog.Description, { className: "text-sm text-kumo-subtle", children: inviteUrl
                                        ? t `No email provider configured. Share this link manually.`
                                        : t `Send an invitation email to a new team member.` })] }), _jsx(Dialog.Close, { "aria-label": t `Close`, render: (props) => (_jsxs(Button, { ...props, variant: "ghost", shape: "square", "aria-label": t `Close`, className: "absolute end-4 top-4", children: [_jsx(X, { className: "h-4 w-4" }), _jsx("span", { className: "sr-only", children: t `Close` })] })) })] }), inviteUrl ? (_jsxs("div", { className: "py-4 space-y-4", children: [_jsxs("div", { className: "rounded-lg border border-kumo-warning/50 bg-kumo-warning-tint p-4", children: [_jsx("p", { className: "text-sm text-kumo-warning font-medium", children: t `Share this link with the invited user` }), _jsx("p", { className: "text-xs text-kumo-subtle mt-1", children: t `This link expires in 7 days and can only be used once.` })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("code", { className: "flex-1 rounded bg-kumo-tint px-3 py-2 text-sm font-mono border truncate", children: inviteUrl }), _jsx(Button, { variant: "ghost", shape: "square", onClick: handleCopyUrl, "aria-label": t `Copy invite link`, children: copied ? (_jsx(Check, { className: "h-4 w-4 text-kumo-success" })) : (_jsx(Copy, { className: "h-4 w-4" })) })] }), copied && _jsx("p", { className: "text-xs text-kumo-success", children: t `Copied to clipboard` }), copyError && (_jsx("p", { className: "text-xs text-kumo-warning", children: t `Could not copy automatically. Please select the URL above and copy manually.` })), _jsx("div", { className: "flex justify-end", children: _jsx(Button, { type: "button", onClick: () => onOpenChange(false), children: t `Done` }) })] })) : (_jsxs("form", { onSubmit: handleSubmit, children: [_jsxs("div", { className: "grid gap-4 py-4", children: [_jsx(Input, { label: t `Email address`, type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: t `colleague@example.com`, required: true, autoComplete: "off" }), _jsxs("div", { className: "grid gap-2", children: [_jsx(Select, { label: t `Role`, value: role.toString(), onValueChange: (v) => v !== null && setRole(parseInt(v, 10)), items: roleLabels, children: roles.map((r) => (_jsx(Select.Option, { value: r.value.toString(), children: _jsxs("div", { children: [_jsx("div", { children: r.label }), _jsx("div", { className: "text-xs text-kumo-subtle", children: r.description })] }) }, r.value))) }), _jsx("p", { className: "text-xs text-kumo-subtle", children: t `The invited user will have this role once they complete registration.` })] }), error && (_jsx("div", { className: "rounded-md bg-kumo-danger/10 p-3 text-sm text-kumo-danger", children: error }))] }), _jsxs("div", { className: "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", children: [_jsx(Button, { type: "button", variant: "outline", onClick: () => onOpenChange(false), disabled: isSending, children: t `Cancel` }), _jsx(Button, { type: "submit", disabled: isSending || !email, children: isSending ? t `Sending...` : t `Send Invite` })] })] }))] }) }));
}
