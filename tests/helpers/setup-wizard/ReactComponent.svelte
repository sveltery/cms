<!-- Test-only framework adapter: render the original Source mock component with its original callbacks. -->
<script lang="ts">
  import { onMount } from 'svelte';
  import * as React from 'react';
  import { createRoot } from 'react-dom/client';
  import { flushSync } from 'react-dom';
  let { component, componentProps = {} }: { component: React.ComponentType<any>; componentProps?: Record<string, unknown> } = $props();
  let target: HTMLDivElement;
  onMount(() => {
    const root = createRoot(target);
    flushSync(() => root.render(React.createElement(component, componentProps)));
    return () => root.unmount();
  });
</script>
<div bind:this={target}></div>
