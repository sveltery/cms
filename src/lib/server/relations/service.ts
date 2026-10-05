import { z } from 'zod';
import type { Kysely } from 'kysely';
import { CmsError, type CmsDatabase } from '../database/contract.ts';
import type { ServerPrincipal, Permission } from '../database/service.ts';
import type { Database } from '../database/lifecycle/upstream/database/types.ts';
import { registerRelationDatabase } from './storage.ts';
import { createRelationBody, updateRelationBody, relationListQuery } from './schemas.ts';
import { handleRelationCreate, handleRelationGet, handleRelationList, handleRelationUpdate, handleRelationDelete,
  handleReferenceChildrenGet, handleReferenceParentsGet, type PageOptions } from './handlers.ts';

/** Existing runtime principals and storage only; no auth/DB composition changes. */
export function relationService(database: CmsDatabase, principal: ServerPrincipal | null) {
  registerRelationDatabase(database);
  const db = database.db as unknown as Kysely<Database>;
  const identity = principal && typeof principal.id === 'string' && principal.id.length > 0 && principal.id.length <= 128 && Array.isArray(principal.permissions)
    ? {id:principal.id,permissions:[...principal.permissions]} : null;
  function requirePermission(permission: Permission) {
    if (!identity) throw new CmsError('UNAUTHENTICATED');
    if (!identity.permissions.includes(permission)) throw new CmsError('FORBIDDEN');
  }
  return {
    async create(input: unknown) { requirePermission('schema:manage'); return handleRelationCreate(db, createRelationBody.parse(input)); },
    async get(id: unknown) { requirePermission('schema:read'); return handleRelationGet(db, z.string().parse(id)); },
    async list(input: unknown = {}) { requirePermission('schema:read'); return handleRelationList(db, relationListQuery.parse(input)); },
    async update(id: unknown, input: unknown) { requirePermission('schema:manage'); return handleRelationUpdate(db, z.string().parse(id), updateRelationBody.parse(input)); },
    async delete(id: unknown) { requirePermission('schema:manage'); return handleRelationDelete(db, z.string().parse(id)); },
    async children(collection:string,id:string,relation:string,page:PageOptions={}) { requirePermission('content:read'); return handleReferenceChildrenGet(db,collection,id,relation,page,identity!.permissions.includes('content:read_drafts')); },
    async parents(collection:string,id:string,relation:string,page:PageOptions={}) { requirePermission('content:read'); return handleReferenceParentsGet(db,collection,id,relation,page,identity!.permissions.includes('content:read_drafts')); }
  };
}
