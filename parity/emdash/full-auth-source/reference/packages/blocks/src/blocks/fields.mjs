import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function FieldsBlockComponent({ block }) {
    return (_jsx("div", { className: "grid grid-cols-2 gap-x-6 gap-y-3", children: block.fields.map((field, i) => (_jsxs("div", { children: [_jsx("div", { className: "text-sm text-kumo-subtle", children: field.label }), _jsx("div", { className: "text-kumo-default truncate", title: field.value, children: field.value })] }, i))) }));
}
