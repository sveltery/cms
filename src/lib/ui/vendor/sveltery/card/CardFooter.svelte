<script lang="ts">
  // Native pinned shadcn Card/Nova contract; see tests/reference/card-sources.json.
  import type { CardFooterProps } from './types.js';
  import { classes } from '../shared/classes.js';
  let { children, class: classProp, ref = $bindable(), ...props }: CardFooterProps = $props();
</script>
<div data-slot="card-footer" {...props} class={classes('cn-card-footer flex items-center', classProp)} bind:this={ref}>
  {@render children?.()}
</div>
