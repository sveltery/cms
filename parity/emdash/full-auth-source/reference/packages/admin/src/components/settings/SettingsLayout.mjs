import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "@tanstack/react-router";
import * as React from "react";
import { cn } from "../../lib/utils.js";
import { CaretNext } from "../ArrowIcons.js";
import { EditorHeader } from "../EditorHeader.js";
import { BackToSettingsLink } from "./BackToSettingsLink.js";
export function SettingsFrame({ title, description, actions, children }) {
    return (_jsxs("div", { className: "max-w-4xl pb-6", children: [_jsx(EditorHeader, { leading: _jsx("div", { className: "self-start", children: _jsx(BackToSettingsLink, {}) }), actions: actions, children: _jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-semibold leading-tight text-balance", children: title }), _jsx("p", { className: "mt-1.5 max-w-2xl text-sm leading-5 text-pretty text-kumo-subtle", children: description })] }) }), _jsx("div", { className: "mt-6", children: children })] }));
}
export function SettingsSection({ title, description, actions, contentClassName, children, }) {
    const headingId = React.useId();
    return (_jsxs("section", { "aria-labelledby": headingId, children: [_jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", children: [_jsxs("div", { className: "grid gap-1", children: [_jsx("h2", { id: headingId, className: "text-lg font-semibold leading-6 text-balance", children: title }), description && (_jsx("p", { className: "max-w-2xl text-sm leading-5 text-pretty text-kumo-subtle", children: description }))] }), actions && _jsx("div", { className: "flex shrink-0 justify-end sm:pt-0.5", children: actions })] }), _jsx("div", { className: cn("mt-3 divide-y divide-kumo-line overflow-hidden rounded-xl border border-kumo-line bg-kumo-base", contentClassName), children: children })] }));
}
export function SettingRow({ children, className }) {
    return _jsx("div", { className: cn("px-4 py-4", className), children: children });
}
export function SettingsNavRow({ to, icon, title, description }) {
    return (_jsxs(Link, { to: to, className: "flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-kumo-tint focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-kumo-brand", children: [_jsx("span", { className: "flex h-5 w-5 shrink-0 items-center justify-center text-kumo-subtle", "aria-hidden": "true", children: icon }), _jsxs("span", { className: "min-w-0 flex-1", children: [_jsx("span", { className: "block text-base font-medium leading-5", children: title }), _jsx("span", { className: "mt-0.5 block text-sm leading-5 text-pretty text-kumo-subtle", children: description })] }), _jsx(CaretNext, { className: "h-5 w-5 shrink-0 text-kumo-subtle rtl:-scale-x-100", "aria-hidden": "true" })] }));
}
