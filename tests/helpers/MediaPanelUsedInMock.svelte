<script lang="ts">
 // Original Source child mocks retain their complete factory; only framework mounting changes.
 import {onMount} from 'svelte';
 import * as React from 'react';
 import {createRoot,type Root} from 'react-dom/client';
 import {MediaUsedIn} from './media-panel-used-in-react-bridge';
 import type {ComponentProps} from 'svelte';
 import type NativeUsedIn from '../../src/lib/media/MediaUsedIn.svelte';
 let props:ComponentProps<typeof NativeUsedIn>=$props(),target:HTMLDivElement,root:Root|undefined;
 onMount(()=>{root=createRoot(target);root.render(React.createElement(MediaUsedIn,{...props}));return()=>{root?.unmount();root=undefined;};});
 $effect(()=>{const current={...props};root?.render(React.createElement(MediaUsedIn,current));});
</script>
<div bind:this={target}></div>
