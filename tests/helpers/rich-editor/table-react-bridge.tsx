// Test framework mount/lifecycle transport into actual production Native widgets.
import * as React from 'react';
import { useLingui } from '@lingui/react';
import { flushSync, mount, unmount, type ComponentProps } from 'svelte';
import Host from './TableControlsHost.svelte';
import { bridgeState } from './state.svelte';
import type { Editor } from '@tiptap/core';
import type { Translate } from '../../../src/lib/editor/rich-text/types';
export { insertTable } from '../../../src/lib/editor/rich-text/insert-table';
function NativeTableControl({ state }: { state: ComponentProps<typeof Host>['state'] }) {
  const target = React.useRef<HTMLDivElement>(null);
  const live = React.useMemo(() => bridgeState(state), []);
  React.useLayoutEffect(() => { flushSync(() => Object.assign(live, state)); });
  React.useLayoutEffect(() => {
    const instance = flushSync(() => mount(Host, { target: target.current!, props: { state: live } }));
    return () => { void unmount(instance); };
  }, []);
  return <div ref={target} />;
}
export function TableSizePicker(props: { onInsert: (rows: number, columns: number, withHeaderRow: boolean) => void; onCancel: () => void }) {
  const { i18n } = useLingui();
  const translate = React.useCallback<Translate>(descriptor => i18n._(descriptor), [i18n]);
  return <NativeTableControl state={{ kind: 'picker', ...props, translate }} />;
}
export function TableSelectionAnnouncer(props: { editor: Editor; onChange: (label: string) => void }) {
  const { i18n } = useLingui();
  const translate = React.useCallback<Translate>(descriptor => i18n._(descriptor), [i18n]);
  return <NativeTableControl state={{ kind: 'announcer', ...props, translate }} />;
}
