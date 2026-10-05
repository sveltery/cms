// EmDash1.1.0 App.tsx query defaults and QueryClientProvider lifecycle.
// Pin913cb1bb; MIT notices/emdash-MIT.txt. Each actual Svelte page owns this
// client; no global/request-shared cache or alternate query owner is created.
import { onDestroy,onMount } from 'svelte';
import { QueryClient } from '@tanstack/react-query';

export function createCalendarQueryClient():QueryClient {
  const client=new QueryClient({defaultOptions:{queries:{staleTime:60_000,retry:1}}});
  onMount(()=>{client.mount();return()=>client.unmount();});
  onDestroy(()=>client.clear());
  return client;
}
