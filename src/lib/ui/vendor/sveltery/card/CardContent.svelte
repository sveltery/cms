<script lang="ts">
  // Native pinned shadcn Card/Nova contract; see tests/reference/card-sources.json.
  import type { CardContentProps } from './types.js';
  import { classes } from '../shared/classes.js';
  let { children, class: classProp, ref = $bindable(), ...props }: CardContentProps = $props();
</script>
<div data-slot="card-content" {...props} class={classes('cn-card-content', classProp)} bind:this={ref}>
  {@render children?.()}
</div>
