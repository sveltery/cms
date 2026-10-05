import { QueryClient } from '@tanstack/react-query';
import type { ContentPickerClient } from './types.ts';

// Whole Source App.tsx query provider defaults, EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// TanStack Query core is re-exported by the exact already-public direct dependency.
// Class instances can share a prototype method while reading different content.
const clients = new WeakMap<ContentPickerClient, QueryClient>();
export function pickerQueryClient(client: ContentPickerClient): QueryClient {
  let queryClient = clients.get(client);
  if (!queryClient) {
    queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 1000 * 60, retry: 1 } } });
    clients.set(client, queryClient);
  }
  return queryClient;
}
