import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Admin Branding Context
 *
 * Provides the configured admin white-label branding (custom logo, site name)
 * to pre-authentication pages (LoginPage, SignupPage, InviteAcceptPage) and
 * the authenticated SPA shell alike.
 *
 * The branding is read server-side from `admin.astro` (which has direct,
 * per-request access to `Astro.locals.emdash.config.admin` — no API round
 * trip) and passed down as a prop through `AdminWrapper` -> `AdminApp`, then
 * exposed here via context. This mirrors how `authProviders` reaches the
 * same pre-auth pages, and avoids a logo flash: the branding is present in
 * the initial render, not fetched asynchronously after mount.
 */
import * as React from "react";
import { createContext, useContext } from "react";
const AdminBrandingContext = createContext({});
/**
 * Provider that makes the configured admin branding available to all
 * descendants, including pages rendered before authentication.
 */
export function AdminBrandingProvider({ children, adminBranding }) {
    return (_jsx(AdminBrandingContext.Provider, { value: adminBranding, children: children }));
}
/** Get the configured admin branding (empty object when not configured). */
export function useAdminBranding() {
    return useContext(AdminBrandingContext);
}
