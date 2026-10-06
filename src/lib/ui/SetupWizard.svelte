<script lang="ts">
  // EmDash1.1.0 complete SetupWizard behavior transported to Svelte/Kit forms.
  // Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
  import { onMount, tick, untrack } from 'svelte';
  import { beginSetup, completeSetup } from '$lib/auth.remote';
  import { createPasskey } from '$lib/auth/passkey-browser';
  import { setupClient, type SeedProgress, type SetupWizardStatus, type StartWith } from '$lib/setup/client';
  import { navigateAfterSetup } from '$lib/setup/navigation';
  import { configuredSetupProviders } from '$lib/setup/providers';
  let { status, loginHref = '/login' }: { status: SetupWizardStatus; loginHref?: string } = $props();
  let step = $state<'site' | 'admin' | 'passkey'>('site');
  // Match Source useState's initial seed defaults; later edits are user-owned.
  let title = $state(untrack(() => status.seedInfo?.title ?? ''));
  let tagline = $state(untrack(() => status.seedInfo?.tagline ?? ''));
  let startWith = $state<StartWith>(untrack(() => status.seedInfo?.hasContent ? 'sample' : 'empty'));
  let email = $state('');
  let name = $state('');
  let titleError = $state('');
  let emailError = $state('');
  let failure = $state('');
  let urlError = $state('');
  let progress = $state<SeedProgress | undefined>();
  let pending = $state(false);
  let credentialJSON = $state('');
  let activeProvider = $state<string | null>(null);
  const providers = configuredSetupProviders();
  const useAccessAuth = $derived(status.authMode === 'cloudflare-access');
  const selectedProvider = $derived(providers.find(provider => provider.id === activeProvider));

  onMount(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('error');
    if (code) {
      urlError = params.get('message') || `Authentication error: ${code}`;
      window.history.replaceState({}, '', window.location.pathname);
    }
  });

  async function applySite(event: SubmitEvent) {
    event.preventDefault();
    titleError = title.trim() ? '' : 'Site title is required';
    if (titleError) return;
    pending = true;
    try {
      const result = await setupClient.applySite({ title, tagline, includeContent: startWith === 'sample' }, value => { progress = value; });
      failure = ''; progress = undefined;
      if (result.setupComplete) navigateAfterSetup(startWith);
      else step = 'admin';
    } catch (cause) { failure = cause instanceof Error ? cause.message : 'Setup failed'; }
    finally { pending = false; }
  }

  async function registerPasskey() {
    failure = ''; pending = true;
    try {
      // Source requests fresh options for each registration attempt, including retry.
      const prepared = await beginSetup.submit();
      if (!prepared || !beginSetup.result) throw new Error('Account setup is not prepared');
      const credential = await createPasskey(beginSetup.result.options);
      credentialJSON = JSON.stringify(credential);
      await tick();
      await completeSetup.submit();
      // Keep the actual existing enrollment-to-login transport. Authentication
      // remains with the existing real login/session flow.
      if (completeSetup.result) window.location.assign(loginHref);
    } catch { failure = 'Setup could not be completed. Please try again.'; }
    finally { pending = false; }
  }

  function resetStepFields(destination: 'site' | 'admin') {
    titleError = ''; emailError = '';
    // Source conditionally remounts each step, resetting its own local fields.
    if (destination === 'site') {
      title = status.seedInfo?.title ?? ''; tagline = status.seedInfo?.tagline ?? '';
      startWith = status.seedInfo?.hasContent ? 'sample' : 'empty';
    }
    email = ''; name = '';
  }

  function back(destination: 'site' | 'admin') {
    failure = ''; activeProvider = null; credentialJSON = '';
    resetStepFields(destination);
    step = destination;
  }
</script>

