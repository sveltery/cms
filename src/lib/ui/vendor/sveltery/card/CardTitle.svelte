<script lang="ts">
  // Native pinned shadcn Card/Nova contract; see tests/reference/card-sources.json.
  import type { CardTitleProps } from './types.js';
  import { classes } from '../shared/classes.js';
  let { children, class: classProp, ref = $bindable(), ...props }: CardTitleProps = $props();
</script>
<div data-slot="card-title" {...props} class={classes('cn-card-title cn-font-heading', classProp)} bind:this={ref}>
  {@render children?.()}
</div>
