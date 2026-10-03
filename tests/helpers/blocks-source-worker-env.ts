// Node Vitest host, actual Worker D1 binding via the approved asynchronous bridge.
// This is no Cloudflare Vitest-pool execution claim.
import {afterAll} from 'vitest';
import {asyncD1Storage} from './async-d1-storage.ts';
const storage=await asyncD1Storage();
export const env={DB:storage.binding};
afterAll(async()=>{await storage.runtime.dispose();});
