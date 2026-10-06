import { afterAll } from 'vitest';
import { closeReferenceWorkerdFixture } from './reference-workerd-v2-env.ts';
// isolate=true supplies one genuine runtime/binding per whole Source family.
// Preserve Source within-family sharing; no per-test storage reset is invented.
afterAll(closeReferenceWorkerdFixture);
