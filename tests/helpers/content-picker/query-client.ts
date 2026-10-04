// Real TanStack provider matching whole Source test render.tsx, with explicit
// staleTime 0 for the original native cached-reopen fixture's refresh case.
import { QueryClient } from '@tanstack/react-query';
import type { ContentPickerClient } from '../../../src/lib/content-picker/types.ts';
const clients = new WeakMap<ContentPickerClient['fetchContentList'], QueryClient>();
export function pickerFixtureQueryClient(client: ContentPickerClient) {
  let queryClient = clients.get(client.fetchContentList);
  if (!queryClient) { queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 0 } } }); clients.set(client.fetchContentList, queryClient); }
  return queryClient;
}
