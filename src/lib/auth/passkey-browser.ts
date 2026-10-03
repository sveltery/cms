import type { AuthenticationOptions, AuthenticationResponse, RegistrationOptions, RegistrationResponse } from '$lib/server/auth/vendor/passkey/types';
import type { AuthenticatorTransport } from '$lib/server/auth/vendor/types';

function decode(value: string): ArrayBuffer {
  const text = value.replaceAll('-', '+').replaceAll('_', '/');
  return Uint8Array.from(atob(text), character => character.charCodeAt(0)).buffer;
}
function encode(value: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(value))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
const supportedTransport = (value: string): value is AuthenticatorTransport => ['usb', 'nfc', 'ble', 'internal', 'hybrid'].includes(value);
export async function createPasskey(options: RegistrationOptions): Promise<RegistrationResponse> {
  const credential = await navigator.credentials.create({ publicKey: {
    ...options, challenge: decode(options.challenge), user: { ...options.user, id: decode(options.user.id) },
    excludeCredentials: options.excludeCredentials?.map(item => ({ ...item, id: decode(item.id) }))
  } });
  if (!(credential instanceof PublicKeyCredential) || !(credential.response instanceof AuthenticatorAttestationResponse)) throw new Error('Passkey creation was cancelled. Please try again.');
  return { id: credential.id, rawId: encode(credential.rawId), type: 'public-key',
    response: { clientDataJSON: encode(credential.response.clientDataJSON), attestationObject: encode(credential.response.attestationObject),
      transports: credential.response.getTransports().filter(supportedTransport) },
    ...(credential.authenticatorAttachment ? { authenticatorAttachment: credential.authenticatorAttachment as 'platform' | 'cross-platform' } : {}) };
}
export async function usePasskey(options: AuthenticationOptions): Promise<AuthenticationResponse> {
  const credential = await navigator.credentials.get({ publicKey: {
    ...options, challenge: decode(options.challenge), allowCredentials: options.allowCredentials?.map(item => ({ ...item, id: decode(item.id) }))
  } });
  if (!(credential instanceof PublicKeyCredential) || !(credential.response instanceof AuthenticatorAssertionResponse)) throw new Error('Passkey sign-in was cancelled. Please try again.');
  return { id: credential.id, rawId: encode(credential.rawId), type: 'public-key', response: {
    clientDataJSON: encode(credential.response.clientDataJSON), authenticatorData: encode(credential.response.authenticatorData),
    signature: encode(credential.response.signature), ...(credential.response.userHandle ? { userHandle: encode(credential.response.userHandle) } : {})
  }, ...(credential.authenticatorAttachment ? { authenticatorAttachment: credential.authenticatorAttachment as 'platform' | 'cross-platform' } : {}) };
}
