<script lang="ts">
  import { onMount } from 'svelte';
  let { render }: { render: (target: HTMLElement) => () => void } = $props();
  let target: HTMLDivElement;
  onMount(() => render(target));
</script>
<div bind:this={target}></div>
