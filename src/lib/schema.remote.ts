import { query, form } from '$app/server';
import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getCollection, getEditorManifest, listCollections } from '$lib/content.remote';
import {
  collectionSlug, createInput, updateInput, addFieldInput,
  convertCollectionCreate, convertCollectionUpdate, convertFieldAdd, fieldLabelFormInput, convertFieldLabel,
  fieldOptionsFormInput, convertFieldOptions, fieldMetadataFormInput, convertFieldMetadata,
  fieldOrderInput, fieldDeleteInput, collectionDeleteInput, collectionOrderInput, convertAdminOperation
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
export const updateSchemaFieldLabel = form(fieldLabelFormInput, input => schemaResponse(async () => {
  const field = await requestSchema('mutation').updateFieldLabel(convertFieldLabel(input));
  refreshSchema(input.collection);
  return { collection: input.collection, field: field.slug };
}));
export const updateSchemaFieldOptions = form(fieldOptionsFormInput, input => schemaResponse(async () => {
  const field = await requestSchema('mutation').updateScalarFieldOptions(convertFieldOptions(input));
  refreshSchema(input.collection);
  return { collection: input.collection, field: field.slug };
}));
export const updateSchemaFieldMetadata = form(fieldMetadataFormInput, input => schemaResponse(async () => {
  const field = await requestSchema('mutation').updateField(convertFieldMetadata(input));
  refreshSchema(input.collection);
  return { collection:input.collection, field:field.slug };
}));
export const reorderSchemaCollections = form(collectionOrderInput, input => schemaResponse(async () => {
  const affected = await requestSchema('mutation').reorderCollections(input);
  refreshSchemaList();
  for (const collection of affected) {
    void getSchemaCollection(collection).refresh();
    void getCollection(collection).refresh();
  }
  return { reordered:true };
}));
export const reorderSchemaFields = form(fieldOrderInput, input => schemaResponse(async () => {
  await requestSchema('mutation').reorderFields(convertAdminOperation(input));
  refreshSchema(input.collection);
  return { collection:input.collection, reordered:true };
}));
export const deleteSchemaField = form(fieldDeleteInput, input => schemaResponse(async () => {
  await requestSchema('mutation').deleteField(convertAdminOperation(input));
  refreshSchema(input.collection);
  return { collection:input.collection, field:input.field, deleted:true };
}));
export const deleteSchemaCollection = form(collectionDeleteInput, async input => {
  await schemaResponse(() => requestSchema('mutation').deleteCollection(convertAdminOperation(input)));
  refreshSchema(input.collection);
  redirect(303,resolve('/schema'));
});

function refreshSchemaList() {
  void listSchemaCollections().refresh();
  void listCollections().refresh();
  void getEditorManifest().refresh();
}

function refreshSchema(collection: string) {
  void listSchemaCollections().refresh();
  void getSchemaCollection(collection).refresh();
  void listCollections().refresh();
  void getCollection(collection).refresh();
  void getEditorManifest().refresh();
}
