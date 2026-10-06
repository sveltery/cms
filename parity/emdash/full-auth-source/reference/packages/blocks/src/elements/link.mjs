import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, LinkButton } from "@cloudflare/kumo";
export function LinkElementComponent({ element, resolveTarget, }) {
    const href = resolveTarget?.(element.target) ?? null;
    if (!href)
        return null;
    const external = element.target.kind === "external";
    if (element.appearance === "primary" || element.appearance === "secondary") {
        return (_jsx(LinkButton, { href: href, variant: element.appearance === "primary" ? "primary" : "secondary", external: external, children: element.label }));
    }
    return (_jsxs(Link, { href: href, target: external ? "_blank" : undefined, rel: external ? "noopener noreferrer" : undefined, children: [element.label, external ? _jsx(Link.ExternalIcon, { "aria-hidden": "true" }) : null] }));
}
