import { env } from '$env/dynamic/private';
import { base } from '$app/paths';
import { createEnvironmentCmsRuntime } from '$lib/server/runtime/environment';

const runtime = createEnvironmentCmsRuntime(() => env, base);
export const handle = runtime.handle;
