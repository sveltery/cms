// Test-only ordinary HTTP facade. Source tests replace apiFetch with their exact mocks.
export function apiFetch(input: string | URL | Request, init?: RequestInit) {
  return fetch(input, init);
}
export async function parseApiResponse<T>(response: Response, fallback: string): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message || `${fallback}: ${response.statusText}`);
  }
  const body = await response.json();
  return body.data;
}
export async function fetchManifest() {
  return parseApiResponse<{ admin?: { logo?: string; siteName?: string } }>(await apiFetch('/_emdash/api/manifest'), 'Failed to fetch manifest');
}
