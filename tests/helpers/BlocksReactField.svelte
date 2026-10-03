<script lang="ts">
  import {onMount} from 'svelte';
  import {createRoot,type Root} from 'react-dom/client';
  let {render,input}:any=$props();
  let target:HTMLDivElement,root=$state<Root>();
  onMount(()=>{root=createRoot(target);return()=>{root?.unmount();};});
  $effect(()=>{root?.render(render(input));});
</script>
<div bind:this={target}></div>
