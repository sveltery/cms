// Test-only hosting of the three complete pinned Original Workerd families.
// Exactly one actual Kysely/RawBindingD1 instance; no Source callback fallback.
export * from 'kysely';
import {Kysely as ActualKysely,type KyselyConfig} from 'kysely';
import {RawBindingD1Adapter} from '../../../src/lib/server/database/d1.ts';
import type {CmsDatabase} from '../../../src/lib/server/database/contract.ts';
import {seedSourceDatabase} from '../../../src/lib/server/seed/namespace.ts';
import {RawBindingD1Dialect} from './source-workerd-dialect.ts';
import {originalD1FixtureHandle} from './source-d1-fixture-handle.ts';

export class Kysely<DB> extends ActualKysely<DB> {
 constructor(config:KyselyConfig){
  if(!(config.dialect instanceof RawBindingD1Dialect))throw new Error('Original seed Workerd fixture requires its exact trusted raw dialect');
  super(config);
  const physical=this,adapter=this.getExecutor().adapter;
  if(!(adapter instanceof RawBindingD1Adapter))throw new Error('Original seed Workerd fixture requires its actual raw adapter');
  const owner:CmsDatabase={db:physical as unknown as CmsDatabase['db'],
   atomicBatch(statements){return physical.connection().execute(()=>adapter.executeAtomicBatch(statements));},
   close(){return physical.destroy();}};
  // The unchanged Original setup/reset SQL uses existing qualified isolated
  // transport. Product apply resolves this SAME owner's corresponding guard.
  return originalD1FixtureHandle(seedSourceDatabase(owner),owner) as unknown as Kysely<DB>;
 }
}
