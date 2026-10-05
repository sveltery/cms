/** Native schema REST transport; it never substitutes data for failed requests. */
export async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method, credentials: 'same-origin',
    ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  });
  const result = await response.json();
  if (!response.ok || result.success !== true) throw new Error(result.error?.message ?? 'Schema request failed');
  return result.data as T;
}
