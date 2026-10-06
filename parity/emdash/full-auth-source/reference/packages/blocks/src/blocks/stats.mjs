import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ArrowDown, ArrowUp, Minus } from "@phosphor-icons/react";
import { cn } from "../utils.js";
const trendConfig = {
    up: { icon: ArrowUp, color: "text-green-600" },
    down: { icon: ArrowDown, color: "text-red-600" },
    neutral: { icon: Minus, color: "text-kumo-subtle" },
};
function StatCard({ item }) {
    const trend = item.trend ? trendConfig[item.trend] : null;
    const TrendIcon = trend?.icon;
    return (_jsxs("div", { className: "flex-1 rounded-lg border border-kumo-line p-4", children: [_jsx("div", { className: "text-sm text-kumo-subtle", children: item.label }), _jsxs("div", { className: "mt-1 flex items-baseline gap-2", children: [_jsx("span", { className: "text-2xl font-bold text-kumo-default", children: item.value }), TrendIcon && (_jsx("span", { className: cn("flex items-center", trend.color), children: _jsx(TrendIcon, { size: 16 }) }))] }), item.description && _jsx("div", { className: "mt-1 text-sm text-kumo-subtle", children: item.description })] }));
}
export function StatsBlockComponent({ block }) {
    return (_jsx("div", { className: "flex gap-4", children: block.items.map((item, i) => (_jsx(StatCard, { item: item }, i))) }));
}
