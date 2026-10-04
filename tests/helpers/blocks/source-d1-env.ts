import { afterAll } from 'vitest';
import { asyncD1Storage } from '../async-d1-storage.ts';
// Actual isolated Miniflare/workerd binding. No Worker-pool or production credit.
const storage = await asyncD1Storage();
export const env = { DB:storage.binding };
afterAll(async () => { await storage.runtime.dispose(); });
