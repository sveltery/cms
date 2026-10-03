import {defineConfig} from 'vitest/config';
import {resolve} from 'node:path';
export default defineConfig({resolve:{alias:{'$app/paths':resolve(import.meta.dirname,'tests/helpers/blocks-kit-paths.ts')}},test:{include:['tests/blocks-picker-client.integration.ts']}});
