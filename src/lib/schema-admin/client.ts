async function apiRequest<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin' });
  const result = await response.json();
  if (!response.ok || result.success !== true) throw new Error(result.error?.message ?? 'Schema request failed');
  return result.data as T;
}
export async function fetchCollections() { return (await apiRequest<{ items: unknown[] }>('/api/schema/collections')).items; }
export async function fetchRelations() { return (await apiRequest<{ items: unknown[] }>('/api/relations')).items; }
export async function fetchBlockTypes() { return (await apiRequest<{ items: unknown[] }>('/api/schema/block-types')).items; }
