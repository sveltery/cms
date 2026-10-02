import { query, form } from '$app/server';
import { getCollection, getEditorManifest, listCollections } from '$lib/content.remote';
import {
  collectionSlug, createInput, updateInput, addFieldInput,
  convertCollectionCreate, convertCollectionUpdate, convertFieldAdd
} from '$lib/server/schema/schema';
import { requestSchema, schemaResponse } from '$lib/server/schema/request';

export const listSchemaCollections = query(() => schemaResponse(() => requestSchema().listCollections()));
export const getSchemaCollection = query(collectionSlug, collection =>
  schemaResponse(() => requestSchema().getCollection(collection)));
export const createSchemaCollection = form(createInput, input => schemaResponse(async () => {
  const collection = await requestSchema('mutation').createCollection(convertCollectionCreate(input));
  refreshSchema(collection.slug);
  return { slug: collection.slug, version: collection.version, updatedAt: collection.updatedAt };
}));
export const updateSchemaCollection = form(updateInput, input => schemaResponse(async () => {
  const collection = await requestSchema('mutation').updateCollection(convertCollectionUpdate(input));
  refreshSchema(collection.slug);
  return { slug: collection.slug, version: collection.version, updatedAt: collection.updatedAt };
}));
export const addSchemaField = form(addFieldInput, input => schemaResponse(async () => {
  const field = await requestSchema('mutation').addField(convertFieldAdd(input));
  refreshSchema(input.collection);
  return { collection: input.collection, slug: field.slug };
}));

function refreshSchema(collection: string) {
  void listSchemaCollections().refresh();
  void getSchemaCollection(collection).refresh();
  void listCollections().refresh();
  void getCollection(collection).refresh();
  void getEditorManifest().refresh();
}
