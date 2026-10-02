import { form, getRequestEvent, query } from '$app/server';
import { error } from '@sveltejs/kit';
import * as v from 'valibot';
import { requestIdentity, identityCookiePath } from '$lib/server/auth/identity-request';
import { AuthFlowError, authenticationOptions, authenticatePasskey, beginAdminSetup, finishAdminSetup,
  issueSession, SESSION_MAX_AGE_SECONDS, SETUP_NONCE_COOKIE, SETUP_NONCE_MAX_AGE_SECONDS, setupStatus } from '$lib/server/auth/passkey-flow';
import { registrationCredential, authenticationCredential } from '$lib/server/auth/identity-schemas';
import { PasskeyAuthenticationError } from '$lib/server/auth/vendor/passkey/authenticate';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, SESSION_COOKIE_DELETE_OPTIONS, SessionOriginError } from '$lib/server/auth/request';
import { revokeSession } from '$lib/server/auth/session';
import { createKyselySessionStore } from '$lib/server/auth/store';

function validCredential(schema: v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>, text: string) {
  try { return v.safeParse(schema, JSON.parse(text)).success; } catch { return false; }
}
const registrationText = v.pipe(v.string(),
  v.check(text => validCredential(registrationCredential, text), 'Invalid passkey credential'),
  v.transform(text => v.parse(registrationCredential, JSON.parse(text))));
const authenticationText = v.pipe(v.string(),
  v.check(text => validCredential(authenticationCredential, text), 'Invalid passkey credential'),
  v.transform(text => v.parse(authenticationCredential, JSON.parse(text))));
async function authResponse<T>(action: () => Promise<T>): Promise<T> {
  try { return await action(); }
  catch (cause) {
    if (cause instanceof AuthFlowError) error(cause.status, { code: cause.code, message: 'Authentication request failed' });
    if (cause instanceof SessionOriginError) error(403, { code: cause.code, message: 'Cross-origin session mutation blocked' });
    if (cause instanceof PasskeyAuthenticationError) error(401, { code: 'UNAUTHORIZED', message: 'Authentication failed' });
    error(500, { code: 'AUTH_ERROR', message: 'Authentication request failed' });
  }
}
export const getSetupStatus = query(() => authResponse(() => setupStatus(requestIdentity(getRequestEvent()))));
export const beginSetup = form(v.strictObject({ email: v.pipe(v.string(), v.email()), name: v.optional(v.string()) }),
  input => authResponse(async () => {
    const event = getRequestEvent(), context = requestIdentity(event, true);
    const result = await beginAdminSetup(context, input);
    event.cookies.set(SETUP_NONCE_COOKIE, result.nonce, { path: identityCookiePath(context), httpOnly: true, sameSite: 'strict',
      secure: new URL(context.publicOrigin).protocol === 'https:', maxAge: SETUP_NONCE_MAX_AGE_SECONDS });
    void getSetupStatus().refresh();
    return { options: result.options };
  }));
export const completeSetup = form(v.strictObject({ credential: registrationText }),
  input => authResponse(async () => {
    const event = getRequestEvent(), context = requestIdentity(event, true);
    const user = await finishAdminSetup(context, event.cookies.get(SETUP_NONCE_COOKIE), input.credential);
    event.cookies.delete(SETUP_NONCE_COOKIE, { path: identityCookiePath(context) });
    void getSetupStatus().refresh();
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }));
export const beginLogin = form(v.strictObject({}), () => authResponse(async () => {
  const event = getRequestEvent();
  return { options: await authenticationOptions(requestIdentity(event, true), event.getClientAddress()) };
}));
export const completeLogin = form(v.strictObject({ credential: authenticationText }),
  input => authResponse(async () => {
    const event = getRequestEvent(), context = requestIdentity(event, true);
    const user = await authenticatePasskey(context, input.credential);
    const session = await issueSession(context, user, event.cookies.get(SESSION_COOKIE_NAME));
    event.cookies.set(SESSION_COOKIE_NAME, session.token, { ...SESSION_COOKIE_OPTIONS,
      path: identityCookiePath(context), maxAge: SESSION_MAX_AGE_SECONDS, expires: new Date(session.expiresAt) });
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }));
export const logout = form(v.strictObject({}), () => authResponse(async () => {
  const event = getRequestEvent(), context = requestIdentity(event, true);
  await revokeSession(event.cookies.get(SESSION_COOKIE_NAME), createKyselySessionStore(context.database.db.$pickTables<'_cms_auth_users' | '_cms_auth_sessions'>()));
  event.cookies.delete(SESSION_COOKIE_NAME, { ...SESSION_COOKIE_DELETE_OPTIONS, path: identityCookiePath(context) });
  return { loggedOut: true };
}));
