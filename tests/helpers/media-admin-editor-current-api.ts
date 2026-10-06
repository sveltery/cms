// Controlled existing Source Role fixture -> actual application route exports.
// No server, live session, identity producer or storage stand-in.
import type {RequestEvent} from '@sveltejs/kit';
import {vi} from 'vitest';
import type {CmsDatabase} from '../../src/lib/server/database/contract.ts';
import {servicePrincipal} from '../../src/lib/server/auth/composition.ts';
import {Role} from '../../src/lib/server/auth/roles.ts';

const modules=import.meta.glob('../../src/routes/**/+server.ts');
export function bindCurrentMediaApi(database:CmsDatabase) {
  vi.stubGlobal('fetch',async(input:string|URL|Request,init:RequestInit={})=>{
    const url=new URL(input instanceof Request?input.url:String(input),'http://localhost');
    const headers=new Headers(init.headers);headers.set('Origin','http://localhost');
    const request=new Request(url,{...init,headers});
    const folder=/^\/_emdash\/api\/media\/folders\/([^/]+)$/.exec(url.pathname);
    const media=url.pathname==='/_emdash/api/media/folders'?null:/^\/_emdash\/api\/media\/([^/]+)$/.exec(url.pathname);
    const path=folder?'_emdash/api/media/folders/[id]':media?'_emdash/api/media/[id]':url.pathname.slice(1);
    const load=modules[`../../src/routes/${path}/+server.ts`];
    if(!load)throw new Error(`Actual current media route absent: ${path}`);
    const routes=await load() as Record<string,(event:RequestEvent)=>Promise<Response>>;
    const route=routes[request.method];if(!route)throw new Error(`Actual media method absent: ${request.method} ${path}`);
    return route({request,url,params:{id:decodeURIComponent(folder?.[1]??media?.[1]??'')},locals:{cms:{database,mutationsEnabled:true,principal:servicePrincipal({id:'source-client-owner',role:Role.EDITOR})},cmsRuntime:{publicOrigin:'http://localhost',basePath:'',rpName:'CMS'}}} as unknown as RequestEvent);
  });
  return ()=>vi.unstubAllGlobals();
}
