// ── Block Builders ───────────────────────────────────────────────────────────
function header(text, opts) {
    return {
        type: "header",
        text,
        ...(opts?.blockId !== undefined && { block_id: opts.blockId }),
    };
}
function section(text, opts) {
    return {
        type: "section",
        text,
        ...(opts?.accessory !== undefined && { accessory: opts.accessory }),
        ...(opts?.blockId !== undefined && { block_id: opts.blockId }),
    };
}
function divider(opts) {
    return {
        type: "divider",
        ...(opts?.blockId !== undefined && { block_id: opts.blockId }),
    };
}
function fieldsBlock(fields, opts) {
    return {
        type: "fields",
        fields,
        ...(opts?.blockId !== undefined && { block_id: opts.blockId }),
    };
}
function table(opts) {
    return {
        type: "table",
        columns: opts.columns,
        rows: opts.rows,
        page_action_id: opts.pageActionId,
        ...(opts.nextCursor !== undefined && { next_cursor: opts.nextCursor }),
        ...(opts.emptyText !== undefined && { empty_text: opts.emptyText }),
        ...(opts.blockId !== undefined && { block_id: opts.blockId }),
    };
}
function actionsBlock(elements, opts) {
    return {
        type: "actions",
        elements,
        ...(opts?.blockId !== undefined && { block_id: opts.blockId }),
    };
}
function stats(items, opts) {
    return {
        type: "stats",
        items,
        ...(opts?.blockId !== undefined && { block_id: opts.blockId }),
    };
}
function form(opts) {
    return {
        type: "form",
        fields: opts.fields,
        submit: { label: opts.submit.label, action_id: opts.submit.actionId },
        ...(opts.blockId !== undefined && { block_id: opts.blockId }),
    };
}
function image(opts) {
    return {
        type: "image",
        url: opts.url,
        alt: opts.alt,
        ...(opts.title !== undefined && { title: opts.title }),
        ...(opts.blockId !== undefined && { block_id: opts.blockId }),
    };
}
function context(text, opts) {
    return {
        type: "context",
        text,
        ...(opts?.blockId !== undefined && { block_id: opts.blockId }),
    };
}
function columnsBlock(columns, opts) {
    return {
        type: "columns",
        columns,
        ...(opts?.blockId !== undefined && { block_id: opts.blockId }),
    };
}
function bannerBlock(opts) {
    return {
        type: "banner",
        ...(opts.title !== undefined && { title: opts.title }),
        ...(opts.description !== undefined && { description: opts.description }),
        ...(opts.variant !== undefined && { variant: opts.variant }),
        ...(opts.blockId !== undefined && { block_id: opts.blockId }),
    };
}
// ── Element Builders ─────────────────────────────────────────────────────────
function textInput(actionId, label, opts) {
    return {
        type: "text_input",
        action_id: actionId,
        label,
        ...(opts?.placeholder !== undefined && { placeholder: opts.placeholder }),
        ...(opts?.initialValue !== undefined && {
            initial_value: opts.initialValue,
        }),
        ...(opts?.multiline !== undefined && { multiline: opts.multiline }),
    };
}
function link(label, target, opts) {
    return {
        type: "link",
        label,
        target,
        ...(opts?.appearance !== undefined && { appearance: opts.appearance }),
    };
}
function menu(actionId, label, items, opts) {
    return {
        type: "menu",
        action_id: actionId,
        label,
        items,
        ...(opts?.style !== undefined && { style: opts.style }),
    };
}
function numberInput(actionId, label, opts) {
    return {
        type: "number_input",
        action_id: actionId,
        label,
        ...(opts?.initialValue !== undefined && {
            initial_value: opts.initialValue,
        }),
        ...(opts?.min !== undefined && { min: opts.min }),
        ...(opts?.max !== undefined && { max: opts.max }),
    };
}
function select(actionId, label, options, opts) {
    return {
        type: "select",
        action_id: actionId,
        label,
        options,
        ...(opts?.initialValue !== undefined && {
            initial_value: opts.initialValue,
        }),
    };
}
function toggle(actionId, label, opts) {
    return {
        type: "toggle",
        action_id: actionId,
        label,
        ...(opts?.description !== undefined && { description: opts.description }),
        ...(opts?.initialValue !== undefined && {
            initial_value: opts.initialValue,
        }),
    };
}
function button(actionId, label, opts) {
    return {
        type: "button",
        action_id: actionId,
        label,
        ...(opts?.style !== undefined && { style: opts.style }),
        ...(opts?.value !== undefined && { value: opts.value }),
        ...(opts?.confirm !== undefined && { confirm: opts.confirm }),
    };
}
function secretInput(actionId, label, opts) {
    return {
        type: "secret_input",
        action_id: actionId,
        label,
        ...(opts?.placeholder !== undefined && { placeholder: opts.placeholder }),
        ...(opts?.hasValue !== undefined && { has_value: opts.hasValue }),
    };
}
function checkbox(actionId, label, options, opts) {
    return {
        type: "checkbox",
        action_id: actionId,
        label,
        options,
        ...(opts?.initialValue !== undefined && { initial_value: opts.initialValue }),
    };
}
function dateInput(actionId, label, opts) {
    return {
        type: "date_input",
        action_id: actionId,
        label,
        ...(opts?.initialValue !== undefined && { initial_value: opts.initialValue }),
        ...(opts?.placeholder !== undefined && { placeholder: opts.placeholder }),
    };
}
function combobox(actionId, label, options, opts) {
    return {
        type: "combobox",
        action_id: actionId,
        label,
        options,
        ...(opts?.initialValue !== undefined && { initial_value: opts.initialValue }),
        ...(opts?.placeholder !== undefined && { placeholder: opts.placeholder }),
    };
}
function radio(actionId, label, options, opts) {
    return {
        type: "radio",
        action_id: actionId,
        label,
        options,
        ...(opts?.initialValue !== undefined && { initial_value: opts.initialValue }),
    };
}
function repeater(actionId, label, fields, opts) {
    return {
        type: "repeater",
        action_id: actionId,
        label,
        fields,
        ...(opts?.itemLabel !== undefined && { item_label: opts.itemLabel }),
        ...(opts?.minItems !== undefined && { min_items: opts.minItems }),
        ...(opts?.maxItems !== undefined && { max_items: opts.maxItems }),
        ...(opts?.initialValue !== undefined && { initial_value: opts.initialValue }),
    };
}
function mediaPicker(actionId, label, opts) {
    return {
        type: "media_picker",
        action_id: actionId,
        label,
        ...(opts?.mimeTypeFilter !== undefined && { mime_type_filter: opts.mimeTypeFilter }),
        ...(opts?.initialValue !== undefined && { initial_value: opts.initialValue }),
        ...(opts?.placeholder !== undefined && { placeholder: opts.placeholder }),
    };
}
function timeseriesChart(opts) {
    return {
        type: "chart",
        config: {
            chart_type: "timeseries",
            series: opts.series,
            ...(opts.style !== undefined && { style: opts.style }),
            ...(opts.xAxisName !== undefined && { x_axis_name: opts.xAxisName }),
            ...(opts.yAxisName !== undefined && { y_axis_name: opts.yAxisName }),
            ...(opts.height !== undefined && { height: opts.height }),
            ...(opts.gradient !== undefined && { gradient: opts.gradient }),
        },
        ...(opts.blockId !== undefined && { block_id: opts.blockId }),
    };
}
function customChart(opts) {
    return {
        type: "chart",
        config: {
            chart_type: "custom",
            options: opts.options,
            ...(opts.height !== undefined && { height: opts.height }),
        },
        ...(opts.blockId !== undefined && { block_id: opts.blockId }),
    };
}
function meter(opts) {
    return {
        type: "meter",
        label: opts.label,
        value: opts.value,
        ...(opts.max !== undefined && { max: opts.max }),
        ...(opts.min !== undefined && { min: opts.min }),
        ...(opts.customValue !== undefined && { custom_value: opts.customValue }),
        ...(opts.blockId !== undefined && { block_id: opts.blockId }),
    };
}
function codeBlock(opts) {
    return {
        type: "code",
        code: opts.code,
        ...(opts.language !== undefined && { language: opts.language }),
        ...(opts.blockId !== undefined && { block_id: opts.blockId }),
    };
}
function tabBlock(panels, opts) {
    return {
        type: "tab",
        panels,
        ...(opts?.defaultTab !== undefined && { default_tab: opts.defaultTab }),
        ...(opts?.blockId !== undefined && { block_id: opts.blockId }),
    };
}
function empty(opts) {
    return {
        type: "empty",
        title: opts.title,
        ...(opts.description !== undefined && { description: opts.description }),
        ...(opts.commandLine !== undefined && { command_line: opts.commandLine }),
        ...(opts.size !== undefined && { size: opts.size }),
        ...(opts.actions !== undefined && { actions: opts.actions }),
        ...(opts.blockId !== undefined && { block_id: opts.blockId }),
    };
}
function accordion(opts) {
    return {
        type: "accordion",
        label: opts.label,
        blocks: opts.blocks,
        ...(opts.defaultOpen !== undefined && { default_open: opts.defaultOpen }),
        ...(opts.blockId !== undefined && { block_id: opts.blockId }),
    };
}
// ── Exports ──────────────────────────────────────────────────────────────────
export const blocks = {
    header,
    section,
    divider,
    fields: fieldsBlock,
    table,
    actions: actionsBlock,
    stats,
    form,
    image,
    context,
    columns: columnsBlock,
    timeseriesChart,
    customChart,
    banner: bannerBlock,
    meter,
    code: codeBlock,
    tab: tabBlock,
    empty,
    accordion,
};
export const elements = {
    textInput,
    numberInput,
    select,
    toggle,
    button,
    link,
    menu,
    secretInput,
    checkbox,
    combobox,
    dateInput,
    radio,
    repeater,
    mediaPicker,
};
