import {defineConfig} from 'vitest/config';
import source from './vitest.taxonomy-core-source.config.mts';
// Same genuine Source physical reference graph, separate supplemental controls.
export default defineConfig({...source,test:{...source.test,include:['tests/taxonomy-reference/source-locale-reference.test.mjs']}});
