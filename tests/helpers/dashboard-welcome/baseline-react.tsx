// Test-first transport mounts the exact existing Main native component. It has
// no synthetic dashboard/welcome state and does not call or replace product APIs.
import * as React from 'react';
import { flushSync, mount, unmount } from 'svelte';
import DraftPreview from '../../../src/lib/ui/DraftPreview.svelte';

function ExistingNativePreview(_props: unknown) {
  const target = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    const instance = flushSync(() => mount(DraftPreview, { target: target.current! }));
    return () => { void unmount(instance); };
  }, []);
  return React.createElement('div', { ref: target });
}
export const Dashboard = ExistingNativePreview;
export const WelcomeModal = ExistingNativePreview;
