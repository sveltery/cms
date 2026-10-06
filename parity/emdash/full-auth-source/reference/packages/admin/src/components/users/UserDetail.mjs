import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button, Input, Select } from "@cloudflare/kumo";
import { Dialog } from "@cloudflare/kumo/primitives";
import { useLingui } from "@lingui/react/macro";
import { X, Key, Prohibit, CheckCircle, ArrowSquareOut, FloppyDisk, Envelope, } from "@phosphor-icons/react";
import * as React from "react";
import { useStableCallback } from "../../lib/hooks";
import { cn } from "../../lib/utils";
import { useRolesConfig } from "./useRolesConfig.js";
/**
 * User detail slide-over panel with inline editing
 */
export function UserDetail({ user, isLoading, isOpen, isSaving, isSendingRecovery, recoverySent, recoveryError, currentUserId, onClose, onSave, onDisable, onEnable, onSendRecovery, }) {
    const { t } = useLingui();
    const { roles, roleLabels, getRoleLabel } = useRolesConfig();
    const [name, setName] = React.useState(user?.name ?? "");
    const [email, setEmail] = React.useState(user?.email ?? "");
    const [role, setRole] = React.useState(user?.role ?? 30);
    // Reset form when viewing a different user
    const userIdRef = React.useRef(user?.id);
    if (user?.id !== userIdRef.current) {
        userIdRef.current = user?.id;
        if (user) {
            setName(user.name ?? "");
            setEmail(user.email ?? "");
            setRole(user.role);
        }
    }
    const stableOnClose = useStableCallback(onClose);
    const isSelf = user && currentUserId && user.id === currentUserId;
    const isDirty = user && (name !== (user.name ?? "") || email !== user.email || role !== user.role);
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!user)
            return;
        const data = {};
        if (name !== (user.name ?? "")) {
            data.name = name || undefined;
        }
        if (email !== user.email) {
            data.email = email;
        }
        if (role !== user.role && !isSelf) {
            data.role = role;
        }
        onSave(data);
    };
    return (_jsx(Dialog.Root, { open: isOpen, onOpenChange: (open) => !open && stableOnClose(), children: _jsxs(Dialog.Portal, { children: [_jsx(Dialog.Backdrop, { className: cn("fixed inset-0 bg-black/50 transition-opacity duration-200", "data-starting-style:opacity-0 data-ending-style:opacity-0") }), _jsxs(Dialog.Popup, { className: cn("fixed top-0 end-0 flex h-full w-full max-w-md flex-col bg-kumo-base shadow-xl outline-none", "transform transition-transform duration-200 ease-out", "data-starting-style:ltr:translate-x-full data-starting-style:rtl:-translate-x-full", "data-ending-style:ltr:translate-x-full data-ending-style:rtl:-translate-x-full"), children: [_jsxs("div", { className: "flex items-center justify-between border-b px-6 py-4", children: [_jsx(Dialog.Title, { className: "text-lg font-semibold", children: t `User Details` }), _jsx(Button, { variant: "ghost", shape: "square", onClick: stableOnClose, "aria-label": t `Close panel`, children: _jsx(X, { className: "h-5 w-5", "aria-hidden": "true" }) })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-6", children: isLoading ? (_jsx(UserDetailSkeleton, {})) : user ? (_jsxs("form", { id: "user-edit-form", onSubmit: handleSubmit, className: "space-y-6", children: [_jsxs("div", { className: "flex items-start gap-4", children: [user.avatarUrl ? (_jsx("img", { src: user.avatarUrl, alt: "", className: "h-16 w-16 shrink-0 rounded-full object-cover" })) : (_jsx("div", { className: "h-16 w-16 shrink-0 rounded-full bg-kumo-tint flex items-center justify-center text-2xl font-medium", children: (name || email)?.[0]?.toUpperCase() ?? "?" })), _jsxs("div", { className: "flex-1 min-w-0 space-y-3", children: [_jsx(Input, { label: t `Name`, value: name, onChange: (e) => setName(e.target.value), placeholder: t `Enter name` }), _jsx(Input, { label: t `Email`, type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: t `Enter email`, required: true })] })] }), _jsxs("div", { className: "flex items-end gap-3", children: [isSelf ? (_jsxs("div", { className: "flex-1", children: [_jsx(Input, { label: t `Role`, value: getRoleLabel(role), disabled: true, className: "cursor-not-allowed" }), _jsx("p", { className: "text-xs text-kumo-subtle mt-1", children: t `You cannot change your own role` })] })) : (_jsx("div", { className: "flex-1", children: _jsx(Select, { label: t `Role`, value: role.toString(), onValueChange: (v) => v !== null && setRole(parseInt(v, 10)), items: roleLabels, children: roles.map((r) => (_jsx(Select.Option, { value: r.value.toString(), children: _jsxs("div", { children: [_jsx("div", { children: r.label }), _jsx("div", { className: "text-xs text-kumo-subtle", children: r.description })] }) }, r.value))) }) })), _jsx("div", { className: "pb-1", children: user.disabled ? (_jsxs("span", { className: "inline-flex items-center gap-1 text-sm text-kumo-danger", children: [_jsx(Prohibit, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), t `Disabled`] })) : (_jsxs("span", { className: "inline-flex items-center gap-1 text-sm text-kumo-success", children: [_jsx(CheckCircle, { className: "h-3.5 w-3.5", "aria-hidden": "true" }), t `Active`] })) })] }), _jsxs("div", { className: "grid gap-4", children: [_jsxs("div", { className: "rounded-lg border bg-kumo-base p-4", children: [_jsx("h4", { className: "text-sm font-medium text-kumo-subtle mb-3", children: t `Account Info` }), _jsxs("div", { className: "space-y-2 text-sm", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-kumo-subtle", children: t `Created` }), _jsx("span", { children: new Date(user.createdAt).toLocaleDateString() })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-kumo-subtle", children: t `Last updated` }), _jsx("span", { children: new Date(user.updatedAt).toLocaleDateString() })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-kumo-subtle", children: t `Last login` }), _jsx("span", { children: user.lastLogin
                                                                            ? new Date(user.lastLogin).toLocaleDateString()
                                                                            : t `Never` })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { className: "text-kumo-subtle", children: t `Email verified` }), _jsx("span", { children: user.emailVerified ? t `Yes` : t `No` })] })] })] }), _jsxs("div", { className: "rounded-lg border bg-kumo-base p-4", children: [_jsxs("h4", { className: "text-sm font-medium text-kumo-subtle mb-3 flex items-center gap-2", children: [_jsx(Key, { className: "h-4 w-4", "aria-hidden": "true" }), t `Passkeys (${user.credentials.length})`] }), user.credentials.length === 0 ? (_jsx("p", { className: "text-sm text-kumo-subtle", children: t `No passkeys registered` })) : (_jsx("div", { className: "space-y-2", children: user.credentials.map((cred) => (_jsxs("div", { className: "flex justify-between text-sm", children: [_jsxs("div", { children: [_jsx("div", { children: cred.name || t `Unnamed passkey` }), _jsx("div", { className: "text-xs text-kumo-subtle", children: cred.deviceType === "multiDevice" ? t `Synced` : t `Device-bound` })] }), _jsxs("div", { className: "text-end text-kumo-subtle", children: [_jsx("div", { children: t `Created ${new Date(cred.createdAt).toLocaleDateString()}` }), _jsx("div", { className: "text-xs", children: t `Last used ${new Date(cred.lastUsedAt).toLocaleDateString()}` })] })] }, cred.id))) }))] }), user.oauthAccounts.length > 0 && (_jsxs("div", { className: "rounded-lg border bg-kumo-base p-4", children: [_jsxs("h4", { className: "text-sm font-medium text-kumo-subtle mb-3 flex items-center gap-2", children: [_jsx(ArrowSquareOut, { className: "h-4 w-4", "aria-hidden": "true" }), t `Linked Accounts (${user.oauthAccounts.length})`] }), _jsx("div", { className: "space-y-2", children: user.oauthAccounts.map((account, i) => (_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "capitalize", children: account.provider }), _jsx("span", { className: "text-kumo-subtle", children: t `Connected ${new Date(account.createdAt).toLocaleDateString()}` })] }, `${account.provider}-${i}`))) })] }))] })] })) : (_jsx("div", { className: "text-center text-kumo-subtle py-8", children: t `User not found` })) }), user && (_jsxs("div", { className: "border-t px-6 py-4 space-y-2", children: [_jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { type: "submit", form: "user-edit-form", className: "flex-1", disabled: !isDirty || isSaving, icon: _jsx(FloppyDisk, {}), children: isSaving ? t `Saving...` : t `Save Changes` }), !isSelf && (_jsx(Button, { variant: user.disabled ? "outline" : "destructive", onClick: user.disabled ? onEnable : onDisable, icon: user.disabled ? _jsx(CheckCircle, {}) : _jsx(Prohibit, {}), children: user.disabled ? t `Enable` : t `Disable` }))] }), !isSelf && onSendRecovery && (_jsxs("div", { className: "space-y-1", children: [_jsx(Button, { variant: "outline", className: "w-full", onClick: onSendRecovery, disabled: isSendingRecovery, icon: _jsx(Envelope, {}), children: isSendingRecovery ? t `Sending...` : t `Send Recovery Link` }), recoverySent && (_jsx("p", { className: "text-xs text-kumo-success text-center", children: t `Recovery link sent to ${user.email}` })), recoveryError && (_jsx("p", { className: "text-xs text-kumo-danger text-center", children: recoveryError }))] }))] }))] })] }) }));
}
/** Loading skeleton for user detail */
function UserDetailSkeleton() {
    return (_jsxs("div", { className: "space-y-6 animate-pulse", children: [_jsxs("div", { className: "flex items-start gap-4", children: [_jsx("div", { className: "h-16 w-16 rounded-full bg-kumo-tint" }), _jsxs("div", { className: "flex-1 space-y-2", children: [_jsx("div", { className: "h-6 w-48 bg-kumo-tint rounded" }), _jsx("div", { className: "h-4 w-36 bg-kumo-tint rounded" }), _jsx("div", { className: "h-5 w-24 bg-kumo-tint rounded" })] })] }), Array.from({ length: 2 }, (_, i) => (_jsxs("div", { className: "rounded-lg border bg-kumo-base p-4 space-y-3", children: [_jsx("div", { className: "h-4 w-24 bg-kumo-tint rounded" }), _jsxs("div", { className: "space-y-2", children: [_jsx("div", { className: "h-4 w-full bg-kumo-tint rounded" }), _jsx("div", { className: "h-4 w-full bg-kumo-tint rounded" }), _jsx("div", { className: "h-4 w-3/4 bg-kumo-tint rounded" })] })] }, i)))] }));
}
