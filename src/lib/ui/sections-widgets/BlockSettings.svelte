<script lang="ts">
  import type { BlockSidebarPanel } from '$lib/sections-widgets/editor.ts';
  let { panel, onClose, onDelete }: { panel: BlockSidebarPanel; onClose: () => void; onDelete: () => void } = $props();
  function text(value: unknown) { return typeof value === 'string' ? value : ''; }
  function change(key: string, value: unknown) { panel.onUpdate({ [key]: value }); }
</script>
<section class="panel"><header class="toolbar"><h2>{panel.type === 'image' ? 'Image Settings' : 'Gallery Settings'}</h2><button aria-label="Close settings" onclick={onClose}>×</button></header>
  {#if panel.type === 'image'}
    <img class="block-preview" src={text(panel.attrs.src)} alt={text(panel.attrs.alt)} />
    <label>Alt text<input value={text(panel.attrs.alt)} oninput={event => change('alt', event.currentTarget.value)} /></label>
    <label>Title<input value={text(panel.attrs.title)} oninput={event => change('title', event.currentTarget.value)} /></label>
    <label>Caption<textarea value={text(panel.attrs.caption)} oninput={event => change('caption', event.currentTarget.value)}></textarea></label>
    <label>Display width<input type="number" min="1" value={typeof panel.attrs.displayWidth === 'number' ? panel.attrs.displayWidth : undefined} oninput={event => change('displayWidth', event.currentTarget.value ? Number(event.currentTarget.value) : undefined)} /></label>
    <label>Display height<input type="number" min="1" value={typeof panel.attrs.displayHeight === 'number' ? panel.attrs.displayHeight : undefined} oninput={event => change('displayHeight', event.currentTarget.value ? Number(event.currentTarget.value) : undefined)} /></label>
    <p class="muted">Replacing or editing a media asset requires a configured media provider.</p>
  {:else}
    {#if Array.isArray(panel.attrs.images)}{#each panel.attrs.images as image}{#if image && typeof image === 'object' && 'src' in image}<img class="preview" src={text(image.src)} alt={'alt' in image ? text(image.alt) : ''} />{/if}{/each}{/if}
    <p class="muted">Gallery media selection requires a configured media provider.</p>
  {/if}
  <button onclick={onDelete}>Delete {panel.type === 'image' ? 'image' : 'gallery'}</button>
</section>
