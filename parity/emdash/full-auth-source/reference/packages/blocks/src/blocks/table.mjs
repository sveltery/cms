import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Badge } from "@cloudflare/kumo";
import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import { useState } from "react";
import { renderElement } from "../render-element.js";
import { cn, formatRelativeTime } from "../utils.js";
function formatCell(value, format) {
    let str;
    if (value == null) {
        str = "";
    }
    else if (typeof value === "string") {
        str = value;
    }
    else if (typeof value === "number" || typeof value === "boolean") {
        str = String(value);
    }
    else if (typeof value === "object") {
        str = JSON.stringify(value);
    }
    else {
        str = "";
    }
    switch (format) {
        case "badge":
            return _jsx(Badge, { children: str });
        case "relative_time":
            return str ? formatRelativeTime(str) : "";
        case "number": {
            const num = Number(value);
            return Number.isNaN(num) ? str : num.toLocaleString();
        }
        case "code":
            return _jsx("code", { className: "rounded bg-kumo-tint px-1.5 py-0.5 font-mono text-sm", children: str });
        default:
            return str;
    }
}
export function TableBlockComponent({ block, onAction, resolveLinkTarget, }) {
    const [sort, setSort] = useState(null);
    function handleSort(key) {
        const next = sort?.key === key && sort.dir === "asc"
            ? { key, dir: "desc" }
            : { key, dir: "asc" };
        setSort(next);
        onAction({
            type: "block_action",
            action_id: block.page_action_id,
            block_id: block.block_id,
            value: { sort: next },
        });
    }
    function handleLoadMore() {
        onAction({
            type: "block_action",
            action_id: block.page_action_id,
            block_id: block.block_id,
            value: { cursor: block.next_cursor, sort },
        });
    }
    if (block.rows.length === 0 && block.empty_text) {
        return _jsx("p", { className: "py-4 text-center text-sm text-kumo-subtle", children: block.empty_text });
    }
    return (_jsxs("div", { className: "overflow-x-auto", children: [_jsxs("table", { className: "w-full text-start text-sm", children: [_jsx("thead", { children: _jsx("tr", { className: "border-b border-kumo-line", children: block.columns.map((col) => (_jsx("th", { className: cn("px-3 py-2 text-start text-sm font-medium text-kumo-subtle", col.sortable && "cursor-pointer select-none", col.format === "element" && "text-end"), onClick: col.sortable ? () => handleSort(col.key) : undefined, children: _jsxs("span", { className: "inline-flex items-center gap-1", children: [col.label, col.sortable &&
                                            sort?.key === col.key &&
                                            (sort.dir === "asc" ? _jsx(ArrowUp, { size: 14 }) : _jsx(ArrowDown, { size: 14 }))] }) }, col.key))) }) }), _jsx("tbody", { children: block.rows.map((row, i) => (_jsx("tr", { className: "border-b border-kumo-line last:border-0", children: block.columns.map((col) => (_jsx("td", { className: cn("px-3 py-2 text-kumo-default", col.format === "element" && "text-end"), children: col.format === "element"
                                    ? row[col.key] != null &&
                                        renderElement(row[col.key], onAction, undefined, resolveLinkTarget)
                                    : formatCell(row[col.key], col.format) }, col.key))) }, i))) })] }), block.next_cursor && (_jsx("div", { className: "mt-2 flex justify-center", children: _jsx("button", { type: "button", onClick: handleLoadMore, className: "text-sm text-kumo-link hover:underline", children: "Load more" }) }))] }));
}
