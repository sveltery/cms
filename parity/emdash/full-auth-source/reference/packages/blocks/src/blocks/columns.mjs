import { jsx as _jsx } from "react/jsx-runtime";
import { BlockRenderer } from "../renderer.js";
export function ColumnsBlockComponent({ block, onAction, resolveLinkTarget, }) {
    const colCount = Math.min(block.columns.length, 3);
    const gridClass = colCount === 2 ? "grid grid-cols-2 gap-4" : "grid grid-cols-3 gap-4";
    return (_jsx("div", { className: gridClass, children: block.columns.map((col, i) => (_jsx("div", { children: _jsx(BlockRenderer, { blocks: col, onAction: onAction, resolveLinkTarget: resolveLinkTarget }) }, i))) }));
}
