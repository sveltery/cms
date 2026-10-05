<script lang="ts">
 // The complete immutable Source test provides this exact React child mock.
 // Only framework mounting changes; callbacks and props are passed without value transformations.
 import {onMount} from 'svelte';
 import * as React from 'react';
 import {createRoot,type Root} from 'react-dom/client';
 import {MediaImageCropper} from './media-panel-cropper-reference';
 import type {MediaImageCropperProps} from '../../src/lib/media/MediaImageCropper.svelte';
 let props:MediaImageCropperProps=$props(),target:HTMLDivElement,root:Root|undefined;
 onMount(()=>{root=createRoot(target);root.render(React.createElement(MediaImageCropper,{...props}));return()=>{root?.unmount();root=undefined;};});
 $effect(()=>{const current={...props};root?.render(React.createElement(MediaImageCropper,current));});
</script>
<div bind:this={target}></div>
