<!-- Adapted from EmDash 1.1.0, MIT, Copyright 2026 Cloudflare Inc.
     Pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; blob 0513cc5c8425bcbb46e5c208db21ca6ea6b1743e.
     Source packages/admin/src/components/auth/PasskeyRegistration.tsx; notice in notices/emdash-MIT.txt. -->
<script module lang="ts">
  import type { RegistrationOptions, RegistrationResponse } from '$lib/server/auth/vendor/passkey/types';

  type Icon = 'key' | 'shield' | 'windows' | 'fingerprint' | 'mobile' | 'usb' | 'info';
  export type PasskeyPreference = 'client-device' | 'hybrid' | 'security-key';
  export interface RegistrationOptionsWithHints extends RegistrationOptions {
    hints?: PasskeyPreference[];
  }
  export interface PasskeyRegistrationResult {
    user: unknown;
    sessionToken?: string;
  }
  export interface PasskeyTransport {
    getOptions(email: string, name?: string): Promise<RegistrationOptionsWithHints>;
    verify(email: string, name: string | undefined, credential: RegistrationResponse): Promise<PasskeyRegistrationResult>;
  }
  export interface PasskeyRegistrationProps {
    email: string;
    name?: string;
    transport?: PasskeyTransport;
    onSuccess: (result: PasskeyRegistrationResult) => void;
    onError?: (error: Error) => void;
    buttonText?: string;
    showNameInput?: boolean;
    showEducation?: boolean;
    showSuccessStep?: boolean;
    successButtonText?: string;
    onSuccessReady?: () => void;
    onBack?: () => void;
  }
</script>

