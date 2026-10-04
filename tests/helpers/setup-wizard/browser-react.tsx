// Test-only JSX/framework bridge; baseline mounts the existing actual product.
import * as React from 'react';
import { flushSync, mount, unmount } from 'svelte';
import PasskeySetup from '../../../src/lib/ui/PasskeySetup.svelte';

export function SetupWizard() {
  const target = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const instance = flushSync(() => mount(PasskeySetup, { target: target.current! }));
    return () => { void unmount(instance); };
  }, []);
  return React.createElement('div', { ref: target });
}
