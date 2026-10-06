import { CmsConfigurationError } from './errors.ts';
export { CmsConfigurationError } from './errors.ts';
export { createRequestScopedDb } from './cloudflare-d1.ts';
import type { RequestEvent } from '@sveltejs/kit';
import type { D1Binding } from '../database/d1.ts';
import { createCmsRuntime, type RuntimeConfiguration } from './composition.ts';

type PrivateEnvironment = Record<string, string | undefined>;
type CmsPlatform = { env?: Record<string, unknown>; ctx?: { waitUntil(task: Promise<void>): void }; context?: { waitUntil(task: Promise<void>): void } };

/** Host variables and platform bindings are server-owned; request headers are ignored. */
export function runtimeConfiguration(
  environment: PrivateEnvironment,
  platform?: CmsPlatform,
  basePath = ''
): RuntimeConfiguration | undefined {
  const platformEnv = platform?.env;
  // Worker string bindings are trusted host configuration, like Node private env.
  const setting = (name: string) => environment[name] ??
    (typeof platformEnv?.[name] === 'string' ? platformEnv[name] as string : undefined);
  const bindingName = setting('SVELTERY_D1_BINDING');
  const binding = platformEnv?.[bindingName ?? 'CMS_DB'];
  const path = setting('SVELTERY_DATABASE_PATH');
  const mediaDirectory = setting('SVELTERY_MEDIA_DIRECTORY');
  if (!path && !binding && !bindingName) return undefined;
  const publicOrigin = setting('SVELTERY_PUBLIC_ORIGIN') ?? setting('ORIGIN') ??
    (typeof platformEnv?.CMS_PUBLIC_ORIGIN === 'string' ? platformEnv.CMS_PUBLIC_ORIGIN : undefined);
  if (!publicOrigin) throw new Error('Configured CMS storage requires SVELTERY_PUBLIC_ORIGIN or ORIGIN');
  const presentation = {
    publicOrigin, basePath, rpName: setting('SVELTERY_RP_NAME') ?? 'Sveltery CMS',
    mutationsEnabled: setting('SVELTERY_MUTATIONS_ENABLED') !== 'false'
  };
  if (path && (binding || bindingName)) throw new Error('Configure one CMS database runtime per request');
  if (mediaDirectory && (!mediaDirectory.trim() || mediaDirectory.includes('\0'))) {
    throw new CmsConfigurationError('SVELTERY_MEDIA_DIRECTORY must name a nonempty directory', 'CONFIGURATION_ERROR');
  }
  if (path) return {
    ...presentation, kind: 'sqlite', path,
    ...(mediaDirectory ? { mediaStorage: { kind: 'local', directory: mediaDirectory } } : {})
  };
  if (mediaDirectory) {
    throw new CmsConfigurationError('SVELTERY_MEDIA_DIRECTORY requires the Node SQLite runtime', 'CONFIGURATION_ERROR');
  }
  if (!binding || typeof binding !== 'object' || typeof (binding as D1Binding).prepare !== 'function' ||
    typeof (binding as D1Binding).batch !== 'function') {
    throw new CmsConfigurationError(`D1 binding ${bindingName ?? 'CMS_DB'} was not found; declare it in d1_databases`, 'BINDING_NOT_FOUND');
  }
  const session = setting('SVELTERY_D1_SESSION');
  if (session && !['disabled', 'auto', 'primary-first'].includes(session)) {
    throw new CmsConfigurationError('SVELTERY_D1_SESSION must be disabled, auto or primary-first', 'CONFIGURATION_ERROR');
  }
  return {
    ...presentation, kind: 'd1', binding: binding as D1Binding,
    ...((session || setting('SVELTERY_D1_COALESCE') || setting('SVELTERY_D1_BOOKMARK_COOKIE')) ? { d1: {
      binding: bindingName ?? 'CMS_DB', session: session as 'disabled' | 'auto' | 'primary-first' | undefined,
      coalesce: setting('SVELTERY_D1_COALESCE') === 'true',
      ...(setting('SVELTERY_D1_BOOKMARK_COOKIE') ? { bookmarkCookie: setting('SVELTERY_D1_BOOKMARK_COOKIE') } : {})
    } } : {}),
    ...((platform?.ctx ?? platform?.context) ? { keepAlive: (task: Promise<void>) => (platform!.ctx ?? platform!.context)!.waitUntil(task) } : {})
  };
}

export function createEnvironmentCmsRuntime(environment: () => PrivateEnvironment, basePath = '') {
  return createCmsRuntime((event: RequestEvent) => runtimeConfiguration(environment(), event.platform as CmsPlatform | undefined, basePath));
}
