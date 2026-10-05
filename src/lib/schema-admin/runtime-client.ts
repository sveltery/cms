import type { Collection, Field } from '../server/database/contract';
import { request } from './request';
export type CollectionWithFields = Collection & { fields: Field[] };
export const adminClient = {
  async listCollections() { return (await request<{items:Collection[]}>('/api/schema/collections')).items; },
  async getCollection(slug: string) { return (await request<{item:CollectionWithFields}>(`/api/schema/collections/${encodeURIComponent(slug)}`)).item; },
  async createCollection(input: unknown) { return (await request<{item:Collection}>('/api/schema/collections','POST',input)).item; },
  async updateCollection(collection: Collection, input: unknown) { return (await request<{item:Collection}>(`/api/schema/collections/${encodeURIComponent(collection.slug)}`,'PUT',{input,expected:{version:collection.version,updatedAt:collection.updatedAt}})).item; },
  async addField(collection: Collection, input: unknown) { return request(`/api/schema/collections/${encodeURIComponent(collection.slug)}/fields`,'POST',{input,expectedSchemaVersion:collection.version}); },
  async updateField(collection: string, field: string, input: {slug?:string}) { const {slug:_slug,...metadata}=input; return request(`/api/schema/collections/${encodeURIComponent(collection)}/fields/${encodeURIComponent(field)}`,'PUT',metadata); },
  async deleteField(collection: string, field: string, options?: {deleteRelation?:boolean}) {
    if(options?.deleteRelation) throw new Error('Deleting a bound relationship requires the relations service');
    return request(`/api/schema/collections/${encodeURIComponent(collection)}/fields/${encodeURIComponent(field)}`,'DELETE');
  },
  async deleteCollection(collection: string) { return request(`/api/schema/collections/${encodeURIComponent(collection)}`,'DELETE',{force:false}); },
  async reorderCollections(slugs: string[]) { return request('/api/schema/collections/reorder','POST',slugs); },
  async reorderFields(collection: string, fields: string[]) { return request(`/api/schema/collections/${encodeURIComponent(collection)}/fields/reorder`,'POST',fields); }
};
