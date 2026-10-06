import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Tabs } from "@cloudflare/kumo";
import { useState } from "react";
import { BlockRenderer } from "../renderer.js";
export function TabBlockComponent({ block, onAction, resolveLinkTarget, }) {
    const [activeTab, setActiveTab] = useState(block.default_tab ?? 0);
    const tabs = block.panels.map((panel, i) => ({ value: String(i), label: panel.label }));
    return (_jsxs("div", { children: [_jsx(Tabs, { variant: "underline", value: String(activeTab), onValueChange: (value) => setActiveTab(Number(value)), tabs: tabs }), _jsx("div", { className: "pt-4", children: _jsx(BlockRenderer, { blocks: block.panels[activeTab]?.blocks ?? [], onAction: onAction, resolveLinkTarget: resolveLinkTarget }) })] }));
}
