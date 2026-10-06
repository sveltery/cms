import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Button, Dialog, DialogRoot } from "@cloudflare/kumo";
import { useCallback, useState } from "react";
export function ButtonElementComponent({ element, onAction, }) {
    const [confirmOpen, setConfirmOpen] = useState(false);
    const fireAction = useCallback(() => {
        onAction({
            type: "block_action",
            action_id: element.action_id,
            value: element.value,
        });
    }, [onAction, element.action_id, element.value]);
    const handleClick = useCallback(() => {
        if (element.confirm) {
            setConfirmOpen(true);
        }
        else {
            fireAction();
        }
    }, [element.confirm, fireAction]);
    const handleConfirm = useCallback(() => {
        setConfirmOpen(false);
        fireAction();
    }, [fireAction]);
    const variant = element.style === "primary"
        ? "primary"
        : element.style === "danger"
            ? "destructive"
            : "secondary";
    return (_jsxs(_Fragment, { children: [_jsx(Button, { variant: variant, onClick: handleClick, children: element.label }), element.confirm && (_jsx(DialogRoot, { open: confirmOpen, onOpenChange: setConfirmOpen, children: _jsxs(Dialog, { children: [_jsx("h3", { className: "text-lg font-semibold text-kumo-default", children: element.confirm.title }), _jsx("p", { className: "mt-1 text-sm text-kumo-subtle", children: element.confirm.text }), _jsxs("div", { className: "flex justify-end gap-2 pt-4", children: [_jsx(Button, { variant: "secondary", onClick: () => setConfirmOpen(false), children: element.confirm.deny }), _jsx(Button, { variant: element.confirm.style === "danger" ? "destructive" : "primary", onClick: handleConfirm, children: element.confirm.confirm })] })] }) }))] }));
}
