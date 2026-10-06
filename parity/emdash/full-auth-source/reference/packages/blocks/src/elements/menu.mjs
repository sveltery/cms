import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button, DropdownMenu } from "@cloudflare/kumo";
import { CaretDown } from "@phosphor-icons/react";
export function MenuElementComponent({ element, onAction, }) {
    return (_jsxs(DropdownMenu, { children: [_jsx(DropdownMenu.Trigger, { render: _jsxs(Button, { type: "button", variant: element.style === "primary" ? "primary" : "secondary", children: [element.label, _jsx(CaretDown, { className: "size-3.5", "aria-hidden": "true" })] }) }), _jsx(DropdownMenu.Content, { children: element.items.map((item) => (_jsx(DropdownMenu.Item, { onClick: () => onAction({ type: "block_action", action_id: element.action_id, value: item.value }), children: item.label }, item.value))) })] }));
}
