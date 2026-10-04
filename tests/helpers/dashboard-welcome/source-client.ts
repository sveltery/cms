// Test-only Source API facade; the whole Source test replaces apiFetch itself.
export function apiFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('X-EmDash-Request', '1');
  return fetch(input, { ...init, headers });
}
export async function throwResponseError(response: Response, fallback: string): Promise<never> {
  const body = await response.json().catch(() => ({}));
  throw new Error(body?.error?.message || `${fallback}: ${response.statusText}`);
}
