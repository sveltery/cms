<script lang="ts">
  import { onMount } from 'svelte';
  import { iframeAllow, type IframeEmbed } from '../portable-text/iframe-embed';
  let { embed, url }: { embed: IframeEmbed; url: URL } = $props();
  const SANDBOX = ['allow-scripts', 'allow-same-origin', 'allow-forms', 'allow-popups', 'allow-popups-to-escape-sandbox', 'allow-presentation'];
  let container: HTMLDivElement;
  let visible = $state(false), dragging = $state(false);
  const sandbox = $derived(SANDBOX.filter(token => token !== 'allow-same-origin' || url.host !== window.location.host).join(' '));
  const size = $derived(embed.width && embed.height ? `aspect-ratio: ${embed.width} / ${embed.height}` : embed.height ? `height: ${embed.height}px` : 'aspect-ratio: 16 / 9');
  onMount(() => {
    // Without an intersection API there is no observed visibility. Keep the
    // remote page unloaded rather than assuming it is visible or throwing.
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) { visible = true; observer?.disconnect(); } }, { rootMargin: '200px' })
      : null;
    observer?.observe(container);
    const start = () => { dragging = true; }, end = () => { dragging = false; };
    document.addEventListener('dragstart', start); document.addEventListener('dragend', end); document.addEventListener('drop', end);
    return () => { observer?.disconnect(); document.removeEventListener('dragstart', start); document.removeEventListener('dragend', end); document.removeEventListener('drop', end); };
  });
</script>
<div bind:this={container} style={size}>
  {#if visible}<iframe src={url.href} title={embed.title || 'Embedded content'} {sandbox} allow={iframeAllow(embed.allow) || undefined}
    allowfullscreen={embed.allowFullscreen === true} referrerpolicy="strict-origin-when-cross-origin" class:dragging></iframe>{/if}
</div>
<style>iframe { display: block; width: 100%; height: 100%; border: 0; } .dragging { pointer-events: none; }</style>
