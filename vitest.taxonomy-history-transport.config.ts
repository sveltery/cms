import {defineConfig} from 'vitest/config';
import historical from './vitest.taxonomy-history.config.ts';

export default defineConfig({...historical,test:{...historical.test,include:['tests/taxonomy-history/transport.test.ts']}});
