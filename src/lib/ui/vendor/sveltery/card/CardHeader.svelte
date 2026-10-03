<script lang="ts">
  // Native pinned shadcn Card/Nova contract; see tests/reference/card-sources.json.
  import type { CardHeaderProps } from './types.js';
  import { classes } from '../shared/classes.js';
  let { children, class: classProp, ref = $bindable(), ...props }: CardHeaderProps = $props();
</script>
<div data-slot="card-header" {...props} class={classes('cn-card-header group/card-header @container/card-header grid auto-rows-min items-start has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]', classProp)} bind:this={ref}>
  {@render children?.()}
</div>
