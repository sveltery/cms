import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Reusable confirmation dialog with inline error display.
 *
 * Handles the common pattern: title, description, optional error banner,
 * cancel/confirm buttons with pending state. Dialog stays open on error.
 */
import { Button, Dialog } from "@cloudflare/kumo";
import { useLingui } from "@lingui/react/macro";
import * as React from "react";
import { DialogError, getMutationError } from "./DialogError.js";
export function ConfirmDialog({ open, onClose, role = "dialog", title, titleClassName, description, descriptionClassName, confirmLabel, cancelLabel, pendingLabel, variant = "destructive", compact = false, preventCloseWhilePending = false, confirmDisabled = false, isPending, error, onConfirm, children, }) {
    const { t } = useLingui();
    const closeLocked = preventCloseWhilePending && isPending;
    return (_jsx(Dialog.Root, { role: role, open: open, onOpenChange: (nextOpen) => !nextOpen && !closeLocked && onClose(), disablePointerDismissal: true, children: _jsxs(Dialog, { className: compact ? "max-w-md px-5 pt-6 pb-4" : "p-6", size: "sm", children: [_jsxs("div", { className: compact ? "grid gap-1" : undefined, children: [_jsx(Dialog.Title, { dir: "auto", className: titleClassName ??
                                (compact ? "text-lg font-semibold leading-6" : "text-lg font-semibold"), children: title }), _jsx(Dialog.Description, { dir: "auto", className: descriptionClassName ??
                                (compact ? "text-sm leading-5 text-pretty text-kumo-subtle" : "text-kumo-subtle"), children: description })] }), children, _jsx(DialogError, { message: getMutationError(error), className: "mt-3" }), _jsxs("div", { className: `${compact ? "mt-5" : "mt-6"} flex justify-end gap-2`, children: [_jsx(Button, { variant: "secondary", disabled: closeLocked, onClick: onClose, children: cancelLabel ?? t `Cancel` }), _jsx(Button, { variant: variant, disabled: isPending || confirmDisabled, onClick: onConfirm, children: isPending ? pendingLabel : confirmLabel })] })] }) }));
}
