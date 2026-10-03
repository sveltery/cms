import * as React from 'react';
import {mount,unmount,flushSync} from 'svelte';
import Editor from '../../src/lib/ui/PortableTextEditor.svelte';
import Footer from '../../src/lib/ui/PortableTextFooter.svelte';
import {portableTextState} from './portable-text-state.svelte';
export * from './portable-text-pure-bridge';
export type {PluginBlockDef} from '../../src/lib/portable-text/plugin-values';
function native(component:any,props:Record<string,unknown>){
  const target=React.useRef<HTMLDivElement>(null);
  const state=React.useRef<ReturnType<typeof portableTextState>|null>(null);
  if(!state.current)state.current=portableTextState(props);
  React.useLayoutEffect(()=>{flushSync(()=>Object.assign(state.current!,props));});
  React.useLayoutEffect(()=>{let instance:ReturnType<typeof mount>;flushSync(()=>{instance=mount(component,{target:target.current!,props:state.current!});});return()=>{void unmount(instance!);};},[]);
  return React.createElement('div',{ref:target});
}
export function PortableTextEditor(props:Record<string,unknown>){return native(Editor,props);}
export function _EditorFooter(props:Record<string,unknown>){return native(Footer,props);}
