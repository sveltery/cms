import { QueryClient } from '@tanstack/react-query';
import type { ContentPickerClient } from './types.ts';

// Whole Source App.tsx query provider defaults, EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// TanStack Query core is re-exported by the exact already-public direct dependency.
// Key by the client's stable query function so Svelte state proxies share its cache.
const clients = new WeakMap<ContentPickerClient['fetchContentList'], QueryClient>();
export function pickerQueryClient(client: ContentPickerClient): QueryClient {
  let queryClient = clients.get(client.fetchContentList);
  if (!queryClient) {
    queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 1000 * 60, retry: 1 } } });
    clients.set(client.fetchContentList, queryClient);
  }
  return queryClient;
}
