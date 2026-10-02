import type { Handle, RequestEvent } from '@sveltejs/kit';
import { createCmsHandle } from '../auth/composition.ts';
import type { D1Binding } from '../database/d1.ts';

export interface RuntimePresentation {
  publicOrigin: string;
  basePath?: string;
  rpName?: string;
  mutationsEnabled?: boolean;
}
export type RuntimeConfiguration = RuntimePresentation & (
  { kind: 'sqlite'; path: string } |
  { kind: 'd1'; binding: D1Binding }
);

export interface CmsRuntime {
  handle: Handle;
  close(): Promise<void>;
}

/** Request configuration is supplied by the hosting owner, never a client claim. */
export function createCmsRuntime(
  _configuration: (event: RequestEvent) => RuntimeConfiguration | undefined | Promise<RuntimeConfiguration | undefined>
): CmsRuntime {
  return { handle: createCmsHandle(() => undefined), async close() {} };
}
