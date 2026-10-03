import {resolve,dirname} from 'node:path';
import type {Plugin} from 'vite';
export function mediaAdminSourceHost(root:string):Plugin{
 const frozen=resolve(root,'parity/emdash/media/source-tests/packages/admin');
 return {name:'immutable-media-admin-api-host',enforce:'pre',resolveId(specifier,importer){
  if(!importer?.startsWith(frozen)||!specifier.startsWith('.'))return;
  const target=resolve(dirname(importer),specifier).replace(/\.(js|tsx?)$/,'');
  if(target===resolve(frozen,'src/lib/api/media'))return resolve(root,'src/lib/media/source/api/media.ts');
  if(target===resolve(frozen,'src/lib/api/client'))return resolve(root,'src/lib/media/source/api/client.ts');
  if(target===resolve(frozen,'src/lib/media-utils'))return resolve(root,'src/lib/media/source/media-utils.ts');
 }};
}
