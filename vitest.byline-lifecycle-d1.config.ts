import {defineConfig,mergeConfig} from 'vitest/config';
import native from './vitest.byline-lifecycle-native.config.ts';
export default mergeConfig(native,defineConfig({define:{__BYLINE_LIFECYCLE_TEST_STORAGE__:JSON.stringify('raw-d1')}}));
