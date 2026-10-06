import { setupStatus, type IdentityContext } from '../auth/passkey-flow.ts';

/** Enrollment status remains under the existing actual account authority. */
export async function runtimeSetupStatus(context: IdentityContext) {
  return setupStatus(context);
}
