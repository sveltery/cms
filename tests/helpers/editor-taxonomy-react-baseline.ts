import * as React from 'react';
import {mount,unmount} from 'svelte';
import Sidebar from 'editor-taxonomy-baseline-ui';
/** Actual existing native UI; its mocked remote dependency has no provider/auth credit. */
export function TaxonomySidebar(props:any){
 const target=React.useRef<HTMLDivElement>(null);
 React.useLayoutEffect(()=>{const instance=mount(Sidebar,{target:target.current!,props:{collection:props.collection,id:props.entryId,locale:props.entryLocale??'en',disabled:false}});return()=>{void unmount(instance);};},[]);
 return React.createElement('div',{ref:target});
}
