import * as v from 'valibot';
import { editorManifest } from '../content/manifest.ts';
import { CmsError, type CmsDatabase } from './contract.ts';
import { DraftRepository } from './entries.ts';
import { SchemaRegistry } from './registry.ts';
import { createDraftInput, deleteDraftInput, getDraftInput, identifier, localeInput, parse, updateDraftInput } from './validation.ts';

// Permission names and ownership rules follow EmDash auth/rbac.ts.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
export type Permission = 'schema:read' | 'schema:manage' | 'content:read' | 'content:read_drafts'
  | 'content:create' | 'content:edit_own' | 'content:edit_any' | 'content:delete_own' | 'content:delete_any';
export interface ServerPrincipal { readonly id: string; readonly permissions: readonly Permission[] }
const listInput = v.strictObject({
  type: identifier, locale: v.optional(localeInput, 'en'),
  limit: v.optional(v.pipe(v.number(), v.safeInteger(), v.minValue(1))),
  cursor: v.optional(v.pipe(v.string(), v.maxLength(2048)))
});
const addFieldInput = v.strictObject({
  collection: identifier, input: v.unknown(),
  expectedSchemaVersion: v.pipe(v.number(), v.safeInteger(), v.minValue(1))
});

/**
 * Compose only with a principal resolved by trusted server authentication.
 * Inputs carry neither identity, roles, permissions nor ownership.
 * This module never installs a principal, database, hook or public write endpoint.
 */
export function cmsService(database: CmsDatabase, principal: ServerPrincipal | null) {
  const identity = principal && typeof principal.id === 'string' && principal.id.length > 0 && principal.id.length <= 128
    && Array.isArray(principal.permissions)
    ? { id: principal.id, permissions: [...principal.permissions] } : null;
  const registry = new SchemaRegistry(database);
  const entries = new DraftRepository(database);
  function authenticated() {
    if (!identity) throw new CmsError('UNAUTHENTICATED');
    return identity;
  }
  function requirePermission(permission: Permission) {
    const actor = authenticated();
    if (!actor.permissions.includes(permission)) throw new CmsError('FORBIDDEN');
    return actor;
  }
  function requireMutationPermission(own: Permission, any: Permission) {
    const actor = authenticated();
    if (!actor.permissions.includes(own) && !actor.permissions.includes(any)) throw new CmsError('FORBIDDEN');
    return actor;
  }
  async function mutationOwner(input: { type: string; id: string; locale: string }, actor: ServerPrincipal, any: Permission) {
    const entry = await entries.findById(input.type, input.id, input.locale);
    if (!entry) throw new CmsError('NOT_FOUND');
    if (actor.permissions.includes(any)) return undefined;
    if (entry.authorId !== actor.id) throw new CmsError('FORBIDDEN');
    return actor.id;
  }
  return {
    async getEditorManifest() { return editorManifest(database, identity); },
    async listCollections() { requirePermission('schema:read'); return registry.listCollections(); },
    async getCollection(input: unknown) {
      requirePermission('schema:read');
      const definition = await registry.getCollectionWithFields(input);
      if (!definition) throw new CmsError('NOT_FOUND');
      return definition;
    },
    async createCollection(input: unknown) { requirePermission('schema:manage'); return registry.createCollection(input); },
    async addField(input: unknown) {
      requirePermission('schema:manage');
      const value = parse(addFieldInput, input);
      return registry.createField(value.collection, value.input, value.expectedSchemaVersion);
    },
    async createDraft(input: unknown) {
      const actor = requirePermission('content:create');
      return entries.create(parse(createDraftInput, input), actor.id);
    },
    async getDraft(input: unknown) {
      requirePermission('content:read'); requirePermission('content:read_drafts');
      const value = parse(getDraftInput, input);
      const entry = await entries.findById(value.type, value.id, value.locale);
      if (!entry) throw new CmsError('NOT_FOUND');
      return entry;
    },
    async listDrafts(input: unknown) {
      requirePermission('content:read'); requirePermission('content:read_drafts');
      const { type, ...options } = parse(listInput, input);
      return entries.list(type, options);
    },
    async updateDraft(input: unknown) {
      // Check general permission before even parsing or reading a record.
      const actor = requireMutationPermission('content:edit_own', 'content:edit_any');
      const value = parse(updateDraftInput, input);
      const owner = await mutationOwner(value, actor, 'content:edit_any');
      return entries.update(value, owner);
    },
    async deleteDraft(input: unknown) {
      const actor = requireMutationPermission('content:delete_own', 'content:delete_any');
      const value = parse(deleteDraftInput, input);
      const owner = await mutationOwner(value, actor, 'content:delete_any');
      return entries.delete(value, owner);
    }
  };
}
