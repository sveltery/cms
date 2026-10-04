<script lang="ts">
  import type { Component } from 'svelte';
  let { Component: NativeComponent, state }: { Component: Component<any>; state: { current: Record<string, unknown> } } = $props();
</script>
<NativeComponent {...state.current} />
