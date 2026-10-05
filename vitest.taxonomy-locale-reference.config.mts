import {defineConfig,mergeConfig} from 'vitest/config';
import source from './vitest.taxonomy-core-source.config.mts';
// Same genuine Source physical reference graph, separate supplemental controls.
export default mergeConfig(source,defineConfig({test:{include:['tests/taxonomy-native/source-locale-reference.test.ts']}}));
