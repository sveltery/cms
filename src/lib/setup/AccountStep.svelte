<!-- EmDash 1.1.0 setup UI port, MIT, Copyright 2026 Cloudflare Inc.; source pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e. -->
<script lang="ts">
  import type { AdminRequest } from './types';
  let { onNext, onBack, isLoading = false, error }: {
    onNext: (data: AdminRequest) => void; onBack: () => void; isLoading?: boolean; error?: string;
  } = $props();
  let email = $state('');
  let name = $state('');
  let emailError = $state('');
  function submit(event: SubmitEvent) {
    event.preventDefault();
    emailError = !email.trim() ? 'Email is required' : !email.includes('@') ? 'Please enter a valid email' : '';
    if (!emailError) onNext({ email, name: name || undefined });
  }
</script>

<form onsubmit={submit} novalidate>
  <label>Your Email <input type="email" bind:value={email} placeholder="you@example.com" disabled={isLoading} autocomplete="email" aria-invalid={!!emailError} /></label>
  {#if emailError}<p class="error">{emailError}</p>{/if}
  <label>Your Name <input type="text" bind:value={name} placeholder="Jane Doe" disabled={isLoading} autocomplete="name" /></label>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <div class="actions"><button type="button" onclick={onBack} disabled={isLoading}>← Back</button><button type="submit" disabled={isLoading}>{isLoading ? 'Preparing...' : 'Continue →'}</button></div>
</form>

<style>
  form { display: grid; gap: 1.25rem; }
  label { display: grid; gap: .5rem; }
  input { box-sizing: border-box; width: 100%; padding: .75rem; border: 1px solid #aeb5c0; border-radius: .4rem; font: inherit; }
  .actions { display: flex; gap: .75rem; }
  button { padding: .8rem 1rem; border: 1px solid #aeb5c0; border-radius: .4rem; background: transparent; font: inherit; cursor: pointer; }
  button[type='submit'] { flex: 1; border-color: #4f46e5; background: #4f46e5; color: white; }
  button:disabled { opacity: .65; cursor: wait; }
  .error { color: #a61b29; margin: 0; }
</style>
