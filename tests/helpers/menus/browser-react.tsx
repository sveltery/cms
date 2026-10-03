// Test-only JSX transport mounts the actual production Svelte menu controls.
import * as React from 'react';
import { flushSync, mount, unmount } from 'svelte';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import List from '../../../src/lib/menus/MenuList.svelte';
import Editor from '../../../src/lib/menus/MenuEditor.svelte';
import * as api from '../../../src/lib/menus/client.ts';

export const Toasty = ({ children }: React.PropsWithChildren) => React.createElement(React.Fragment, null, children);
function transport(Component: typeof List | typeof Editor, props: object) {
  const target = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const instance = flushSync(() => mount(Component as typeof List, { target: target.current!, props }));
    return () => { void unmount(instance); };
  }, []);
  return React.createElement('div', { ref: target });
}
export function MenuList() { const navigate = useNavigate(); return transport(List, { client: api, navigate: (url: string) => navigate({ to: url }) }); }
export function MenuEditor() {
  const params = useParams({ strict: false }), search = useSearch({ strict: false }), navigate = useNavigate();
  return transport(Editor, { client: api, name: (params as {name?:string}).name ?? '', locale: (search as {locale?:string}).locale, navigate: (url:string) => navigate({ to: url }) });
}
