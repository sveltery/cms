import { GET as read } from '../../../src/routes/api/content/[collection]/[id]/references/[relation]/children/+server.ts';
import { nativeContext } from './routes.ts';
export const GET=(ctx:Parameters<typeof nativeContext>[0])=>read(nativeContext(ctx) as Parameters<typeof read>[0]);
