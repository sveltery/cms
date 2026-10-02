import { CmsConfigurationError } from './errors.ts';
export { CmsConfigurationError } from './errors.ts';
export { createRequestScopedDb } from './cloudflare-d1.ts';
import type { RequestEvent } from '@sveltejs/kit';
import type { D1Binding } from '../database/d1.ts';
import { createCmsRuntime, type RuntimeConfiguration } from './composition.ts';

type PrivateEnvironment = Record<string, string | undefined>;
type CmsPlatform = { env?: Record<string, unknown>; context?: { waitUntil(task: Promise<void>): void } };

/** Host variables and platform bindings are server-owned; request headers are ignored. */
export function runtimeConfiguration(
  environment: PrivateEnvironment,
  platform?: CmsPlatform,
  basePath = ''
): RuntimeConfiguration | undefined {
  const platformEnv = platform?.env;
  const bindingName = environment.SVELTERY_D1_BINDING;
  const binding = platformEnv?.[bindingName ?? 'CMS_DB'];
  const path = environment.SVELTERY_DATABASE_PATH;
  if (!path && !binding && !bindingName) return undefined;
  const publicOrigin = environment.SVELTERY_PUBLIC_ORIGIN ?? environment.ORIGIN ??
    (typeof platformEnv?.CMS_PUBLIC_ORIGIN === 'string' ? platformEnv.CMS_PUBLIC_ORIGIN : undefined);
  if (!publicOrigin) throw new Error('Configured CMS storage requires SVELTERY_PUBLIC_ORIGIN or ORIGIN');
  const presentation = {
    publicOrigin, basePath, rpName: environment.SVELTERY_RP_NAME ?? 'Sveltery CMS',
    mutationsEnabled: environment.SVELTERY_MUTATIONS_ENABLED !== 'false'
  };
  if (path && (binding || bindingName)) throw new Error('Configure one CMS database runtime per request');
  if (path) return { ...presentation, kind: 'sqlite', path };
  if (!binding || typeof binding !== 'object' || typeof (binding as D1Binding).prepare !== 'function' ||
    typeof (binding as D1Binding).batch !== 'function') {
    throw new CmsConfigurationError(`D1 binding ${bindingName ?? 'CMS_DB'} was not found; declare it in d1_databases`, 'BINDING_NOT_FOUND');
  }
  return {
    ...presentation, kind: 'd1', binding: binding as D1Binding,
    ...(platform?.context ? { keepAlive: (task: Promise<void>) => platform.context!.waitUntil(task) } : {})
  };
}

export function createEnvironmentCmsRuntime(environment: () => PrivateEnvironment, basePath = '') {
  return createCmsRuntime((event: RequestEvent) => runtimeConfiguration(environment(), event.platform as CmsPlatform | undefined, basePath));
}
