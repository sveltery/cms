import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { InputGroup } from "@cloudflare/kumo";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { cn } from "../lib/utils.js";
export function TableToolbar({ children, trailing, className }) {
    return (_jsxs("div", { className: cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between", className), children: [_jsx("div", { className: "flex min-w-0 flex-1 flex-wrap items-center gap-2", children: children }), trailing && _jsx("div", { className: "flex shrink-0 flex-wrap items-center gap-2", children: trailing })] }));
}
export function TableToolbarSearch({ value, onChange, placeholder, "aria-label": ariaLabel, size = "sm", maxLength, className, inputRef, }) {
    return (_jsxs(InputGroup, { size: size, className: cn("w-full min-w-0 sm:w-64 sm:flex-none", className), children: [_jsx(InputGroup.Addon, { children: _jsx(MagnifyingGlass, { className: "h-4 w-4", "aria-hidden": "true" }) }), _jsx(InputGroup.Input, { ref: inputRef, type: "search", placeholder: placeholder, "aria-label": ariaLabel, value: value, onChange: onChange, maxLength: maxLength })] }));
}
