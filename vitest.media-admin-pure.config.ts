import {defineConfig} from 'vitest/config';
import {mediaAdminSourceHost} from './tests/helpers/media-admin-source-host.ts';
export default defineConfig({plugins:[mediaAdminSourceHost(import.meta.dirname)],test:{fileParallelism:false,include:['parity/emdash/media/source-tests/packages/admin/tests/lib/media-{search,pagination,playback,file-url}.test.ts']}});
