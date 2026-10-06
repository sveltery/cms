// Observe the actual Kit compatibility route modules; no invented route responses.
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../..');
const routes=import.meta.glob('../../src/routes/_emdash/api/media/[id]/usage/+server.ts',{eager:true});
export function injectCoreRoutes(inject:(route:{pattern:string;entrypoint:string})=>void):void {
 if(Object.hasOwn(routes,'../../src/routes/_emdash/api/media/[id]/usage/+server.ts')) {
  inject({pattern:'/_emdash/api/media/[id]/usage',entrypoint:resolve(root,'src/lib/server/media-admin/api/media/_id_/usage.ts')});
 }
}
