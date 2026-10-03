// Whole Source render.tsx QueryClient provider, EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Native Svelte labels replace Lingui rendering; the real Source QueryClient/options stay intact.
// Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import { render as baseRender, type ComponentRenderOptions } from "vitest-browser-react";

type RenderWrapper = ComponentRenderOptions["wrapper"];

const ProvidersWrapper = (InnerWrapper: RenderWrapper = React.Fragment) => {
	return ({ children }: React.PropsWithChildren) => {
		const queryClient = React.useMemo(
			() => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
			[],
		);
		return (
			<QueryClientProvider client={queryClient}>
					<InnerWrapper>{children}</InnerWrapper>
			</QueryClientProvider>
		);
	};
};

export const render: typeof baseRender = (ui, { wrapper: UserWrapper, ...options } = {}) => {
	return baseRender(ui, { ...options, wrapper: ProvidersWrapper(UserWrapper) });
};
