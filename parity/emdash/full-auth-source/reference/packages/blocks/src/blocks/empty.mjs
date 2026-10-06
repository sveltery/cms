import { jsx as _jsx } from "react/jsx-runtime";
import { Empty } from "@cloudflare/kumo";
import { Package } from "@phosphor-icons/react";
import { renderElement } from "../render-element.js";
export function EmptyBlockComponent({ block, onAction, resolveLinkTarget, }) {
    const contents = block.actions && block.actions.length > 0 ? (_jsx("div", { className: "flex flex-wrap justify-center gap-2", children: block.actions.map((el, i) => (_jsx("div", { children: renderElement(el, onAction, undefined, resolveLinkTarget) }, "action_id" in el ? el.action_id : i))) })) : undefined;
    return (_jsx(Empty, { icon: _jsx(Package, { size: 48, weight: "duotone" }), title: block.title, description: block.description, commandLine: block.command_line, size: block.size, contents: contents }));
}
