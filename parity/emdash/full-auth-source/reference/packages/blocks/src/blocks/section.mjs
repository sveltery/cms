import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { renderElement } from "../render-element.js";
export function SectionBlockComponent({ block, onAction, resolveLinkTarget, }) {
    return (_jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsx("div", { className: "flex-1 text-kumo-default", children: block.text }), block.accessory && (_jsx("div", { className: "flex-shrink-0", children: renderElement(block.accessory, onAction, undefined, resolveLinkTarget) }))] }));
}
