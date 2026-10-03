// Browser-only fixture mounting the actual Svelte product components. The source
// callback bodies remain immutable; renderField is fulfilled by native widgets.
import * as React from 'react';
import {mount,unmount} from 'svelte';
import NativeBlocksField from './BlocksNativeHarness.svelte';
import NativeBlockTypeList from '../../src/lib/ui/BlockTypeList.svelte';
import {bridgeState} from './blocks-bridge-state.svelte.ts';
export function native(component:any, props:Record<string,unknown>){
 const target=React.useRef<HTMLDivElement>(null);
 const state=React.useRef<ReturnType<typeof bridgeState>|null>(null);
 if(!state.current)state.current=bridgeState(props);
 React.useLayoutEffect(()=>{Object.assign(state.current!,props);});
 React.useLayoutEffect(()=>{const instance=mount(component,{target:target.current!,props:state.current!});return()=>{void unmount(instance);};},[]);
 return React.createElement('div',{ref:target});
}
export function BlocksField(props:any){return native(NativeBlocksField,{...props,onchange:props.onChange});}
export function BlockTypeList(props:any){return native(NativeBlockTypeList,props);}
