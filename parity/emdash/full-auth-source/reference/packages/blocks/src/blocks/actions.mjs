import { jsx as _jsx } from "react/jsx-runtime";
import { renderElement } from "../render-element.js";
export function ActionsBlockComponent({ block, onAction, resolveLinkTarget, }) {
    return (_jsx("div", { className: "flex flex-wrap gap-2", children: block.elements.map((el, i) => (_jsx("div", { children: renderElement(el, onAction, undefined, resolveLinkTarget) }, "action_id" in el ? el.action_id : i))) }));
}
