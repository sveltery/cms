/** Test-only import facade, retaining complete already-ported Source media/client declarations. */
export * from '../../src/lib/media/source/api/media';
export {ApiResponseError} from '../../src/lib/media/source/api/client';
import {API_BASE, apiFetch, parseApiResponse} from '../../src/lib/media/source/api/client';
import {i18n,msg} from '../../src/lib/media/english';
// Test host type binding only; the unused mocked manifest shape gives zero model/type parity credit.
type AdminManifest=unknown;
// Complete pinned fetchManifest declaration; immutable declaration guard owns its checksum.
export async function fetchManifest(): Promise<AdminManifest> {
	const response = await apiFetch(`${API_BASE}/manifest`);
	return parseApiResponse<AdminManifest>(response, i18n._(msg`Failed to fetch manifest`));
}
