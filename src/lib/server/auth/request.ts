export const SESSION_COOKIE_NAME = 'cms-session';
/** SvelteKit cookie options; no Domain, role, identity or capability is sent in the cookie. */
export const SESSION_COOKIE_OPTIONS = Object.freeze({ path: '/', httpOnly: true, sameSite: 'lax', secure: true } as const);
export const SESSION_COOKIE_DELETE_OPTIONS = Object.freeze({ ...SESSION_COOKIE_OPTIONS, maxAge: 0, expires: new Date(0) });

export class SessionOriginError extends Error {
  readonly code = 'CSRF_REJECTED';
  constructor() { super('Cross-origin session mutation blocked'); this.name = 'SessionOriginError'; }
}

/** The configured public origin must come from trusted server composition, never forwarded headers. */
export function requireSessionMutationOrigin(request: Request, publicOrigin: string): void {}
