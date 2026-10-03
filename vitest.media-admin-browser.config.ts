import {defineConfig} from 'vitest/config';
import {playwright} from '@vitest/browser-playwright';
import {mediaAdminSourceHost} from './tests/helpers/media-admin-source-host.ts';
export default defineConfig({plugins:[mediaAdminSourceHost(import.meta.dirname)],test:{fileParallelism:false,include:['parity/emdash/media/source-tests/packages/admin/tests/lib/media-{upload,folders,search,pagination,playback,file-url,thumbnail}.test.ts'],browser:{enabled:true,headless:true,provider:playwright({launchOptions:{chromiumSandbox:true,timeout:30000}}),instances:[{browser:'chromium'}]}}});
