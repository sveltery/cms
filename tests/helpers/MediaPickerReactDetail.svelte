<script lang="ts">
 import {onMount} from 'svelte';
 import {createRoot} from 'react-dom/client';
 import {createElement} from 'react';
 import {MediaDetailPanel} from './media-picker-detail-react';
 let {options}:{options:Record<string,unknown>}=$props();
 let target:HTMLDivElement;
 onMount(()=>{const root=createRoot(target);root.render(createElement(MediaDetailPanel,options));return()=>root.unmount();});
</script>
<div bind:this={target}></div>
