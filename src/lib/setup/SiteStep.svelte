<!-- EmDash 1.1.0 setup UI port, MIT, Copyright 2026 Cloudflare Inc.; source pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. -->
<script lang="ts">
  import { untrack } from 'svelte';
  import type { SeedInfo, SeedProgress, SiteRequest, StartWith } from './types';
  let { seedInfo, onNext, isLoading = false, error, seedProgress }: {
    seedInfo?: SeedInfo; onNext: (data: SiteRequest, choice: StartWith) => void;
    isLoading?: boolean; error?: string; seedProgress?: SeedProgress;
  } = $props();
  // These are mount defaults, as in Source; returning from Account remounts this form.
  let title = $state(untrack(() => seedInfo?.title ?? ''));
  let tagline = $state(untrack(() => seedInfo?.tagline ?? ''));
  let startWith = $state<StartWith>(untrack(() => seedInfo?.hasContent ? 'sample' : 'empty'));
  let titleError = $state('');
  function submit(event: SubmitEvent) {
    event.preventDefault();
    titleError = title.trim() ? '' : 'Site title is required';
    if (!titleError) onNext({ title, tagline, includeContent: startWith === 'sample' }, startWith);
  }
  const number = new Intl.NumberFormat('en');
</script>

<form onsubmit={submit} novalidate>
  <label>Site Title <input type="text" bind:value={title} placeholder="My Awesome Blog" disabled={isLoading} aria-invalid={!!titleError} /></label>
  {#if titleError}<p class="error">{titleError}</p>{/if}
  <label>Tagline <input type="text" bind:value={tagline} placeholder="Thoughts, tutorials, and more" disabled={isLoading} /></label>
  <fieldset disabled={isLoading}>
    <legend>How do you want to start?</legend>
    {#if seedInfo?.hasContent}
      <label class="choice"><input type="radio" bind:group={startWith} value="sample" /><span><strong>Sample content</strong><small>Start with the template’s example posts and pages. Recommended for new sites.</small></span></label>
    {/if}
    <label class="choice"><input type="radio" bind:group={startWith} value="empty" /><span><strong>Empty site</strong><small>Start with the template’s content types and no content.</small></span></label>
    <label class="choice"><input type="radio" bind:group={startWith} value="import" /><span><strong>Import an existing EmDash site</strong><small>Once setup is done, upload a .emdash package exported from another EmDash site.</small></span></label>
  </fieldset>
  {#if error}
    <div class="error" role="alert"><p>{error}</p>
      {#if seedProgress && seedProgress.done > 0}<p>The sample content added so far is kept. Continue to add the rest.</p>{/if}
    </div>
  {/if}
  <button type="submit" disabled={isLoading}>{isLoading ? 'Setting up...' : 'Continue →'}</button>
  <div role="status" aria-live="polite">
    {#if seedProgress && seedProgress.total > 0}
      <label class="progress">Sample content <meter min="0" max={seedProgress.total} value={seedProgress.done}></meter></label>
      <p>{number.format(seedProgress.done)} of {number.format(seedProgress.total)} items</p>
    {/if}
  </div>
  {#if seedInfo}<p class="template">Template: {seedInfo.name} ({seedInfo.collections} {seedInfo.collections === 1 ? 'collection' : 'collections'})</p>{/if}
</form>

<style>
  form { display: grid; gap: 1.25rem; }
  label:not(.choice) { display: grid; gap: .5rem; }
  input[type='text'] { box-sizing: border-box; width: 100%; padding: .75rem; border: 1px solid #aeb5c0; border-radius: .4rem; font: inherit; }
  fieldset { border: 0; padding: 0; display: grid; gap: .75rem; margin: 0; }
  legend { margin-bottom: .75rem; font-weight: 600; }
  .choice { display: flex; align-items: start; gap: .75rem; border: 1px solid #c7ccd4; border-radius: .5rem; padding: 1rem; cursor: pointer; }
  .choice:has(input:checked) { border-color: #4f46e5; background: #4f46e50c; }
  .choice input { margin-top: .2rem; }
  small { display: block; margin-top: .4rem; line-height: 1.4; }
  button { padding: .8rem; background: #4f46e5; color: white; border: 0; border-radius: .4rem; font: inherit; cursor: pointer; }
  button:disabled { opacity: .65; cursor: wait; }
  .error { color: #a61b29; margin: 0; }
  .error p { margin: .4rem 0; }
  .template { font-size: .8rem; text-align: center; margin: 0; }
  meter { width: 100%; }
</style>
