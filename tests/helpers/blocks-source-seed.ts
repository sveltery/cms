import {applySetupSeed} from '../../src/lib/server/setup/seed.ts';
import {sourceBlocksContext} from './blocks-source-database.ts';
// Initial source-host baseline: actual installed seed implementation rejects
// blockTypes before source assertions. This is zero assertion-red credit.
export async function applySeed(db:any,seed:any,options:any={}){return (await applySetupSeed(sourceBlocksContext(db).database,seed,options.includeContent??false)).result;}
export async function exportSeed(){throw new Error('Native reusable block export is not implemented');}
