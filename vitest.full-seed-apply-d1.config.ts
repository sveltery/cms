import {defineConfig,mergeConfig} from 'vitest/config';
import original from './vitest.full-seed-apply.config.ts';
export default mergeConfig(original,defineConfig({define:{__SEED_TEST_STORAGE__:JSON.stringify('raw-d1')}}));
