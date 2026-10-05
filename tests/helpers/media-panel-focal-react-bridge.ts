/** Test-only React-to-Svelte mount transport. All widget behavior remains in the production components. */
import * as React from 'react';
import {mount,unmount,flushSync,type ComponentProps} from 'svelte';
import NativeEditor from '../../src/lib/media/FocalPointEditor.svelte';
import NativePreviews from '../../src/lib/media/FocalPointPreviews.svelte';
import {mediaPanelState} from './media-panel-state.svelte';
function bridge<C extends typeof NativeEditor|typeof NativePreviews>(component:C){
 return function NativeFocal(props:ComponentProps<C>){
  const target=React.useRef<HTMLDivElement>(null),state=React.useRef<ReturnType<typeof mediaPanelState>|null>(null);
  if(!state.current)state.current=mediaPanelState({...props});
  React.useLayoutEffect(()=>{flushSync(()=>Object.assign(state.current!,props));});
  React.useLayoutEffect(()=>{let instance:ReturnType<typeof mount>;flushSync(()=>{instance=mount(component,{target:target.current!,props:state.current as unknown as ComponentProps<C>});});return()=>{void unmount(instance!);};},[]);
  return React.createElement('div',{ref:target});
 };
}
export const FocalPointEditor=bridge(NativeEditor);
export const FocalPointPreviews=bridge(NativePreviews);
