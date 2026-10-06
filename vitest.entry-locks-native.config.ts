import { defineConfig } from 'vitest/config';
// The complete Node test-runner storage family and mounted jsdom family have dedicated runners.
export default defineConfig({test:{environment:'node',fileParallelism:false,
 include:['tests/entry-locks-native/*.test.{ts,mjs}'],
 exclude:['tests/entry-locks-native/canonical-storage.test.ts','tests/entry-locks-native/editor-mounted.test.ts','tests/entry-locks-native/write-boundaries.test.ts']
}});
