import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Security Settings page - Passkey management
 *
 * Only available when using passkey auth. When external auth (e.g., Cloudflare Access)
 * is configured, this page shows an informational message instead.
 */
import { Banner, Button, Loader, useKumoToastManager } from "@cloudflare/kumo";
import { useLingui } from "@lingui/react/macro";
import { Plus } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { deletePasskey, fetchManifest, fetchPasskeys, renamePasskey } from "../../lib/api";
import { PasskeyRegistration } from "../auth/PasskeyRegistration.js";
import { PasskeyList } from "./PasskeyList.js";
import { SettingRow, SettingsFrame, SettingsSection } from "./SettingsLayout.js";
export function SecuritySettings() {
    const { t } = useLingui();
    const queryClient = useQueryClient();
    const toastManager = useKumoToastManager();
    const [isAdding, setIsAdding] = React.useState(false);
    const { data: manifest, isLoading: manifestLoading } = useQuery({
        queryKey: ["manifest"],
        queryFn: fetchManifest,
    });
    const isExternalAuth = manifest?.authMode && manifest.authMode !== "passkey";
    const { data: passkeys, isLoading, error, } = useQuery({
        queryKey: ["passkeys"],
        queryFn: fetchPasskeys,
        enabled: !isExternalAuth && !manifestLoading,
    });
    const renameMutation = useMutation({
        mutationFn: ({ id, name }) => renamePasskey(id, name),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
            toastManager.add({ title: t `Passkey renamed`, variant: "success", timeout: 3000 });
        },
        onError: (mutationError) => {
            toastManager.add({
                title: t `Failed to rename passkey`,
                description: mutationError instanceof Error ? mutationError.message : t `An error occurred`,
                variant: "error",
                timeout: 3000,
            });
        },
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => deletePasskey(id),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
            toastManager.add({ title: t `Passkey removed`, variant: "success", timeout: 3000 });
        },
        onError: (mutationError) => {
            toastManager.add({
                title: t `Failed to remove passkey`,
                description: mutationError instanceof Error ? mutationError.message : t `An error occurred`,
                variant: "error",
                timeout: 3000,
            });
        },
    });
    const handleRename = async (id, name) => {
        await renameMutation.mutateAsync({ id, name });
    };
    const handleDelete = async (id) => {
        await deleteMutation.mutateAsync(id);
    };
    const handleAddSuccess = () => {
        void queryClient.invalidateQueries({ queryKey: ["passkeys"] });
        setIsAdding(false);
        toastManager.add({ title: t `Passkey added successfully`, variant: "success", timeout: 3000 });
    };
    const title = t `Security Settings`;
    const description = t `Manage your passkeys and authentication`;
    if (manifestLoading || isLoading) {
        return (_jsx(SettingsFrame, { title: title, description: description, children: _jsxs("div", { className: "flex items-center gap-2 rounded-xl border border-kumo-line bg-kumo-base px-4 py-4 text-sm text-kumo-subtle", role: "status", children: [_jsx(Loader, { size: "sm" }), _jsx("span", { children: t `Loading...` })] }) }));
    }
    if (isExternalAuth) {
        return (_jsx(SettingsFrame, { title: title, description: description, children: _jsx(Banner, { variant: "secondary", title: t `Security Settings`, description: t `Authentication is managed by an external provider (${manifest?.authMode}). Passkey settings are not available when using external authentication.`, role: "status" }) }));
    }
    if (error) {
        return (_jsx(SettingsFrame, { title: title, description: description, children: _jsx(Banner, { variant: "error", title: t `Failed to load passkeys`, description: error instanceof Error ? error.message : t `An error occurred`, role: "alert" }) }));
    }
    return (_jsx(SettingsFrame, { title: title, description: description, children: _jsxs("div", { className: "grid gap-8", children: [_jsx(SettingsSection, { title: t `Passkeys`, description: t `Passkeys are a secure, passwordless way to sign in to your account. You can register multiple passkeys for different devices.`, contentClassName: passkeys && passkeys.length > 0
                        ? undefined
                        : "border-2 border-dashed border-kumo-subtle/60", children: _jsx(SettingRow, { className: "p-0", children: passkeys && passkeys.length > 0 ? (_jsx(PasskeyList, { passkeys: passkeys, onRename: handleRename, onDelete: handleDelete, isDeleting: deleteMutation.isPending, isRenaming: renameMutation.isPending })) : (_jsx("div", { className: "px-4 py-8 text-center text-sm text-kumo-subtle", children: t `No passkeys registered yet.` })) }) }), _jsx(SettingsSection, { title: t `Add a new passkey`, children: _jsx(SettingRow, { children: isAdding ? (_jsxs("div", { className: "grid gap-4", children: [_jsx("div", { className: "flex justify-end", children: _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setIsAdding(false), children: t `Cancel` }) }), _jsx(PasskeyRegistration, { optionsEndpoint: "/_emdash/api/auth/passkey/register/options", verifyEndpoint: "/_emdash/api/auth/passkey/register/verify", onSuccess: handleAddSuccess, onError: (registrationError) => toastManager.add({
                                        title: t `Failed to add passkey`,
                                        description: registrationError.message,
                                        variant: "error",
                                        timeout: 3000,
                                    }), showNameInput: true, buttonText: t `Register Passkey` })] })) : (_jsx(Button, { onClick: () => setIsAdding(true), icon: _jsx(Plus, {}), children: t `Add Passkey` })) }) })] }) }));
}
export default SecuritySettings;
