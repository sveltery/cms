// Setup/login flow adapted from pinned EmDash 1.1.0; preserve notices/emdash-MIT.txt.
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e: setup/admin.ts, admin-verify.ts,
// auth/passkey/options.ts, verify.ts and api/setup-complete.ts.
import type { CmsDatabase } from '../database/contract.ts';
import type { AuthAdapter, User } from './vendor/types.ts';
import type { AuthenticationResponse, RegistrationResponse } from './vendor/passkey/types.ts';
import { generateToken, secureCompare } from './vendor/tokens.ts';
import { generateRegistrationOptions, registerPasskey, verifyRegistrationResponse } from './vendor/passkey/register.ts';
import { authenticateWithPasskey, generateAuthenticationOptions } from './vendor/passkey/authenticate.ts';
import { createChallengeStore, cleanupExpiredChallenges } from './challenges.ts';
import { createFirstAdmin, hasProfilelessUsers, identityAdapter, identityDb, identityOptions } from './identity-store.ts';
import { hashSessionToken } from './session.ts';
import { sql } from 'kysely';

export interface IdentityContext {
  database: CmsDatabase;
  publicOrigin: string;
  basePath: string;
  rpName: string;
}
export const SETUP_NONCE_COOKIE = 'emdash_setup_nonce';
export const SETUP_NONCE_MAX_AGE_SECONDS = 60 * 60;
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export class AuthFlowError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.name = 'AuthFlowError'; this.code = code; this.status = status; }
}
function config(context: IdentityContext) {
  const url = new URL(context.publicOrigin);
  return { rpId: url.hostname, rpName: context.rpName, origins: [url.origin] };
}
const complete = (value: unknown) => value === true || value === 'true';
async function requirePasskeyAvailable(context: IdentityContext) {
  if (await hasProfilelessUsers(context.database)) throw new AuthFlowError('LEGACY_IDENTITY_UNAVAILABLE', 503);
}
async function setupGuard(context: IdentityContext) {
  await requirePasskeyAvailable(context);
  const options = identityOptions(context.database);
  const isComplete = complete(await options.get('emdash:setup_complete'));
  if (await identityAdapter(context.database).countUsers() > 0) throw new AuthFlowError(isComplete ? 'SETUP_COMPLETE' : 'ADMIN_EXISTS');
  return options;
}
export async function setupStatus(context: IdentityContext) {
  if (await hasProfilelessUsers(context.database)) {
    return { needsSetup: false, unavailable: true, reason: 'LEGACY_IDENTITY_UNAVAILABLE' };
  }
  const options = identityOptions(context.database);
  const isComplete = complete(await options.get('emdash:setup_complete'));
  const hasUsers = (await identityAdapter(context.database).countUsers()) > 0;
  if (isComplete && hasUsers) return { needsSetup: false };
  const state = await options.get<{ step?: string }>('emdash:setup_state');
  const step = isComplete && !hasUsers ? 'admin' : state?.step === 'admin' ? 'admin' : state?.step === 'site' ? 'site' : 'start';
  return { needsSetup: true, step, seedInfo: null, authMode: 'passkey' };
}
type DeferredInput<T> = T | (() => Promise<T>);
export async function beginAdminSetup(context: IdentityContext,
  input: DeferredInput<{ email: string; name?: string }>) {
  const options = await setupGuard(context);
  // JSON routes defer parsing until after the pinned setup guard.
  const body = typeof input === 'function' ? await input() : input;
  const state = await options.get<Record<string, unknown>>('emdash:setup_state');
  const nonce = generateToken();
  const user = { id: `setup-${Date.now()}`, email: body.email.toLowerCase(), name: body.name || null };
  const registration = await generateRegistrationOptions(config(context), user, [], createChallengeStore(context.database));
  await options.set('emdash:setup_state', { ...state, step: 'admin', email: user.email, name: user.name, tempUserId: user.id, nonce });
  return { nonce, options: registration };
}
export async function finishAdminSetup(context: IdentityContext, cookieNonce: string | undefined,
  credential: DeferredInput<RegistrationResponse>) {
  const options = await setupGuard(context);
  const state = await options.get<{ step?: string; email?: string; name?: string | null; nonce?: string }>('emdash:setup_state');
  if (!state || state.step !== 'admin' || !state.nonce || !cookieNonce || !secureCompare(cookieNonce, state.nonce) || !state.email) throw new AuthFlowError('INVALID_STATE');
  const body = typeof credential === 'function' ? await credential() : credential;
  const verified = await verifyRegistrationResponse(config(context), body, createChallengeStore(context.database));
  const user = await createFirstAdmin(context.database, { email: state.email, name: state.name ?? null });
  if (!user) throw new AuthFlowError('ADMIN_EXISTS');
  // The pinned first-user insert and credential registration are distinct steps; preserve that boundary.
  await registerPasskey(identityAdapter(context.database) as AuthAdapter, user.id, verified, 'Setup passkey');
  // Pinned admin-verify directly completes setup; the site step applies its own settings.
  await options.set('emdash:setup_complete', true);
  await options.delete('emdash:setup_state');
  return user;
}
export async function authenticationOptions(context: IdentityContext, trustedIp: string | null,
  validateInput?: () => Promise<unknown>) {
  await requirePasskeyAvailable(context);
  void cleanupExpiredChallenges(context.database).catch(() => {});
  // Pinned options.ts parses after cleanup and before consuming a rate slot.
  await validateInput?.();
  if (trustedIp) {
    const window = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
    const db = identityDb(context.database), key = `${trustedIp}:passkey/options`;
    const result = await sql<{ count: number }>`INSERT INTO _cms_auth_rate_limits (key,"window",count)
      VALUES (${key},${window},1) ON CONFLICT (key,"window")
      DO UPDATE SET count = _cms_auth_rate_limits.count + 1 RETURNING count`.execute(db);
    // Pinned rate-limit.ts: expiry maintenance is probabilistic and best-effort.
    if (Math.random() < 0.01) {
      const cutoff = new Date(Date.now() - 3600 * 1000).toISOString();
      void sql`DELETE FROM _cms_auth_rate_limits WHERE "window" < ${cutoff}`.execute(db).catch(() => {});
    }
    if ((result.rows[0]?.count ?? 1) > 10) throw new AuthFlowError('RATE_LIMITED', 429);
  }
  // Submitted email is deliberately ignored to preserve the pinned nondisclosure boundary.
  return generateAuthenticationOptions(config(context), [], createChallengeStore(context.database));
}
export async function authenticatePasskey(context: IdentityContext, credential: AuthenticationResponse) {
  await requirePasskeyAvailable(context);
  return authenticateWithPasskey(config(context), identityAdapter(context.database) as AuthAdapter, credential, createChallengeStore(context.database));
}
/** Canonical stored hash/absolute expiry; predecessor revocation and issuance share an atomic batch. */
export async function issueSession(context: IdentityContext, user: User, previous: string | undefined) {
  const token = generateToken(), hash = await hashSessionToken(token);
  if (!hash) throw new Error('Generated session token is not canonical');
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const db = identityDb(context.database), oldHash = previous ? await hashSessionToken(previous) : null;
  const statements = [
    ...(oldHash ? [db.deleteFrom('_cms_auth_sessions').where('hash', '=', oldHash).compile()] : []),
    db.insertInto('_cms_auth_sessions').values({ hash, user_id: user.id, expires_at: expiresAt }).compile()
  ];
  await context.database.atomicBatch(statements);
  return { token, expiresAt };
}
