// Test-only React mounting transport; the complete unchanged Source module drives the native Svelte page.
import * as React from 'react';
import {flushSync,mount,unmount} from 'svelte';
import RedirectsPanel from '../../src/lib/ui/RedirectsPanel.svelte';
export function Redirects(){
 const target=React.useRef<HTMLDivElement>(null);
 React.useLayoutEffect(()=>{const instance=flushSync(()=>mount(RedirectsPanel,{target:target.current!}));return()=>{void unmount(instance);};},[]);
 return React.createElement('div',{ref:target});
}
