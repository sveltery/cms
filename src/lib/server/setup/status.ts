import { setupStatus, type IdentityContext } from '../auth/passkey-flow.ts';
import { setupSeedInfo } from '../seed/info.ts';

/** Enrollment status remains under the existing actual account authority. */
export async function runtimeSetupStatus(context: IdentityContext) {
  const status = await setupStatus(context);
  return status.needsSetup ? { ...status, seedInfo: await setupSeedInfo() } : status;
}
