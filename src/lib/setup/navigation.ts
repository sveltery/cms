import { base } from '$app/paths';
import type { StartWith } from './client.ts';
export function completionUrl(startWith: StartWith) {
  return startWith === 'import' ? `${base}/settings/transfer?start=import` : `${base}/`;
}
export function navigateAfterSetup(startWith: StartWith) { window.location.assign(completionUrl(startWith)); }
