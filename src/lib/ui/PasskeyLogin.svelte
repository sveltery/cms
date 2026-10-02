<script lang="ts">
  import { beginLogin, completeLogin, logout } from '$lib/auth.remote';
  import { usePasskey } from '$lib/auth/passkey-browser';
  import { tick } from 'svelte';
  let { unavailable = false, homeHref = '/', setupHref = '/setup', needsSetup = false, user = null, loginHref = '/login' }: {
    unavailable?: boolean; homeHref?: string; setupHref?: string; needsSetup?: boolean;
    user?: { name: string | null; email: string } | null; loginHref?: string;
  } = $props();
  let failure = $state('');
  let pending = $state(false);
  let credentialJSON = $state('');
</script>

<h1>Sign in</h1>
{#if unavailable}
  <p role="status">Sign-in is unavailable until the database and public URL are configured.</p>
{:else if needsSetup}
  <p><a href={setupHref}>Set up your administrator account first.</a></p>
{:else if user}
  <p>Signed in as {user.name ?? user.email}.</p>
  <p><a href={homeHref}>Open your workspace</a></p>
  <form {...logout.enhance(async ({ submit }) => { await submit(); window.location.assign(loginHref); })}>
    <button disabled={logout.pending > 0}>Sign out</button>
  </form>
{:else}
  <p>Use the passkey saved for your account.</p>
  <noscript><p>Passkeys require JavaScript. Enable JavaScript to sign in.</p></noscript>
  <form {...beginLogin.enhance(async ({ submit }) => {
    failure = ''; pending = true;
    try {
      await submit();
      if (beginLogin.result) {
        const credential = await usePasskey(beginLogin.result.options);
        credentialJSON = JSON.stringify(credential);
        await tick();
        await completeLogin.submit();
        if (completeLogin.result) window.location.assign(homeHref);
      }
    } catch { failure = 'Sign-in failed or was cancelled. Please try again.'; }
    finally { pending = false; }
  })}>
    <button disabled={pending || beginLogin.pending > 0 || completeLogin.pending > 0}>Sign in with a passkey</button>
  </form>
  <form {...completeLogin} hidden aria-hidden="true">
    <input {...completeLogin.fields.credential.as('hidden', credentialJSON)} />
  </form>
  {#if failure}<p role="alert">{failure}</p>{/if}
{/if}
