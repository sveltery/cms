// Test-only React shell; the unmocked fallback mounts the actual native Svelte cropper.
import * as React from 'react';
import {mount,unmount,flushSync} from 'svelte';
import NativeCropper,{type MediaImageCropperProps} from '../../src/lib/media/MediaImageCropper.svelte';
import {mediaPanelState} from './media-panel-state.svelte';
export type {MediaImageCropperProps} from '../../src/lib/media/MediaImageCropper.svelte';
export function MediaImageCropper(props:MediaImageCropperProps){
 const target=React.useRef<HTMLDivElement>(null),state=React.useRef<ReturnType<typeof mediaPanelState>|null>(null);
 if(!state.current)state.current=mediaPanelState({...props});
 React.useLayoutEffect(()=>{flushSync(()=>Object.assign(state.current!,props));});
 React.useLayoutEffect(()=>{let instance:ReturnType<typeof mount>;flushSync(()=>{instance=mount(NativeCropper,{target:target.current!,props:state.current as unknown as MediaImageCropperProps});});return()=>{void unmount(instance!);};},[]);
 return React.createElement('div',{ref:target});
}