<div class="wizard">
  <header><a class="brand" href="/">Sveltery CMS</a>
    <h1>{step === 'site' ? 'Set up your site' : step === 'admin' ? 'Create your account' : 'Secure your account'}</h1>
    {#if useAccessAuth && step === 'site'}<p>You're signed in via Cloudflare Access</p>{/if}
  </header>
  {#if urlError}<p role="alert">{urlError}</p>{/if}
  <ol aria-label="Setup progress" class="steps">
    {#if useAccessAuth}<li aria-current="step">Site Settings</li>
    {:else}<li aria-current={step === 'site' ? 'step' : undefined}>Site</li>
      <li aria-current={step === 'admin' ? 'step' : undefined}>Account</li>
      <li aria-current={step === 'passkey' ? 'step' : undefined}>Sign In</li>{/if}
  </ol>
  <section class="card">
    {#if step === 'site'}
      <form onsubmit={applySite}>
        <label>Site Title <input type="text" bind:value={title} placeholder="My Awesome Blog" disabled={pending} aria-invalid={!!titleError} /></label>
        {#if titleError}<p role="alert">{titleError}</p>{/if}
        <label>Tagline <input type="text" bind:value={tagline} placeholder="Thoughts, tutorials, and more" disabled={pending} /></label>
        <fieldset disabled={pending}><legend>How do you want to start?</legend>
          {#if status.seedInfo?.hasContent}<label class="choice"><input type="radio" bind:group={startWith} value="sample" />
            <span><strong>Sample content</strong><small>Start with the template’s example posts and pages. Recommended for new sites.</small></span></label>{/if}
          <label class="choice"><input type="radio" bind:group={startWith} value="empty" />
            <span><strong>Empty site</strong><small>Start with the template’s content types and no content.</small></span></label>
          <label class="choice"><input type="radio" bind:group={startWith} value="import" />
            <span><strong>Import an existing EmDash site</strong><small>Once setup is done, upload a .emdash package exported from another EmDash site.</small></span></label>
        </fieldset>
        {#if failure}<div role="alert"><p>{failure}</p>
          {#if progress && progress.done > 0}<p>The sample content added so far is kept. Continue to add the rest.</p>{/if}</div>{/if}
        <button disabled={pending}>{pending ? 'Setting up...' : 'Continue →'}</button>
        <div role="status" aria-live="polite">{#if progress && progress.total > 0}
          <label>Sample content <meter value={progress.done} max={progress.total}></meter></label>
          <p>{progress.done.toLocaleString()} of {progress.total.toLocaleString()} items</p>{/if}</div>
        {#if status.seedInfo}<p class="template">Template: {status.seedInfo.name} ({status.seedInfo.collections} {status.seedInfo.collections === 1 ? 'collection' : 'collections'})</p>{/if}
      </form>
    {:else if step === 'admin'}
      <form novalidate {...beginSetup.enhance(async ({ submit }) => {
        emailError = !email.trim() ? 'Email is required' : !email.includes('@') ? 'Please enter a valid email' : '';
        if (emailError) return;
        pending = true;
        try { await submit(); if (beginSetup.result) { failure = ''; step = 'passkey'; } }
        catch (cause) { failure = cause instanceof Error ? cause.message : 'Failed to create admin'; }
        finally { pending = false; }
      })}>
        <label>Email <input {...beginSetup.fields.email.as('email')} bind:value={email} placeholder="you@example.com" autocomplete="email" disabled={pending} aria-invalid={!!emailError} /></label>
        {#if emailError}<p role="alert">{emailError}</p>{/if}
        <label>Name <input {...beginSetup.fields.name.as('text')} bind:value={name} placeholder="Jane Doe" autocomplete="name" disabled={pending} /></label>
        {#if failure}<p role="alert">{failure}</p>{/if}
        <div class="actions"><button type="button" onclick={() => back('site')} disabled={pending}>← Back</button>
          <button disabled={pending || beginSetup.pending > 0}>{pending ? 'Preparing...' : 'Continue →'}</button></div>
      </form>
    {:else if selectedProvider && (selectedProvider.SetupStep || selectedProvider.LoginForm)}
      <h2>Sign in with {selectedProvider.label}</h2>
      {#if selectedProvider.SetupStep}<selectedProvider.SetupStep onComplete={() => navigateAfterSetup(startWith)} />
      {:else if selectedProvider.LoginForm}<selectedProvider.LoginForm />{/if}
      <button type="button" onclick={() => { activeProvider = null; }}>← Back</button>
    {:else}
      <p>Create a passkey to sign in using your device or security key.</p>
      <noscript><p>Passkeys require JavaScript. Enable JavaScript to create your account.</p></noscript>
      <button type="button" onclick={registerPasskey} disabled={pending || completeSetup.pending > 0}>Create administrator and passkey</button>
      <button type="button" onclick={() => back('admin')} disabled={pending}>← Back</button>
      {#if providers.some(provider => provider.LoginButton)}
        <p>Or continue with</p>
        {#each providers.filter(provider => provider.LoginButton) as provider (provider.id)}
          <div onclick={() => { if (provider.LoginForm || provider.SetupStep) activeProvider = provider.id; }} role="presentation">
            {#if provider.LoginButton}<provider.LoginButton />{/if}
          </div>
        {/each}
      {/if}
      {#if failure}<p role="alert">{failure}</p>{/if}
    {/if}
  </section>
  {#if step === 'passkey'}
    <form {...beginSetup} hidden aria-hidden="true">
      <input {...beginSetup.fields.email.as('hidden', email)} />
      <input {...beginSetup.fields.name.as('hidden', name)} />
    </form>
  {/if}
  <form {...completeSetup} hidden aria-hidden="true"><input {...completeSetup.fields.credential.as('hidden', credentialJSON)} /></form>
  {#each beginSetup.fields.allIssues() ?? [] as issue}<p role="alert">{issue.message}</p>{/each}
</div>

<style>
  .wizard { width: min(100%, 32rem); margin-inline: auto; padding: 2rem 1rem; color: #172033; }
  header { text-align: center; margin-block-end: 1.5rem; }
  .brand { font-weight: 750; color: inherit; text-decoration: none; }
  h1 { font-size: 1.65rem; margin-block: 1rem; }
  .steps { display: flex; justify-content: center; gap: 1.5rem; list-style: decimal; padding-inline-start: 1.5rem; margin-block: 2rem; }
  [aria-current="step"] { font-weight: 750; }
  .card { border: 1px solid #d9dfe8; border-radius: 12px; padding: 1.5rem; box-shadow: 0 4px 16px #17203308; }
  label { display: block; margin-block: 1rem; }
  input:not([type="radio"]) { display: block; box-sizing: border-box; width: 100%; padding: .7rem; margin-top: .4rem; border: 1px solid #b7c0cd; border-radius: 6px; }
  fieldset { border: 0; padding: 0; margin-block: 1.5rem; }
  legend { font-weight: 650; }
  .choice { display: flex; gap: .8rem; align-items: flex-start; border: 1px solid #d9dfe8; border-radius: 8px; padding: 1rem; cursor: pointer; }
  .choice:has(input:checked) { border-color: #3759d6; background: #f5f7ff; }
  small { display: block; margin-top: .35rem; color: #526079; }
  button { padding: .75rem 1rem; border: 1px solid #3759d6; border-radius: 6px; color: white; background: #3759d6; cursor: pointer; }
  button:disabled { opacity: .6; cursor: wait; }
  .actions { display: flex; gap: .75rem; }
  .template { font-size: .8rem; text-align: center; color: #526079; }
  [role="alert"] { color: #9f2222; }
  meter { display: block; width: 100%; margin-block: .5rem; }
</style>
