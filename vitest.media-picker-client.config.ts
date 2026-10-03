import {defineConfig} from 'vitest/config';
import {resolve} from 'node:path';
export default defineConfig({resolve:{alias:{'$app/paths':resolve(import.meta.dirname,'tests/helpers/media-picker-kit-paths.ts')}},test:{fileParallelism:false,include:['tests/media-picker-native/picker-client-native.test.ts','tests/media-picker-native/picker-real-api.integration.ts','tests/blocks-picker-client.integration.ts']}});
