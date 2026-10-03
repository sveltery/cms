import {applySetupSeed} from '../../src/lib/server/setup/seed.ts';
import {sourceBlocksContext} from './blocks-source-database.ts';
import {exportReusableBlocksSeed} from '../../src/lib/server/blocks/seed.ts';
// Native seed transports, not the full source applySeed/exportSeed entry points.
export async function applySeed(db:any,seed:any,options:any={}){return (await applySetupSeed(sourceBlocksContext(db).database,seed,options.includeContent??false,{},options)).result;}
export async function exportSeed(db:any,mode:string){return exportReusableBlocksSeed(sourceBlocksContext(db).database,mode==='all');}
