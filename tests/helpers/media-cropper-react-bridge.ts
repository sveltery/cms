import * as React from 'react';
import {mount,unmount} from 'svelte';
import Cropper from '../../src/lib/media/MediaImageCropper.svelte';
import type {MediaImageCropperProps} from '../../src/lib/media/MediaImageCropper.svelte';
import {cropperState} from './media-cropper-state.svelte';
export type {MediaCropSelection,MediaImageCropperProps} from '../../src/lib/media/MediaImageCropper.svelte';
export function MediaImageCropper(props:MediaImageCropperProps){
 const target=React.useRef<HTMLDivElement>(null),state=React.useRef<ReturnType<typeof cropperState>|null>(null);
 if(!state.current)state.current=cropperState({...props});
 React.useLayoutEffect(()=>{Object.assign(state.current!,props);});
 React.useLayoutEffect(()=>{const instance=mount(Cropper,{target:target.current!,props:state.current as unknown as MediaImageCropperProps});return()=>{void unmount(instance);};},[]);
 return React.createElement('div',{ref:target});
}
