<script lang="ts">
  // Native pinned shadcn Card/Nova contract; see tests/reference/card-sources.json.
  import type { CardActionProps } from './types.js';
  import { classes } from '../shared/classes.js';
  let { children, class: classProp, ref = $bindable(), ...props }: CardActionProps = $props();
</script>
<div data-slot="card-action" {...props} class={classes('cn-card-action col-start-2 row-span-2 row-start-1 self-start justify-self-end', classProp)} bind:this={ref}>
  {@render children?.()}
</div>
