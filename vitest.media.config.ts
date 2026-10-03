import { defineConfig } from 'vitest/config';
export default defineConfig({ test: {
  include: [
    'parity/emdash/media/source-tests/packages/core/tests/integration/database/media-{filename-search,focal-point,folders,mime-filter,page-pagination,replace,upload-publish}.test.ts',
    'parity/emdash/media/source-tests/packages/core/tests/unit/database/repositories/media-confirm.test.ts',
    'parity/emdash/media/source-tests/packages/core/tests/unit/media/{focal-point-normalize,media-value,mime,normalize,placeholder,responsive,thumbnail,url}.test.ts',
    'parity/emdash/media/source-tests/packages/core/tests/unit/storage/{local,s3}.test.ts'
  ]
}});
