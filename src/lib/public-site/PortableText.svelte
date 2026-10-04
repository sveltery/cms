<script lang="ts">
  import { renderPortableText } from './portable-text.ts';
  let { value }: { value: unknown } = $props();
  const html = $derived(renderPortableText(value));
</script>
<div class="portable-text">{@html html}</div>
<style>
  .portable-text { line-height: 1.75; overflow-wrap: anywhere; }
  .portable-text :global(h1), .portable-text :global(h2), .portable-text :global(h3) { line-height: 1.2; margin-top: 1.8em; }
  .portable-text :global(blockquote) { margin-inline: 0; padding-inline: 1.2em; border-left: 3px solid #b9c6d8; }
  .portable-text :global(pre) { overflow-x: auto; padding: 1em; background: #eff3f8; border-radius: .5rem; }
  .portable-text :global(.has-text-align-center) { text-align: center; }
  .portable-text :global(.has-text-align-right) { text-align: right; }
  .portable-text :global(.has-text-align-justify) { text-align: justify; }
</style>
