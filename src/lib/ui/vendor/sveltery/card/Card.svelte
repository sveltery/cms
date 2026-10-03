<script lang="ts">
  // Native pinned shadcn Card/Nova contract; see tests/reference/card-sources.json.
  import type { CardProps } from './types.js';
  import { classes } from '../shared/classes.js';
  let { children, class: classProp, ref = $bindable(), size = 'default', ...props }: CardProps = $props();
</script>
<div data-slot="card" data-size={size} {...props} class={classes('cn-card group/card flex flex-col', classProp)} bind:this={ref}>
  {@render children?.()}
</div>
