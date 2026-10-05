// Uniform Source React-to-Svelte fixture transport. Original Shell mocks/body
// are retained; the actual Native WorkspaceShell owns all rendered behavior.
import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { renderToStaticMarkup } from 'react-dom/server';
import NativeHost from './SourceShellHost.svelte';
import { useCurrentUser } from '../dashboard-welcome/source-current-user';
export function Shell({ children }: React.PropsWithChildren<{ manifest: unknown }>) {
  const target = React.useRef<HTMLDivElement>(null), queryClient = useQueryClient();
  const { data: user } = useCurrentUser() as { data?: unknown };
  queryClient.setQueryData(['currentUser'], user);
  React.useLayoutEffect(() => {
    const instance = flushSync(() => mount(NativeHost, { target: target.current!, props: { queryClient, content: createRawSnippet(() => ({ render: () => renderToStaticMarkup(children) })) } }));
    return () => { void unmount(instance); };
  }, [queryClient, user, children]);
  // The complete Source fixtures contain static React children. Their actual
  // markup is forwarded; eventful trusted React plugin composition stays open.
  return React.createElement('div', { ref: target });
}
