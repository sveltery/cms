import { jsx as _jsx } from "react/jsx-runtime";
import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { render as baseRender } from "vitest-browser-react";
const ProvidersWrapper = (InnerWrapper = React.Fragment) => {
    return ({ children }) => {
        const queryClient = React.useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }), []);
        return (_jsx(QueryClientProvider, { client: queryClient, children: _jsx(I18nProvider, { i18n: i18n, children: _jsx(InnerWrapper, { children: children }) }) }));
    };
};
export const render = (ui, { wrapper: UserWrapper, ...options } = {}) => {
    return baseRender(ui, { ...options, wrapper: ProvidersWrapper(UserWrapper) });
};