<script lang="ts">
  import { createPasskey } from '$lib/auth/passkey-browser';
  import {
    detectPasskeyPlatform,
    getPasskeyClientCapabilities,
    isPasskeyEnvironmentUsable,
    isWebAuthnSecureContext
  } from './webauthn-environment';
  import type { PasskeyClientCapabilities, PasskeyPlatform } from './webauthn-environment';

  type RegistrationState =
    | { status: 'idle' }
    | { status: 'loading'; message: string }
    | { status: 'error'; message: string }
    | { status: 'success'; result: PasskeyRegistrationResult };
  type CapabilityState =
    | { status: 'checking' }
    | { status: 'ready'; capabilities: PasskeyClientCapabilities };
  interface PlatformCopy { name: string; unlock: string; storage: string; icon: Icon }

  let {
    email,
    name,
    transport,
    onSuccess,
    onError,
    buttonText = 'Register Passkey',
    showNameInput = false,
    showEducation = false,
    showSuccessStep = false,
    successButtonText = 'Continue',
    onSuccessReady,
    onBack
  }: PasskeyRegistrationProps = $props();

  let registrationState = $state<RegistrationState>({ status: 'idle' });
  let passkeyName = $state('');
  let preference = $state<PasskeyPreference | null>(null);
  let showWindowsHelloHelp = $state(false);
  let recheckFailed = $state(false);
  let capabilityState = $state<CapabilityState>({ status: 'checking' });
  const isSupported = isPasskeyEnvironmentUsable();
  const platform = detectPasskeyPlatform();
  const insecureContext = typeof window !== 'undefined' && !isWebAuthnSecureContext();
  const platformCopy = getPlatformCopy(platform);
  const capabilities = $derived(capabilityState.status === 'ready' ? capabilityState.capabilities : null);
  const noPlatformAuthenticator = $derived(capabilities?.platformAuthenticator === false);
  const selectedPreference = $derived(preference ?? (capabilities?.platformAuthenticator === true ? 'client-device' : undefined));

  function getPlatformCopy(currentPlatform: PasskeyPlatform): PlatformCopy {
    switch (currentPlatform) {
      case 'windows':
        return {
          name: 'the Windows passkey prompt',
          unlock: 'Choose Windows Hello or another available credential manager, then confirm with your PIN, fingerprint, or face.',
          storage: 'Windows will show which credential manager will save it before creating it.',
          icon: 'windows'
        };
      case 'macos':
        return {
          name: 'the macOS passkey prompt',
          unlock: 'Choose Touch ID or another available credential manager, then confirm with your fingerprint or Mac password.',
          storage: 'Your credential manager, such as iCloud Keychain, saves it and may sync it to your other devices.',
          icon: 'fingerprint'
        };
      case 'ios':
        return {
          name: "your device's passkey prompt",
          unlock: 'Confirm with Face ID, Touch ID, or your device passcode.',
          storage: 'Your credential manager, such as iCloud Keychain, saves it and may sync it to your other devices.',
          icon: 'mobile'
        };
      case 'android':
        return {
          name: 'the Android passkey prompt',
          unlock: 'Confirm with your fingerprint, face, or PIN.',
          storage: 'Your credential manager, such as Google Password Manager, saves it and may sync it to your other devices.',
          icon: 'mobile'
        };
      default:
        return {
          name: "your device's passkey prompt",
          unlock: 'Confirm using the secure prompt from your device or credential manager.',
          storage: "Your device's credential manager saves it and will show you where before creating it.",
          icon: 'shield'
        };
    }
  }

  $effect(() => {
    if (!showEducation || !isSupported) return;
    let active = true;
    void (async () => {
      const detectedCapabilities = await getPasskeyClientCapabilities();
      if (active) capabilityState = { status: 'ready', capabilities: detectedCapabilities };
    })();
    return () => { active = false; };
  });

  async function checkCapabilities(): Promise<PasskeyClientCapabilities> {
    capabilityState = { status: 'checking' };
    const detectedCapabilities = await getPasskeyClientCapabilities();
    capabilityState = { status: 'ready', capabilities: detectedCapabilities };
    return detectedCapabilities;
  }

  async function handleCheckAgain(): Promise<void> {
    recheckFailed = false;
    const detectedCapabilities = await checkCapabilities();
    if (detectedCapabilities.platformAuthenticator) {
      showWindowsHelloHelp = false;
      preference = 'client-device';
    } else {
      recheckFailed = true;
    }
  }

  async function handleRegister(method?: PasskeyPreference): Promise<void> {
    if (!isSupported) {
      registrationState = { status: 'error', message: 'WebAuthn is not supported in this browser' };
      return;
    }

    const currentEmail = email;
    const currentName = name;
    const currentPasskeyName = passkeyName;
    const currentTransport = transport;
    const currentShowSuccessStep = showSuccessStep;
    const currentOnSuccessReady = onSuccessReady;
    const currentOnSuccess = onSuccess;
    const currentOnError = onError;
    try {
      registrationState = { status: 'loading', message: 'Preparing registration...' };
      if (!currentTransport) throw new Error('Passkey registration is not configured.');
      const options = await currentTransport.getOptions(currentEmail, currentName);

      registrationState = { status: 'loading', message: 'Waiting for passkey...' };
      const registrationOptions: RegistrationOptionsWithHints = {
        ...options,
        hints: method ? [method] : options.hints
      };
      const credential = await createPasskey(registrationOptions);

      registrationState = { status: 'loading', message: 'Verifying...' };
      const result = await currentTransport.verify(
        currentEmail,
        currentName !== undefined ? currentName : currentPasskeyName || undefined,
        credential
      );
      registrationState = { status: 'success', result };
      if (currentShowSuccessStep) currentOnSuccessReady?.();
      else currentOnSuccess(result);
    } catch (error) {
      let userMessage = error instanceof Error ? error.message : 'Registration failed';
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            userMessage = 'Registration was cancelled or timed out. Please try again.';
            break;
          case 'InvalidStateError':
            userMessage = 'This passkey is already registered on this device.';
            break;
          case 'NotSupportedError':
            userMessage = "Your device doesn't support the required security features.";
            break;
          case 'SecurityError':
            userMessage = "Security error. Make sure you're on a secure connection.";
            break;
          default:
            userMessage = `Authentication error: ${error.message}`;
        }
      }
      registrationState = { status: 'error', message: userMessage };
      currentOnError?.(new Error(userMessage));
    }
  }

  function continueAfterSuccess(): void {
    if (registrationState.status === 'success') onSuccess(registrationState.result);
  }
</script>

