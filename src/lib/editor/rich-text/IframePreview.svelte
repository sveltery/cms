<script lang="ts">
  import { onMount } from 'svelte';
  import { iframeAllow, type IframeEmbed } from '../portable-text/iframe-embed';
  import { documentDragging } from './document-dragging.svelte';
  import { sourceMessage, type Translate } from './types';
  import { embedMessage } from './embed-messages.source';
  let { embed, url, translate = sourceMessage }: { embed: IframeEmbed; url: URL; translate?: Translate } = $props();
  const SANDBOX = ['allow-scripts', 'allow-same-origin', 'allow-forms', 'allow-popups', 'allow-popups-to-escape-sandbox', 'allow-presentation'];
  let container: HTMLDivElement;
  let visible = $state(false);
  const dragging = documentDragging();
  const sandbox = $derived(SANDBOX.filter(token => token !== 'allow-same-origin' || url.host !== window.location.host).join(' '));
  const size = $derived(embed.width && embed.height ? `aspect-ratio: ${embed.width} / ${embed.height}` : embed.height ? `height: ${embed.height}px` : 'aspect-ratio: 16 / 9');
  onMount(() => {
    // Without an intersection API there is no observed visibility. Keep the
    // remote page unloaded rather than assuming it is visible or throwing.
    const observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) { visible = true; observer?.disconnect(); } }, { rootMargin: '200px' })
      : null;
    observer?.observe(container);
    return () => observer?.disconnect();
  });
</script>
<div bind:this={container} style={size}>
  {#if visible}<iframe src={url.href} title={embed.title || embedMessage(translate, 'Embedded content')} {sandbox} allow={iframeAllow(embed.allow) || undefined}
    allowfullscreen={embed.allowFullscreen === true} referrerpolicy="strict-origin-when-cross-origin" class:dragging={dragging.active}></iframe>{/if}
</div>
<style>iframe { display: block; width: 100%; height: 100%; border: 0; } .dragging { pointer-events: none; }</style>
