import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * PasskeyItem - Individual passkey display with rename and delete actions
 */
import { Button, Input } from "@cloudflare/kumo";
import { useLingui } from "@lingui/react/macro";
import { Pencil, Trash, Check, X, DeviceMobile, Cloud } from "@phosphor-icons/react";
import * as React from "react";
import { formatRelativeTime } from "../../lib/utils";
import { ConfirmDialog } from "../ConfirmDialog.js";
export function PasskeyItem({ passkey, canDelete, onRename, onDelete, isDeleting, isRenaming, }) {
    const { t, i18n } = useLingui();
    const [isEditing, setIsEditing] = React.useState(false);
    const [editName, setEditName] = React.useState(passkey.name || "");
    const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
    const [deleteError, setDeleteError] = React.useState(null);
    const inputRef = React.useRef(null);
    React.useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);
    const handleSave = async () => {
        try {
            await onRename(passkey.id, editName.trim());
            setIsEditing(false);
        }
        catch {
            // Error handled by parent
        }
    };
    const handleCancel = () => {
        setEditName(passkey.name || "");
        setIsEditing(false);
    };
    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            void handleSave();
        }
        else if (e.key === "Escape") {
            handleCancel();
        }
    };
    const handleDelete = async () => {
        try {
            setDeleteError(null);
            await onDelete(passkey.id);
            setShowDeleteDialog(false);
        }
        catch (err) {
            setDeleteError(err instanceof Error ? err.message : t `Failed to remove passkey`);
        }
    };
    const deviceTypeLabel = passkey.deviceType === "multiDevice" ? t `Synced passkey` : t `Device-bound passkey`;
    return (_jsxs("li", { className: "flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [_jsx("div", { className: "mt-0.5 p-2 rounded-md bg-kumo-tint", children: passkey.deviceType === "multiDevice" ? (_jsx(Cloud, { className: "h-4 w-4 text-kumo-subtle" })) : (_jsx(DeviceMobile, { className: "h-4 w-4 text-kumo-subtle" })) }), _jsxs("div", { className: "min-w-0 flex-1", children: [isEditing ? (_jsxs("div", { className: "flex flex-col items-stretch gap-2 sm:flex-row sm:items-center", children: [_jsx(Input, { ref: inputRef, type: "text", value: editName, onChange: (e) => setEditName(e.target.value), onKeyDown: handleKeyDown, className: "h-8 w-full sm:w-48", placeholder: t `Passkey name`, "aria-label": t `Passkey name`, disabled: isRenaming }), _jsx(Button, { size: "sm", variant: "ghost", onClick: handleSave, disabled: isRenaming, "aria-label": t `Save name`, children: _jsx(Check, { className: "h-4 w-4" }) }), _jsx(Button, { size: "sm", variant: "ghost", onClick: handleCancel, disabled: isRenaming, "aria-label": t `Cancel rename`, children: _jsx(X, { className: "h-4 w-4" }) })] })) : (_jsx("div", { className: "font-medium", children: passkey.name || t `Unnamed passkey` })), _jsxs("div", { className: "text-sm text-kumo-subtle", children: [deviceTypeLabel, passkey.backedUp && _jsxs("span", { className: "text-kumo-success", children: [" ", t `(synced)`] })] }), _jsxs("div", { className: "text-xs text-kumo-subtle mt-1", children: [t `Last used`, " ", formatRelativeTime(passkey.lastUsedAt, i18n.locale)] })] })] }), !isEditing && (_jsxs("div", { className: "flex self-end items-center gap-1 sm:self-center", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => {
                            setEditName(passkey.name || "");
                            setIsEditing(true);
                        }, title: t `Rename`, "aria-label": passkey.name ? t `Rename ${passkey.name}` : t `Rename passkey`, children: _jsx(Pencil, { className: "h-4 w-4" }) }), canDelete && (_jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowDeleteDialog(true), className: "text-kumo-danger hover:text-kumo-danger", title: t `Remove`, "aria-label": passkey.name ? t `Remove ${passkey.name}` : t `Remove passkey`, children: _jsx(Trash, { className: "h-4 w-4" }) }))] })), _jsx(ConfirmDialog, { open: showDeleteDialog, onClose: () => {
                    setShowDeleteDialog(false);
                    setDeleteError(null);
                }, title: t `Remove passkey?`, description: passkey.name
                    ? t `You won't be able to use "${passkey.name}" to sign in anymore. This action cannot be undone.`
                    : t `You won't be able to use this passkey to sign in anymore. This action cannot be undone.`, confirmLabel: t `Remove`, pendingLabel: t `Removing...`, isPending: !!isDeleting, error: deleteError, onConfirm: handleDelete })] }));
}
