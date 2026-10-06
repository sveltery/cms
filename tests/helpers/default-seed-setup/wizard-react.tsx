// Test-only React provider transport mounts the real current Svelte setup page.
import * as React from 'react';
import { createPortal } from 'react-dom';
import { useQueryClient } from '@tanstack/react-query';
import { flushSync, mount, unmount } from 'svelte';
import Page from './current-page-host.svelte';
import { useAuthProviderList } from '../../../parity/emdash/default-seed-setup-runtime/source/packages/admin/src/lib/auth-provider-context';
import { setControlledSetupProviders } from './setup-providers.ts';
import { setControlledQueryClient } from './auth-remotes.ts';
export function SetupWizard() {
  const target = React.useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const providers = useAuthProviderList();
  const [portals, setPortals] = React.useState<Array<{ id: number; target: HTMLElement; node: React.ReactNode }>>([]);
  React.useLayoutEffect(() => {
    let alive = true;
    let nextId = 0;
    setControlledQueryClient(queryClient);
    setControlledSetupProviders(providers, (target, component, props) => {
      const id = nextId++;
      setPortals(values => [...values, { id, target, node: React.createElement(component, props) }]);
      return () => { if (alive) setPortals(values => values.filter(value => value.id !== id)); };
    });
    const instance = flushSync(() => mount(Page, { target: target.current! }));
    return () => { alive = false; void unmount(instance); };
  }, []);
  return <><div ref={target} />{portals.map(value => createPortal(value.node, value.target, String(value.id)))}</>;
}
