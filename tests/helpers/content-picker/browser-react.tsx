// Test-only JSX transport mounts the actual production Svelte picker.
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { flushSync, mount, unmount, type ComponentProps } from 'svelte';
import Picker from '../../../src/lib/content-picker/ContentPickerModal.svelte';
import Host from './PickerHost.svelte';
import { pickerState } from './state.svelte.ts';
import * as api from '../../../src/lib/content-picker/client.ts';

export function ContentPickerModal(props: ComponentProps<typeof Picker>) {
  const queryClient = useQueryClient();
  const target = React.useRef<HTMLDivElement>(null);
  const state = React.useMemo(() => pickerState({ ...props, queryClient, client: {
    fetchCollections: () => api.fetchCollections(), fetchManifest: () => api.fetchManifest(),
    fetchContentList: (collection: string, options?: Parameters<typeof api.fetchContentList>[1]) => api.fetchContentList(collection, options)
  } }), []);
  React.useLayoutEffect(() => {
    const instance = flushSync(() => mount(Host, { target: target.current!, props: { state } }));
    return () => { void unmount(instance); };
  }, []);
  React.useLayoutEffect(() => { Object.assign(state, props); }, [props]);
  return React.createElement('div', { ref: target });
}
