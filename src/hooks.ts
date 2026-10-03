import type { Transport } from '@sveltejs/kit';
import { jsonOwnKeys } from './lib/json-transport.ts';

export const transport = { CmsJsonOwnKeys: jsonOwnKeys } satisfies Transport;
