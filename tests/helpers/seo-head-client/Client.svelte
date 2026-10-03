<script lang="ts">
  import SeoHead from '../../../src/lib/seo/SeoHead.svelte';
  import type {PublicPageContext}from '../../../src/lib/seo/types.ts';
  let changed=$state(false);
  const page=$derived<PublicPageContext>({
    url:changed?'https://example.com/post/changed':'https://example.com/post/hello',
    path:changed?'/post/changed':'/post/hello',locale:'en',kind:'content',pageType:'article',
    title:changed?'Changed | Site':'Initial | Site',pageTitle:changed?'Changed':'Initial',
    description:changed?'Updated description':'Initial description',
    canonical:changed?'https://example.com/post/changed':'https://example.com/post/hello',
    image:null,siteName:'Site',seo:{robots:changed?'noindex, nofollow':null}
  });
</script>

<SeoHead {page} siteSeo={{googleVerification:'g-token'}} defaultOgImage="https://example.com/default.png" />
<h1>Native SEO head fixture</h1>
<button type="button" onclick={()=>changed=!changed}>Update page metadata</button>
