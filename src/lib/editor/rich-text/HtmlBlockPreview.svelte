<script lang="ts">
  import type { Translate } from './types';
  import { buildHtmlBlockFrame } from '../portable-text/html-block';
  import { cleanInlineHtml } from './inline-html.source';
  import { htmlMessage } from './html-messages.source';
  import HtmlPreviewFrame from './HtmlPreviewFrame.svelte';
  import EmbedIcon from './EmbedIcon.svelte';
  let { html, css, js, isolated, allowScripts, onRun, lastHeight, translate }: {
    html: string; css: string; js: string; isolated: boolean; allowScripts: boolean;
    onRun: () => void; lastHeight: { current: number }; translate: Translate;
  } = $props();
  const RUNS_SCRIPT_RE = /<script\b|<(?:i?frame|object|embed)\b|[\s/"']on[a-z]+\s*=|\ssrcdoc\s*=|http-equiv/i;
  const source = $derived(isolated ? { html, css, js } : { html: cleanInlineHtml(html) });
  const srcdoc = $derived(buildHtmlBlockFrame(source));
  const empty = $derived(!source.html.trim() && !(isolated && (css.trim() || js.trim())));
  const waiting = $derived(isolated && !allowScripts && (js.trim() !== '' || RUNS_SCRIPT_RE.test(html)));
  const t = (message: string) => htmlMessage(translate, message);
</script>
<div class="html-preview">
  {#if empty}<p class="empty">{t('Nothing to preview yet.')}</p>
  {:else if waiting}
    <div class="consent"><p>{t('This block runs JavaScript.')}</p><button type="button" onclick={onRun}><EmbedIcon name="Play" />{t('Run preview')}</button></div>
  {:else}{#key srcdoc}<HtmlPreviewFrame {srcdoc} {lastHeight} {translate} />{/key}{/if}
  {#if !isolated}<p class="notice">{t("Inline blocks use your site's styles. Your site removes scripts, style tags and style attributes, and empties iframes other than YouTube and Vimeo.")}</p>{/if}
</div>
<style>
  .html-preview { padding: .75rem; }
  .empty { padding-block: 1.5rem; text-align: center; font-size: .875rem; color: #667080; }
  .consent { display: flex; flex-direction: column; align-items: center; gap: .75rem; padding-block: 1.5rem; font-size: .875rem; }
  .consent p { margin: 0; color: #667080; }
  button { display: flex; align-items: center; gap: .5rem; border: 1px solid #c4cedd; border-radius: .375rem; padding: .375rem .75rem; background: white; font: inherit; }
  .notice { font-size: .75rem; color: #667080; }
</style>
