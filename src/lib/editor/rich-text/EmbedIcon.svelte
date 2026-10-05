<script lang="ts">
  import { EMBED_ICONS, type EmbedIconName } from './embed-icons.source';
  let { name, size = 14 }: { name: EmbedIconName; size?: number } = $props();
</script>
<span class="glyph" aria-hidden="true" style:width={`${size}px`} style:height={`${size}px`}>{@html EMBED_ICONS[name]}</span>
<style>
  .glyph { display: inline-flex; flex: none; width: .875rem; height: .875rem; }
  .glyph :global(svg) { width: 100%; height: 100%; }
</style>
