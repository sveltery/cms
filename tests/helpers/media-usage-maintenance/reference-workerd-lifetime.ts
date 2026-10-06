import { afterAll } from 'vitest';
import { closeReferenceWorkerdFixture } from './reference-workerd-env.ts';
const key=Symbol.for('cms.mediaUsage.literalSourceWorkerd.completedFiles');
const shared=globalThis as unknown as Record<symbol,number|undefined>;
// setupFiles executes for each whole family in one non-isolated worker. Imports
// remain cached, so all four families use one genuine runtime and one binding.
afterAll(async()=>{
  shared[key]=(shared[key]??0)+1;
  if(shared[key]===4)await closeReferenceWorkerdFixture();
});
