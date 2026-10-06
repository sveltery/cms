import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Collapsible } from "@cloudflare/kumo";
import { useState } from "react";
import { BlockRenderer } from "../renderer.js";
export function AccordionBlockComponent({ block, onAction, resolveLinkTarget, }) {
    const [open, setOpen] = useState(block.default_open ?? false);
    return (_jsxs(Collapsible.Root, { open: open, onOpenChange: setOpen, "data-testid": "collapsible", "data-open": open, children: [_jsx(Collapsible.DefaultTrigger, { children: block.label }), _jsx(Collapsible.DefaultPanel, { children: _jsx(BlockRenderer, { blocks: block.blocks, onAction: onAction, resolveLinkTarget: resolveLinkTarget }) })] }));
}
