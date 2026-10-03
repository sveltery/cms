import { expect, it } from 'vitest';
import { i18n } from '@lingui/core';
import { ApiResponseError } from '../../parity/emdash/writable-editor-source/packages/admin/src/lib/api/client';
import { describeContentValidationError } from '../../parity/emdash/writable-editor-source/packages/admin/src/lib/content-validation-errors';

// Limited original diagnostic of the complete pinned formatter, not a copied
// upstream declaration. No new Source callback/parity credit.
it('complete pinned formatter capitalizes the inherited constructor fallback', () => {
  i18n.loadAndActivate({ locale: 'en', messages: {} });
  const error = new ApiResponseError(400, 'VALIDATION_ERROR', 'raw', { issues: [{ path: 'constructor', code: 'unknown_field' }] });
  expect(describeContentValidationError(error, {})).toBe('Constructor is not a field in this collection.');
});
