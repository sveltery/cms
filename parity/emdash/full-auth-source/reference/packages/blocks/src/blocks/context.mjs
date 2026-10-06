import { jsx as _jsx } from "react/jsx-runtime";
export function ContextBlockComponent({ block }) {
    return _jsx("p", { className: "text-sm text-kumo-subtle", children: block.text });
}
