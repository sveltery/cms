// Original test-only dedicated database fixture; never imported by application source.
import { openD1 } from '../../src/lib/server/database/d1.ts';
import { asyncD1StorageFor } from './async-d1-storage.ts';

export async function localD1(path?: string, script:string|readonly FixtureWorkerModule[] = 'export default { fetch() { return new Response("fixture"); } }') {
  const { runtime, binding } = await asyncD1StorageFor('cms-test-d1', path, script);
  return { runtime, binding, database: openD1(binding) };
}
