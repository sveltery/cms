// Source's complete RouterProvider/TestApp wraps a real test route tree.
// This replaces only React-to-Svelte routing/mounting; the native admin root
// receives original global fetch responses and the supplied QueryClient.
import * as React from 'react';
import { createRootRoute, createRouter, createRoute } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import NativeAdmin from '../../../src/lib/taxonomies/TaxonomyAdmin.svelte';
import { sourceClient, useNativeComponent } from './source-react';

export function createAdminRouter(queryClient: QueryClient) {
  const rootRoute = createRootRoute();
  const dashboard = createRoute({ getParentRoute: () => rootRoute, path: '/', component: NativeRoot });
  const taxonomy = createRoute({ getParentRoute: () => rootRoute, path: '/taxonomies/$taxonomy', component: NativeRoot });
  const router = createRouter({ routeTree: rootRoute.addChildren([dashboard, taxonomy]) });
  function NativeRoot() {
    const location = router.state.location.pathname;
    return useNativeComponent(NativeAdmin, {
      taxonomyName: location.startsWith('/taxonomies/') ? decodeURIComponent(location.slice('/taxonomies/'.length)) : undefined,
      client: sourceClient, queryClient, adminI18n: i18n,
      onNavigate: (pathname: string) => { void router.navigate({ to: pathname }); }
    });
  }
  return router;
}
