import { Fragment as _Fragment, jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
/**
 * API Tokens settings page
 *
 * Allows admins to list, create, and revoke Personal Access Tokens.
 */
import { Banner, Button, Checkbox, Input, Loader, Select, Tooltip } from "@cloudflare/kumo";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import { Copy, Eye, EyeSlash, Key, Plus, Trash } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { fetchApiTokens, createApiToken, revokeApiToken, API_TOKEN_SCOPES, } from "../../lib/api/api-tokens.js";
import { fetchPlugins } from "../../lib/api/plugins.js";
import { parseTimestamp } from "../../lib/utils.js";
import { ConfirmDialog } from "../ConfirmDialog.js";
import { SettingRow, SettingsFrame, SettingsSection } from "./SettingsLayout.js";
// =============================================================================
// Expiry options
// =============================================================================
const EXPIRY_OPTIONS = [
    { value: "none", label: msg `No expiry` },
    { value: "7d", label: msg `7 days` },
    { value: "30d", label: msg `30 days` },
    { value: "90d", label: msg `90 days` },
    { value: "365d", label: msg `1 year` },
];
export const API_TOKEN_SCOPE_VALUES = [
    {
        scope: API_TOKEN_SCOPES.ContentRead,
        label: msg `Content Read`,
        description: msg `Read content entries`,
    },
    {
        scope: API_TOKEN_SCOPES.ContentWrite,
        label: msg `Content Write`,
        description: msg `Create, update, delete content`,
    },
    {
        scope: API_TOKEN_SCOPES.MediaRead,
        label: msg `Media Read`,
        description: msg `Read media files`,
    },
    {
        scope: API_TOKEN_SCOPES.MediaWrite,
        label: msg `Media Write`,
        description: msg `Upload and delete media`,
    },
    {
        scope: API_TOKEN_SCOPES.SchemaRead,
        label: msg `Schema Read`,
        description: msg `Read collection schemas`,
    },
    {
        scope: API_TOKEN_SCOPES.SchemaWrite,
        label: msg `Schema Write`,
        description: msg `Modify collection schemas`,
    },
    {
        scope: API_TOKEN_SCOPES.TaxonomiesManage,
        label: msg `Taxonomies Manage`,
        description: msg `Create, update, and delete taxonomy terms`,
    },
    {
        scope: API_TOKEN_SCOPES.MenusManage,
        label: msg `Menus Manage`,
        description: msg `Create, update, and delete navigation menus`,
    },
    {
        scope: API_TOKEN_SCOPES.SettingsRead,
        label: msg `Settings Read`,
        description: msg `Read site settings`,
    },
    {
        scope: API_TOKEN_SCOPES.SettingsManage,
        label: msg `Settings Manage`,
        description: msg `Update site settings`,
    },
    {
        scope: API_TOKEN_SCOPES.McpTools,
        label: msg `Plugin MCP Tools`,
        description: msg `Invoke MCP tools from all enabled plugins`,
    },
    {
        scope: API_TOKEN_SCOPES.TransferExport,
        label: msg `Site Export`,
        description: msg `Download a copy of the entire site, including drafts, media, settings, and author emails. Admin includes this; choose it instead of Admin to give an agent narrower access.`,
    },
    {
        scope: API_TOKEN_SCOPES.TransferAnalyze,
        label: msg `Site Import Analysis`,
        description: msg `Upload site packages and check whether they can be imported. Admin includes this; choose it instead of Admin to give an agent narrower access.`,
    },
    {
        scope: API_TOKEN_SCOPES.TransferExecute,
        label: msg `Site Import`,
        description: msg `Import a site package into this site while it is empty, overwriting its initial setup. Admin includes this; choose it instead of Admin to give an agent narrower access.`,
    },
    {
        scope: API_TOKEN_SCOPES.Admin,
        label: msg `Admin`,
        description: msg `Full admin access`,
    },
];
/** Wire scopes shown on the create-token form (contract-tested vs `API_TOKEN_SCOPES` and `@emdash-cms/auth`). */
export const API_TOKEN_SCOPE_FORM_SCOPES = API_TOKEN_SCOPE_VALUES.map((row) => row.scope);
function computeExpiryDate(option) {
    if (option === "none")
        return undefined;
    const days = parseInt(option, 10);
    if (Number.isNaN(days))
        return undefined;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
}
// =============================================================================
// Main component
// =============================================================================
export function ApiTokenSettings() {
    const { t, i18n } = useLingui();
    const queryClient = useQueryClient();
    const [showCreateForm, setShowCreateForm] = React.useState(false);
    const [newToken, setNewToken] = React.useState(null);
    const [tokenVisible, setTokenVisible] = React.useState(false);
    const [copied, setCopied] = React.useState(false);
    const [revokeConfirmId, setRevokeConfirmId] = React.useState(null);
    const { data: tokens, isLoading, error: loadError, } = useQuery({
        queryKey: ["api-tokens"],
        queryFn: fetchApiTokens,
    });
    const { data: plugins = [] } = useQuery({
        queryKey: ["plugins"],
        queryFn: fetchPlugins,
    });
    const createMutation = useMutation({
        mutationFn: createApiToken,
        onSuccess: (result) => {
            setNewToken(result);
            setShowCreateForm(false);
            setTokenVisible(false);
            setCopied(false);
            void queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
        },
    });
    const revokeMutation = useMutation({
        mutationFn: revokeApiToken,
        onSuccess: () => {
            setRevokeConfirmId(null);
            void queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
        },
    });
    const copyTimeoutRef = React.useRef(undefined);
    React.useEffect(() => {
        return () => {
            if (copyTimeoutRef.current)
                clearTimeout(copyTimeoutRef.current);
        };
    }, []);
    const handleCopyToken = async () => {
        if (!newToken)
            return;
        try {
            await navigator.clipboard.writeText(newToken.token);
            setCopied(true);
            copyTimeoutRef.current = setTimeout(setCopied, 2000, false);
        }
        catch {
            // Clipboard API can fail in insecure contexts or when denied
        }
    };
    const expirySelectItems = React.useMemo(() => Object.fromEntries(EXPIRY_OPTIONS.map((o) => [o.value, t(o.label)])), [t]);
    const tokenToRevoke = tokens?.find((token) => token.id === revokeConfirmId);
    const revokeDescription = tokenToRevoke ? (_jsxs(_Fragment, { children: [t(msg `Revoke token`), ": ", tokenToRevoke.name] })) : (t(msg `Revoke token`));
    const title = t `API Tokens`;
    const description = t `Create personal access tokens for programmatic API access`;
    if (isLoading) {
        return (_jsx(SettingsFrame, { title: title, description: description, children: _jsxs("div", { className: "flex items-center gap-2 rounded-xl border border-kumo-line bg-kumo-base px-4 py-4 text-sm text-kumo-subtle", role: "status", children: [_jsx(Loader, { size: "sm" }), _jsx("span", { children: t `Loading...` })] }) }));
    }
    if (loadError && tokens === undefined) {
        return (_jsx(SettingsFrame, { title: title, description: description, children: _jsx(Banner, { variant: "error", title: t `An error occurred`, description: loadError instanceof Error ? loadError.message : t `An error occurred`, role: "alert" }) }));
    }
    return (_jsxs(SettingsFrame, { title: title, description: description, children: [_jsxs("div", { className: "grid gap-8", children: [_jsxs(SettingsSection, { title: t(msg `Create New Token`), description: t `Create personal access tokens for programmatic API access`, actions: showCreateForm ? (_jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowCreateForm(false), children: t `Cancel` })) : (_jsx(Button, { icon: _jsx(Plus, {}), onClick: () => setShowCreateForm(true), children: t(msg `Create Token`) })), children: [newToken && (_jsx(SettingRow, { className: "bg-kumo-success-tint", children: _jsxs("div", { className: "grid gap-4", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("span", { className: "flex h-5 shrink-0 items-center text-kumo-success", "aria-hidden": "true", children: _jsx(Key, { className: "h-5 w-5" }) }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-sm font-medium text-kumo-success", children: t `Token created: ${newToken.info.name}` }), _jsx("p", { className: "mt-0.5 text-sm leading-5 text-kumo-subtle", children: t `Copy this token now — it won't be shown again.` })] }), _jsx(Button, { variant: "ghost", size: "sm", className: "shrink-0", onClick: () => setNewToken(null), children: t `Dismiss` })] }), _jsxs("div", { className: "flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:ps-8", children: [_jsx("code", { className: "flex min-h-10 min-w-0 flex-1 select-all items-center overflow-hidden break-all rounded border border-kumo-line bg-kumo-base px-3 py-2 font-mono text-[0.9em] leading-5", children: tokenVisible ? newToken.token : "••••••••••••••••••••••••••••" }), _jsxs("div", { className: "flex shrink-0 items-center gap-1 self-end sm:self-auto", children: [_jsx(Tooltip, { content: tokenVisible ? t `Hide token` : t `Show token`, render: _jsx(Button, { variant: "ghost", shape: "square", size: "sm", onClick: () => setTokenVisible(!tokenVisible), "aria-label": tokenVisible ? t `Hide token` : t `Show token`, icon: tokenVisible ? _jsx(EyeSlash, {}) : _jsx(Eye, {}) }) }), _jsx(Tooltip, { content: t `Copy token`, render: _jsx(Button, { variant: "ghost", shape: "square", size: "sm", onClick: handleCopyToken, "aria-label": t `Copy token`, icon: _jsx(Copy, {}) }) })] })] }), copied && (_jsx("p", { className: "text-sm text-kumo-success sm:ps-8", role: "status", children: t `Copied to clipboard` }))] }) })), showCreateForm ? (_jsx(SettingRow, { children: _jsx(CreateTokenForm, { expirySelectItems: expirySelectItems, isCreating: createMutation.isPending, error: createMutation.error?.message ?? null, pluginScopes: plugins
                                        .filter((plugin) => (plugin.mcpTools?.length ?? 0) > 0)
                                        .map((plugin) => ({ scope: `mcp:tools:${plugin.id}`, name: plugin.name })), onSubmit: (input) => createMutation.mutate(input) }) })) : (!newToken && (_jsx(SettingRow, { className: "text-sm leading-5 text-kumo-subtle", children: t `Create personal access tokens for programmatic API access` })))] }), _jsx(SettingsSection, { title: t `API Tokens`, contentClassName: tokens && tokens.length > 0 ? undefined : "border-2 border-dashed border-kumo-subtle/60", children: tokens && tokens.length > 0 ? (tokens.map((token) => (_jsx(SettingRow, { children: _jsxs("div", { className: "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", children: [_jsxs("div", { className: "min-w-0 flex-1", children: [_jsxs("div", { className: "flex min-w-0 flex-wrap items-center gap-2", children: [_jsx("span", { className: "truncate text-sm font-medium", children: token.name }), _jsxs("code", { className: "rounded bg-kumo-tint px-1.5 py-0.5 font-mono text-[0.9em] text-kumo-subtle", children: [token.prefix, "..."] })] }), _jsxs("dl", { className: "mt-2 grid gap-1 text-sm leading-5", children: [_jsxs("div", { className: "flex min-w-0 flex-col gap-0.5 sm:flex-row sm:gap-2", children: [_jsx("dt", { className: "shrink-0 font-medium", children: t(msg `Scopes`) }), _jsx("dd", { className: "min-w-0 break-words text-kumo-subtle", children: token.scopes.join(", ") })] }), _jsxs("div", { className: "flex flex-wrap gap-x-4 gap-y-1 text-kumo-subtle", children: [_jsxs("div", { className: "flex gap-1.5", children: [_jsx("dt", { children: t `Created` }), _jsx("dd", { className: "tabular-nums", children: i18n.date(parseTimestamp(token.createdAt), { dateStyle: "medium" }) })] }), token.expiresAt && (_jsxs("div", { className: "flex gap-1.5", children: [_jsx("dt", { children: t(msg `Expiry`) }), _jsx("dd", { className: "tabular-nums", children: i18n.date(new Date(token.expiresAt), { dateStyle: "medium" }) })] })), token.lastUsedAt && (_jsxs("div", { className: "flex gap-1.5", children: [_jsx("dt", { children: t `Last used` }), _jsx("dd", { className: "tabular-nums", children: i18n.date(new Date(token.lastUsedAt), { dateStyle: "medium" }) })] }))] })] })] }), _jsx("div", { className: "flex shrink-0 justify-end", children: _jsx(Button, { variant: "ghost", size: "sm", icon: _jsx(Trash, {}), className: "text-kumo-danger", onClick: () => {
                                                revokeMutation.reset();
                                                setRevokeConfirmId(token.id);
                                            }, "aria-label": t `Revoke token ${token.name}`, children: t(msg `Revoke token`) }) })] }) }, token.id)))) : (_jsx(SettingRow, { className: "py-8 text-center text-sm text-kumo-subtle", children: t `No API tokens yet. Create one to get started.` })) })] }), _jsx(ConfirmDialog, { open: revokeConfirmId !== null, onClose: () => {
                    setRevokeConfirmId(null);
                    revokeMutation.reset();
                }, title: t(msg `Revoke?`), description: revokeDescription, confirmLabel: t(msg `Confirm`), pendingLabel: t(msg `Revoking...`), isPending: revokeMutation.isPending, error: revokeMutation.error, onConfirm: () => revokeConfirmId && revokeMutation.mutate(revokeConfirmId) })] }));
}
function CreateTokenForm({ expirySelectItems, isCreating, error, pluginScopes, onSubmit, }) {
    const { t } = useLingui();
    const [name, setName] = React.useState("");
    const [selectedScopes, setSelectedScopes] = React.useState(new Set());
    const [expiry, setExpiry] = React.useState("30d");
    const toggleScope = (scope) => {
        setSelectedScopes((prev) => {
            const next = new Set(prev);
            if (next.has(scope)) {
                next.delete(scope);
            }
            else {
                next.add(scope);
            }
            return next;
        });
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit({
            name: name.trim(),
            scopes: [...selectedScopes],
            expiresAt: computeExpiryDate(expiry),
        });
    };
    const isValid = name.trim().length > 0 && selectedScopes.size > 0;
    return (_jsxs("div", { className: "grid gap-4", children: [error && (_jsx(Banner, { variant: "error", title: t `An error occurred`, description: error, role: "alert" })), _jsxs("form", { onSubmit: handleSubmit, className: "grid gap-4", children: [_jsx(Input, { label: t(msg `Token Name`), value: name, onChange: (e) => setName(e.target.value), placeholder: t(msg `e.g., CI/CD Pipeline`), required: true, autoFocus: true }), _jsxs("div", { className: "grid gap-2", children: [_jsx("div", { className: "text-sm font-medium", children: t(msg `Scopes`) }), _jsxs("div", { className: "grid gap-3", children: [API_TOKEN_SCOPE_VALUES.map(({ scope, label, description }) => {
                                        return (_jsxs("label", { className: "flex cursor-pointer items-start gap-2", children: [_jsx(Checkbox, { checked: selectedScopes.has(scope), onCheckedChange: () => toggleScope(scope), "aria-label": t(label) }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-sm font-medium", children: t(label) }), _jsx("div", { className: "text-sm leading-5 text-kumo-subtle", children: t(description) })] })] }, scope));
                                    }), pluginScopes.map((plugin) => (_jsxs("label", { className: "flex cursor-pointer items-start gap-2", children: [_jsx(Checkbox, { checked: selectedScopes.has(plugin.scope), onCheckedChange: () => toggleScope(plugin.scope), "aria-label": t `Plugin tools: ${plugin.name}` }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-sm font-medium", children: t `Plugin tools: ${plugin.name}` }), _jsx("div", { className: "text-sm leading-5 text-kumo-subtle", children: t `Invoke only this plugin's enabled MCP tools` })] })] }, plugin.scope)))] })] }), _jsx(Select, { label: t(msg `Expiry`), value: expiry, onValueChange: (v) => v !== null && setExpiry(v), items: expirySelectItems, children: EXPIRY_OPTIONS.map((option) => (_jsx(Select.Option, { value: option.value, children: t(option.label) }, option.value))) }), _jsx("div", { className: "flex flex-wrap gap-2 pt-2", children: _jsx(Button, { type: "submit", disabled: !isValid || isCreating, children: isCreating ? t(msg `Creating...`) : t(msg `Create Token`) }) })] })] }));
}
