<script lang="ts">
  import { beginSetup, completeSetup } from '$lib/auth.remote';
  import { createPasskey } from '$lib/auth/passkey-browser';
  let { unavailable = false, completed = false, loginHref = '/login' }: {
    unavailable?: boolean; completed?: boolean; loginHref?: string;
  } = $props();
  let failure = $state('');
  let pending = $state(false);
</script>

<h1>Set up Sveltery CMS</h1>
{#if unavailable}
  <p role="status">Setup is unavailable until the database and public URL are configured.</p>
{:else if completed}
  <p>Setup is complete. <a href={loginHref}>Sign in with your passkey.</a></p>
{:else}
  <p>Create the first administrator account and save a passkey to sign in.</p>
  <noscript><p>Passkeys require JavaScript. Enable JavaScript to create your account.</p></noscript>
  <form {...beginSetup.enhance(async ({ submit }) => {
    failure = ''; pending = true;
    try {
      await submit();
      if (beginSetup.result) {
        const credential = await createPasskey(beginSetup.result.options);
        completeSetup.fields.credential.set(JSON.stringify(credential));
        await completeSetup.submit();
        if (completeSetup.result) window.location.assign(loginHref);
      }
    } catch { failure = 'Setup could not be completed. Please try again.'; }
    finally { pending = false; }
  })}>
    <label>Email <input {...beginSetup.fields.email.as('email')} required autocomplete="email" /></label>
    <label>Name <input {...beginSetup.fields.name.as('text')} autocomplete="name" /></label>
    <button disabled={pending || beginSetup.pending > 0 || completeSetup.pending > 0}>Create administrator and passkey</button>
  </form>
  {#each beginSetup.fields.allIssues() ?? [] as issue}<p role="alert">{issue.message}</p>{/each}
  {#if failure}<p role="alert">{failure}</p>{/if}
{/if}

<style>
  label { display: block; margin-block: 1rem; }
  input { display: block; padding: .65rem; inline-size: min(100%, 26rem); }
  button { padding: .7rem 1rem; }
</style>
