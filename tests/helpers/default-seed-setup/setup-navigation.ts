import { navigateTo } from '../../../parity/emdash/default-seed-setup-runtime/source/packages/admin/src/lib/navigation.js';
import type { StartWith } from '../../../src/lib/setup/client.ts';
export function completionUrl(startWith: StartWith) {
  return startWith === 'import' ? '/_emdash/admin/settings/transfer?start=import' : '/_emdash/admin';
}
export function navigateAfterSetup(startWith: StartWith) { navigateTo(completionUrl(startWith)); }