{#snippet icon(kind: Icon)}
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {#if kind === 'key'}
      <circle cx="8" cy="8" r="5" /><path d="m11.5 11.5 9 9M16 16l3-3M19 19l3-3" />
    {:else if kind === 'windows'}
      <path d="M3 5l8-1v7H3V5Zm10-1 8-1v8h-8V4ZM3 13h8v7l-8-1v-6Zm10 0h8v8l-8-1v-7Z" />
    {:else if kind === 'fingerprint'}
      <path d="M5 11a7 7 0 0 1 14 0M3 12v2M21 12v2M8 18v-7a4 4 0 0 1 8 0v4c0 3-1 5-3 7M11 20V11a1 1 0 0 1 2 0v4M5 15v3M19 17l-1 4" />
    {:else if kind === 'mobile'}
      <rect x="6" y="2" width="12" height="20" rx="2" /><path d="M10 5h4M11 19h2" />
    {:else if kind === 'usb'}
      <path d="M12 21V3m-3 3 3-3 3 3M12 16l-5-4V8m5 5 5-4V6" /><circle cx="7" cy="6" r="2" /><path d="M15 3h4v3h-4z" />
    {:else if kind === 'info'}
      <circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" />
    {:else}
      <path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Z" /><path d="m8 12 3 3 5-6" />
    {/if}
  </svg>
{/snippet}

{#snippet introduction(storage: string)}
  <div class="introduction">
    <div class="center">
      <div class="hero-icon">{@render icon('key')}</div>
      <h3>With a passkey, you don’t need to remember complex passwords</h3>
    </div>
    <div class="detail-row">
      <div class="detail-icon">{@render icon('key')}</div>
      <div><h4>What is a passkey?</h4><p>An encrypted digital key you unlock using your fingerprint, face, PIN, or device password.</p></div>
    </div>
    <div class="detail-row">
      <div class="detail-icon">{@render icon('shield')}</div>
      <div><h4>Where is it saved?</h4><p>{storage}</p></div>
    </div>
  </div>
{/snippet}

{#snippet registrationError()}
  {#if registrationState.status === 'error'}<div class="notice error" role="alert">{registrationState.message}</div>{/if}
{/snippet}

{#snippet loadingIndicator()}
  {#if registrationState.status === 'loading'}<span class="spinner" aria-hidden="true"></span>{/if}
{/snippet}

<div class="passkey-registration">
  {#if !isSupported}
    <div class="notice error unavailable">
      <h3>Passkeys Not Available Here</h3>
      <p>
        {#if insecureContext}
          Passkeys require a <strong>secure context</strong>: use <strong>HTTPS</strong>, or open the admin at <strong>http://localhost</strong> (with your dev port). Plain <code>http://</code> on a custom hostname is not treated as secure, even on loopback.
        {:else}
          Your browser doesn't support passkeys. Please use a modern browser like Chrome, Safari, Firefox, or Edge.
        {/if}
      </p>
    </div>
  {:else if showEducation && capabilityState.status === 'checking'}
    <div class="checking" role="status"><span class="spinner" aria-hidden="true"></span>Checking this device for passkey support...</div>
  {:else if showEducation && showSuccessStep && registrationState.status === 'success'}
    <div class="flow center">
      <div class="hero-icon success-icon">{@render icon('shield')}</div>
      <div><h3>Passkey created</h3><p>It is stored by the authenticator or credential manager you selected in the secure system prompt.</p></div>
      <p class="notice prompt">You can view, rename, or add more passkeys later in Security settings.</p>
      <button type="button" class="full primary" onclick={continueAfterSuccess}>{successButtonText}</button>
    </div>
  {:else if showEducation && showWindowsHelloHelp}
    <div class="flow">
      <div class="center">
        <div class="hero-icon">{@render icon('windows')}</div>
        <h3>Set up Windows Hello</h3>
        <p>In Windows Settings, open Accounts, then Sign-in options, and set up a PIN. Fingerprint and face recognition are optional.</p>
      </div>
      <a class="button full primary" href="ms-settings:signinoptions" target="_blank" rel="noopener noreferrer">{@render icon('windows')}Open Windows settings</a>
      <button type="button" class="full outline" onclick={() => void handleCheckAgain()}>I've set it up — check again</button>
      {#if recheckFailed}<p class="notice warning">Windows Hello still isn't available to this browser. You can try another device or a security key instead.</p>{/if}
      <button type="button" class="full ghost" onclick={() => { showWindowsHelloHelp = false; }}>Choose another option</button>
    </div>
  {:else if showEducation && noPlatformAuthenticator && preference === null}
    <div class="flow">
      {@render introduction('Choose a credential manager on this device, another device, or a security key.')}
      <div class="notice warning detail-row">
        {@render icon('info')}
        <div><h4>{platform === 'windows' ? 'No Windows Hello authenticator found' : 'No built-in passkey authenticator found'}</h4><p>We checked before opening the browser's passkey prompt so you can choose what happens next.</p></div>
      </div>
      <div class="choices">
        {#if platform === 'windows'}<button type="button" class="full outline start" onclick={() => { showWindowsHelloHelp = true; }}>{@render icon('windows')}Set up Windows Hello</button>{/if}
        {#if capabilities?.hybridTransport !== false}<button type="button" class="full outline start" onclick={() => { preference = 'hybrid'; }}>{@render icon('mobile')}Use another device</button>{/if}
        <button type="button" class="full outline start" onclick={() => { preference = 'security-key'; }}>{@render icon('usb')}Use a security key</button>
      </div>
      {#if onBack}<button type="button" class="full ghost" onclick={onBack}>Back</button>{/if}
    </div>
  {:else if showEducation && preference === 'hybrid'}
    <div class="flow">
      {@render introduction('The credential manager on the phone or tablet you choose saves it. EmDash does not receive the passkey.')}
      <div><h4>What happens next?</h4><ol><li>The browser will usually show a QR code.</li><li>Scan it with a nearby phone or tablet.</li><li>Approve with that device's face, fingerprint, PIN, or passcode.</li></ol></div>
      <div class="notice prompt detail-row">{@render icon('mobile')}<div><h4>Next, the browser's passkey window will open</h4><p>The browser controls the exact prompt and may offer another compatible method.</p></div></div>
      {@render registrationError()}
      <div class="actions"><button type="button" class="outline" onclick={() => { preference = null; }}>Back</button><button type="button" class="primary grow" disabled={registrationState.status === 'loading'} aria-busy={registrationState.status === 'loading'} onclick={() => void handleRegister('hybrid')}>{@render loadingIndicator()}Continue with another device</button></div>
    </div>
  {:else if showEducation && preference === 'security-key'}
    <div class="flow">
      {@render introduction('The passkey is saved on your physical security key and can be used on compatible devices.')}
      <div class="notice prompt detail-row">{@render icon('usb')}<div><h4>Next, the browser's passkey window will open</h4><p>Insert or tap your security key when the browser asks.</p></div></div>
      {@render registrationError()}
      <div class="actions"><button type="button" class="outline" onclick={() => { preference = null; }}>Back</button><button type="button" class="primary grow" disabled={registrationState.status === 'loading'} aria-busy={registrationState.status === 'loading'} onclick={() => void handleRegister('security-key')}>{@render loadingIndicator()}Continue with security key</button></div>
    </div>
  {:else if showEducation}
    <div class="flow">
      {@render introduction(platformCopy.storage)}
      <div class="notice prompt detail-row">{@render icon(platformCopy.icon)}<div><h4>Next, {platformCopy.name} will open</h4><p>{platformCopy.unlock}</p></div></div>
      {@render registrationError()}
      <button type="button" class="full primary" disabled={registrationState.status === 'loading'} aria-busy={registrationState.status === 'loading'} onclick={() => void handleRegister(selectedPreference)}>{@render loadingIndicator()}Create passkey</button>
      <p class="privacy center">EmDash never receives your PIN, password, or biometric information.</p>
      {#if onBack}<button type="button" class="full ghost" onclick={onBack}>Back</button>{/if}
    </div>
  {:else}
    <div class="flow">
      {#if showNameInput}
        <div><label>Passkey Name (optional)<input type="text" bind:value={passkeyName} placeholder="e.g., MacBook Pro, iPhone" disabled={registrationState.status === 'loading'} /></label><p class="privacy">Give this passkey a name to help you identify it later.</p></div>
      {/if}
      {@render registrationError()}
      {#if registrationState.status === 'success'}<div class="notice success">Passkey registered successfully!</div>{/if}
      <button type="button" class="full primary" disabled={registrationState.status === 'loading'} aria-busy={registrationState.status === 'loading'} onclick={() => void handleRegister()}>{@render loadingIndicator()}{registrationState.status === 'loading' ? registrationState.message : buttonText}</button>
      <p class="privacy center">You'll be prompted to use your device's biometric authentication, security key, or PIN.</p>
    </div>
  {/if}
</div>

<style>
  .passkey-registration { color: var(--foreground, #20252d); font-size: .875rem; }
  .flow { display: grid; gap: 1.25rem; }
  .introduction { display: grid; gap: 1rem; }
  .center { text-align: center; }
  h3, h4, p { margin: 0; }
  h3 { font-size: 1.125rem; font-weight: 650; line-height: 1.5; }
  h4 { font-size: .875rem; font-weight: 600; }
  p { color: var(--muted-foreground, #596576); line-height: 1.5; }
  h3 + p { margin-block-start: .5rem; }
  h4 + p { margin-block-start: .25rem; }
  svg { inline-size: 1.25rem; block-size: 1.25rem; flex-shrink: 0; }
  .hero-icon { display: flex; align-items: center; justify-content: center; inline-size: 3.5rem; block-size: 3.5rem; margin-inline: auto; margin-block-end: .75rem; border-radius: 1rem; background: var(--accent, #eef1ff); color: var(--primary, #4257b2); }
  .hero-icon svg { inline-size: 1.75rem; block-size: 1.75rem; }
  .detail-row { display: flex; align-items: flex-start; gap: .75rem; text-align: start; }
  .detail-row > svg { margin-block-start: .125rem; }
  .detail-icon { display: flex; align-items: center; justify-content: center; inline-size: 1.75rem; block-size: 1.75rem; flex-shrink: 0; border-radius: .5rem; background: var(--accent, #eef1ff); color: var(--primary, #4257b2); }
  .detail-icon svg { inline-size: 1rem; block-size: 1rem; }
  .notice { padding: .75rem; border-radius: .5rem; text-align: start; }
  .prompt { background: var(--muted, #f2f4f7); }
  .prompt > svg { color: var(--primary, #4257b2); }
  .warning { background: var(--warning-background, #fff5df); color: var(--warning, #80550a); }
  .error { padding: 1rem; background: var(--destructive-background, #fff0f0); color: var(--destructive, #aa3030); }
  .unavailable { border: 1px solid var(--destructive, #aa3030); }
  .unavailable h3 { color: var(--destructive, #aa3030); font-size: 1rem; }
  .success { background: var(--success-background, #edf9f0); color: var(--success, #26733c); }
  .success-icon { background: var(--success-background, #edf9f0); color: var(--success, #26733c); border-radius: 50%; margin-block-end: 0; }
  .choices { display: grid; gap: .75rem; }
  button, .button { display: inline-flex; gap: .5rem; align-items: center; justify-content: center; box-sizing: border-box; border: 1px solid var(--border, #c7ced8); border-radius: .375rem; background: var(--background, white); color: inherit; padding: .65rem .9rem; font: inherit; font-weight: 550; text-decoration: none; cursor: pointer; }
  button:disabled { opacity: .6; cursor: default; }
  .primary { background: var(--primary, #4257b2); color: var(--primary-foreground, white); border-color: var(--primary, #4257b2); }
  .ghost { background: transparent; border-color: transparent; }
  .full { inline-size: 100%; }
  .start { justify-content: flex-start; }
  .actions { display: flex; gap: .75rem; }
  .grow { flex: 1; }
  .privacy { font-size: .75rem; }
  ol { display: grid; gap: .5rem; margin-block: .75rem 0; padding-inline-start: 1.25rem; color: var(--muted-foreground, #596576); }
  label { display: block; }
  input { display: block; box-sizing: border-box; inline-size: 100%; margin-block-start: .375rem; padding: .65rem; border: 1px solid var(--border, #c7ced8); border-radius: .375rem; color: var(--foreground, #20252d); background: var(--background, white); font: inherit; }
  label + p { margin-block-start: .25rem; }
  .checking { display: flex; align-items: center; justify-content: center; gap: .75rem; padding-block: 2rem; color: var(--muted-foreground, #596576); }
  .spinner { display: inline-block; flex-shrink: 0; inline-size: 1rem; block-size: 1rem; box-sizing: border-box; border: 2px solid currentColor; border-inline-end-color: transparent; border-radius: 50%; animation: spin .8s linear infinite; }
  button:focus-visible, a:focus-visible, input:focus-visible { outline: 2px solid var(--ring, #4257b2); outline-offset: 2px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
</style>
