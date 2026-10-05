import { request } from './request';
export async function fetchCollections() { return (await request<{ items: unknown[] }>('/api/schema/collections')).items; }
export async function fetchRelations() { return (await request<{ items: unknown[] }>('/api/relations')).items; }
export async function fetchBlockTypes() { return (await request<{ items: unknown[] }>('/api/schema/block-types')).items; }
