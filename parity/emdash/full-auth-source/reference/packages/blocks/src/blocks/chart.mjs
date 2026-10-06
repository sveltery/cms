import { jsx as _jsx } from "react/jsx-runtime";
import { Chart, ChartPalette, TimeseriesChart } from "@cloudflare/kumo/components/chart";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { AriaComponent, AxisPointerComponent, GridComponent, TooltipComponent, } from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { useMemo } from "react";
import { useIsDarkMode } from "../utils.js";
echarts.use([
    BarChart,
    LineChart,
    PieChart,
    AriaComponent,
    AxisPointerComponent,
    GridComponent,
    TooltipComponent,
    CanvasRenderer,
]);
// ── Security: HTML-escape untrusted strings before they reach ECharts ────────
// ECharts tooltip renders via innerHTML. Plugin-supplied names/labels must be
// escaped to prevent stored XSS in the admin dashboard.
const RE_AMP = /&/g;
const RE_LT = /</g;
const RE_GT = />/g;
const RE_QUOT = /"/g;
const RE_APOS = /'/g;
function escapeHtml(str) {
    return str
        .replace(RE_AMP, "&amp;")
        .replace(RE_LT, "&lt;")
        .replace(RE_GT, "&gt;")
        .replace(RE_QUOT, "&quot;")
        .replace(RE_APOS, "&#039;");
}
// ── Security: Sanitize custom ECharts options ────────────────────────────────
// Plugin-supplied options are passed to chart.setOption(). ECharts accepts
// formatter strings rendered via innerHTML, tooltip HTML, and graphic elements
// that can execute arbitrary code. We strip dangerous properties and force
// richText tooltip mode to eliminate HTML injection vectors.
/** Keys that accept HTML strings or executable content in ECharts options */
const DANGEROUS_KEYS = new Set(["formatter", "rich", "graphic", "axisPointer"]);
function isRecord(v) {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}
const RE_HTML_TAG = /<[a-z/!]/i;
function containsHtml(v) {
    return typeof v === "string" && RE_HTML_TAG.test(v);
}
/**
 * Deep-clone an ECharts options object, stripping properties that could
 * inject HTML or executable content. Strings containing HTML tags are
 * replaced with escaped versions.
 */
function sanitizeOptions(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        if (DANGEROUS_KEYS.has(key))
            continue;
        if (containsHtml(value)) {
            result[key] = escapeHtml(value);
        }
        else if (Array.isArray(value)) {
            result[key] = value.map((item) => isRecord(item)
                ? sanitizeOptions(item)
                : containsHtml(item)
                    ? escapeHtml(item)
                    : item);
        }
        else if (isRecord(value)) {
            result[key] = sanitizeOptions(value);
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
function TimeseriesChartBlock({ block, isDarkMode }) {
    const config = block.config;
    if (config.chart_type !== "timeseries")
        return null;
    const data = useMemo(() => config.series.map((s, i) => ({
        name: escapeHtml(s.name),
        data: s.data,
        color: s.color ?? ChartPalette.categorical(i, isDarkMode),
    })), [config.series, isDarkMode]);
    return (_jsx(TimeseriesChart, { echarts: echarts, isDarkMode: isDarkMode, type: config.style, data: data, xAxisName: config.x_axis_name ? escapeHtml(config.x_axis_name) : undefined, yAxisName: config.y_axis_name ? escapeHtml(config.y_axis_name) : undefined, height: config.height, gradient: config.gradient }));
}
function CustomChartBlock({ block, isDarkMode }) {
    const config = block.config;
    if (config.chart_type !== "custom")
        return null;
    const safeOptions = useMemo(() => {
        const sanitized = sanitizeOptions(config.options);
        // Force richText tooltip mode — renders via canvas, not innerHTML
        if (isRecord(sanitized.tooltip)) {
            sanitized.tooltip.renderMode = "richText";
        }
        else {
            sanitized.tooltip = { renderMode: "richText" };
        }
        return sanitized;
    }, [config.options]);
    return (_jsx(Chart, { echarts: echarts, isDarkMode: isDarkMode, options: safeOptions, height: config.height }));
}
export function ChartBlockComponent({ block }) {
    const isDarkMode = useIsDarkMode();
    return (_jsx("div", { className: "rounded-lg border border-kumo-line p-4", children: block.config.chart_type === "timeseries" ? (_jsx(TimeseriesChartBlock, { block: block, isDarkMode: isDarkMode })) : (_jsx(CustomChartBlock, { block: block, isDarkMode: isDarkMode })) }));
}
