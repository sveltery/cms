<script lang="ts">
  import { beginLogin, completeLogin } from '$lib/auth.remote';
  import { usePasskey } from '$lib/auth/passkey-browser';
  let { unavailable = false, homeHref = '/', setupHref = '/setup', needsSetup = false }: {
    unavailable?: boolean; homeHref?: string; setupHref?: string; needsSetup?: boolean;
  } = $props();
  let failure = $state('');
  let pending = $state(false);
</script>

<h1>Sign in</h1>
{#if unavailable}
  <p role="status">Sign-in is unavailable until the database and public URL are configured.</p>
{:else if needsSetup}
  <p><a href={setupHref}>Set up your administrator account first.</a></p>
{:else}
  <p>Use the passkey saved for your account.</p>
  <noscript><p>Passkeys require JavaScript. Enable JavaScript to sign in.</p></noscript>
  <form {...beginLogin.enhance(async ({ submit }) => {
    failure = ''; pending = true;
    try {
      await submit();
      if (beginLogin.result) {
        const credential = await usePasskey(beginLogin.result.options);
        completeLogin.fields.credential.set(JSON.stringify(credential));
        await completeLogin.submit();
        if (completeLogin.result) window.location.assign(homeHref);
      }
    } catch { failure = 'Sign-in failed or was cancelled. Please try again.'; }
    finally { pending = false; }
  })}>
    <button disabled={pending || beginLogin.pending > 0 || completeLogin.pending > 0}>Sign in with a passkey</button>
  </form>
  {#if failure}<p role="alert">{failure}</p>{/if}
{/if}
