import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Badge } from "@cloudflare/kumo";
import { useLingui } from "@lingui/react/macro";
import { cn } from "../../lib/utils";
import { getRoleConfig } from "./roleDefinitions.js";
/**
 * Maps a role's semantic color name to a Kumo Badge token variant, so
 * light/dark theming comes from tokens rather than hard-coded palette classes.
 */
const ROLE_VARIANTS = {
    gray: "neutral",
    blue: "blue",
    green: "green",
    purple: "purple",
    red: "red",
};
/**
 * Role badge component built on Kumo Badge semantic variants.
 */
export function RoleBadge({ role, size = "sm", showDescription = false, className, }) {
    const { t } = useLingui();
    const config = getRoleConfig(role);
    const sizeClasses = {
        sm: "text-xs",
        md: "px-2.5 py-1 text-sm",
    };
    return (_jsx("span", { title: showDescription ? undefined : t(config.description), children: _jsxs(Badge, { variant: ROLE_VARIANTS[config.color] ?? "neutral", className: cn(sizeClasses[size], className), children: [t(config.label), showDescription && _jsxs("span", { className: "ms-1 opacity-75", children: ["- ", t(config.description)] })] }) }));
}
