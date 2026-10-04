// Uniform test-only JSX transport. Source callbacks retain their original
// providers, API mocks, input data, clocks, assertions and expected values.
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { i18n } from '@lingui/core';
import { flushSync, mount, unmount, type Component } from 'svelte';
import NativeManager from '../../../src/lib/taxonomies/TaxonomyManager.svelte';
import NativeSidebar from '../../../src/lib/taxonomies/TaxonomySidebar.svelte';
import { getAvailableParentTerms, replaceSiblingGroup, reorderWithinSlots } from '../../../src/lib/taxonomies/tree';
import * as taxonomyApi from '../../../parity/emdash/taxonomy-admin-ui/source/packages/admin/src/lib/api/taxonomies';
import { API_BASE, apiFetch, fetchManifest, parseApiResponse, throwResponseError } from '../../../parity/emdash/taxonomy-admin-ui/source/packages/admin/src/lib/api/client';
import Host from './ComponentHost.svelte';
import { componentProps } from './dom-props.svelte';

export { getAvailableParentTerms, replaceSiblingGroup, reorderWithinSlots };

export const sourceClient = {
  apiBase: API_BASE,
  ...taxonomyApi,
  apiFetch, fetchManifest, parseApiResponse, throwResponseError,
  async fetchEntryTerms(collection: string, entryId: string, taxonomy: string) {
    const response = await apiFetch(`/_emdash/api/content/${collection}/${entryId}/terms/${taxonomy}`);
    return parseApiResponse(response, 'Failed to fetch entry terms');
  },
  async setEntryTerms(collection: string, entryId: string, taxonomy: string, termIds: string[]) {
    const response = await apiFetch(`/_emdash/api/content/${collection}/${entryId}/terms/${taxonomy}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ termIds })
    });
    if (!response.ok) await throwResponseError(response, 'Failed to set entry terms');
  }
};

export function useNativeComponent(Component: Component<any>, props: Record<string, unknown>) {
  const target = React.useRef<HTMLDivElement>(null);
  const state = React.useMemo(() => componentProps(props), []);
  React.useLayoutEffect(() => {
    const instance = flushSync(() => mount(Host, { target: target.current!, props: { Component, state } }));
    return () => { void unmount(instance); };
  }, [Component, state]);
  React.useLayoutEffect(() => { flushSync(() => { state.current = props; }); });
  return React.createElement('div', { ref: target });
}

export function TaxonomyManager(props: { taxonomyName: string; onDeleted?: () => void }) {
  const queryClient = useQueryClient();
  return useNativeComponent(NativeManager, { ...props, client: sourceClient, queryClient, adminI18n: i18n });
}

export function TaxonomySidebar(props: {
  collection: string; entryId?: string; canManageTaxonomies: boolean;
  entryLocale?: string; defaultLocale?: string;
  onChange?: (taxonomyName: string, termIds: string[]) => void; className?: string;
}) {
  const queryClient = useQueryClient();
  return useNativeComponent(NativeSidebar, { ...props, client: sourceClient, queryClient, adminI18n: i18n });
}
