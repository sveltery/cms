// Test-only React provider transport mounts the real current Svelte setup page.
import * as React from 'react';
import { flushSync, mount, unmount } from 'svelte';
import Page from './current-page-host.svelte';
export function SetupWizard() {
  const target = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const instance = flushSync(() => mount(Page, { target: target.current! }));
    return () => { void unmount(instance); };
  }, []);
  return React.createElement('div', { ref: target });
}
