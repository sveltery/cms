import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Auth Provider Context
 *
 * Provides pluggable auth provider UI components (LoginButton, LoginForm, SetupStep)
 * to the admin UI via React context. Auth providers are registered in astro.config.ts
 * and their admin components are bundled via the virtual:emdash/auth-providers module.
 */
import * as React from "react";
import { createContext, useContext } from "react";
const AuthProviderContext = createContext({});
/**
 * Provider that makes auth provider components available to all descendants
 */
export function AuthProviderProvider({ children, authProviders }) {
    return (_jsx(AuthProviderContext.Provider, { value: authProviders, children: children }));
}
/**
 * Get all auth provider modules
 */
export function useAuthProviders() {
    return useContext(AuthProviderContext);
}
/**
 * Get auth providers as an ordered array (buttons first, then forms)
 */
export function useAuthProviderList() {
    const providers = useContext(AuthProviderContext);
    const list = Object.values(providers);
    // Sort: providers with only LoginButton first (compact), then those with LoginForm
    return list.toSorted((a, b) => {
        const aHasForm = a.LoginForm ? 1 : 0;
        const bHasForm = b.LoginForm ? 1 : 0;
        return aHasForm - bHasForm;
    });
}
