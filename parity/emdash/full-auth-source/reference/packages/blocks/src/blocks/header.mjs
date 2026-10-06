import { jsx as _jsx } from "react/jsx-runtime";
export function HeaderBlockComponent({ block }) {
    return _jsx("h2", { className: "text-xl font-bold text-kumo-default", children: block.text });
}
