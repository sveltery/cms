import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
/**
 * Router-aware anchor styled as a Kumo button.
 *
 * Wraps TanStack Router's `Link` so it routes client-side, but matches the
 * Kumo `Button` API surface for `variant` / `size` / `shape` / `icon`. Use
 * this anywhere you'd reach for `<Link><Button>...</Button></Link>` (which
 * is invalid HTML — renders `<a><button>`).
 *
 * Inherits TanStack Router's typed `to` / `params` / `search` / `preload`
 * props by spreading them through to the underlying `<Link>`.
 *
 * @example
 * ```tsx
 * <RouterLinkButton to="/settings" variant="ghost" shape="square"
 *   aria-label={t`Back to settings`} icon={<ArrowPrev />} />
 *
 * <RouterLinkButton to="/posts/$id" params={{ id }} variant="primary">
 *   {t`Edit post`}
 * </RouterLinkButton>
 * ```
 *
 * For external links (or anything that needs `target="_blank"`), use Kumo's
 * `LinkButton` directly with `external`.
 */
import { buttonVariants } from "@cloudflare/kumo";
import { Link } from "@tanstack/react-router";
import * as React from "react";
import { cn } from "../lib/utils";
export function RouterLinkButton({ className, variant, size, shape, icon, children, ...linkProps }) {
    const iconNode = renderIcon(icon);
    return (_jsxs(Link, { ...linkProps, className: cn(buttonVariants({ variant, size, shape }), "flex items-center no-underline!", className), children: [iconNode, children] }));
}
function renderIcon(icon) {
    if (!icon)
        return null;
    if (React.isValidElement(icon))
        return icon;
    const Comp = icon;
    return _jsx(Comp, {});
}
