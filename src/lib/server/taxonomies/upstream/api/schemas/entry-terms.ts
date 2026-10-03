// Exact pin core/src/api/schemas/content.ts:317–321, Copyright2026 Cloudflare Inc.MIT.
import {z} from 'zod';
export const contentTermsBody=z.object({termIds:z.array(z.string())}).meta({id:'ContentTermsBody'});
