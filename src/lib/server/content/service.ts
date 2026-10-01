import * as v from 'valibot';
import { contentId, draft, revision } from './schema.ts';

// Provisional slice contracts, not a persisted schema or final permission model.
export type Capability = 'content:read' | 'content:write';
export interface Principal { id: string; capabilities: readonly Capability[] }
export interface ContentDraft { title: string; body: string }
export interface ContentRecord extends ContentDraft { id: string }
export interface ContentRepository {
  list(): Promise<ContentRecord[]>;
  get(id: string): Promise<ContentRecord | null>;
  create(value: ContentDraft): Promise<ContentRecord>;
  update(id: string, value: ContentDraft): Promise<ContentRecord | null>;
  delete(id: string): Promise<boolean>;
}
export class ContentError extends Error {
  code: 'unauthenticated' | 'forbidden' | 'not-found';
  constructor(code: ContentError['code']) { super(code); this.code = code; }
}

export function authorize(principal: Principal | null, capability: Capability) {
  if (!principal) throw new ContentError('unauthenticated');
  if (!principal.capabilities.includes(capability)) throw new ContentError('forbidden');
}

export function contentService(repository: ContentRepository, principal: Principal | null) {
  return {
    async list() {
      authorize(principal, 'content:read');
      return repository.list();
    },
    async get(input: unknown) {
      authorize(principal, 'content:read');
      const value = await repository.get(v.parse(contentId, input));
      if (!value) throw new ContentError('not-found');
      return value;
    },
    async create(input: unknown) {
      authorize(principal, 'content:write');
      return repository.create(v.parse(draft, input));
    },
    async update(input: unknown) {
      authorize(principal, 'content:write');
      const { id, ...value } = v.parse(revision, input);
      const record = await repository.update(id, value);
      if (!record) throw new ContentError('not-found');
      return record;
    },
    async delete(input: unknown) {
      authorize(principal, 'content:write');
      if (!await repository.delete(v.parse(contentId, input))) throw new ContentError('not-found');
    }
  };
}
