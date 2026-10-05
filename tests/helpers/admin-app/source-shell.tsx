// Uniform Source React-to-Svelte fixture transport. Original Shell mocks/body
// are retained; the actual Native WorkspaceShell owns all rendered behavior.
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { flushSync, mount, unmount } from 'svelte';
import NativeHost from './SourceShellHost.svelte';
import { useCurrentUser } from '../dashboard-welcome/source-current-user';
export function Shell({ children }: React.PropsWithChildren<{ manifest: unknown }>) {
  const target = React.useRef<HTMLDivElement>(null), queryClient = useQueryClient();
  const { data: user } = useCurrentUser() as { data?: unknown };
  queryClient.setQueryData(['currentUser'], user);
  React.useLayoutEffect(() => {
    const instance = flushSync(() => mount(NativeHost, { target: target.current!, props: { queryClient } }));
    return () => { void unmount(instance); };
  }, [queryClient, user]);
  // Shell's Source callbacks supply the same literal page fixture. No Source
  // assertion inspects child identity; full trusted React composition is open.
  void children;
  return React.createElement('div', { ref: target });
}
