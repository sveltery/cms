// Scalar portion of pinned ContentEditor state/snapshot semantics, implemented
// for native Kit form receipts. MIT Copyright 2026 Cloudflare Inc.
// Complete Source and remaining editor scope: docs/writable-editor-source.json.
import { describeContentValidationError, editorError, type LabeledEditorField } from './errors.ts';

export interface EditorRecord {
  id: string; type: string; locale: string; _rev: string; status: string;
  slug: string | null; data: Record<string, unknown>; authorId?: string | null;
}
export interface EditorReceipt { id: string; type: string; locale: string; _rev: string }
export interface SavePayload { data: Record<string, unknown>; slug: string; _rev?: string; autosave: boolean }
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const identity = (entry: Pick<EditorRecord, 'type' | 'id' | 'locale'>) => JSON.stringify([entry.type, entry.id, entry.locale]);

export class EditorSession {
  data: Record<string, unknown>;
  slug: string;
  revision: string;
  pending = false;
  conflict = false;
  error: string | undefined;
  private baseline: string;
  private rejected: string | undefined;
  private listeners = new Set<() => void>();
  entry: EditorRecord; writable: boolean; isNew: boolean;
  private fields: Record<string, LabeledEditorField>;
  constructor(entry: EditorRecord, writable: boolean,
    fields: Record<string, LabeledEditorField>, isNew = false) {
    this.entry = entry; this.writable = writable; this.fields = fields; this.isNew = isNew;
    this.data = clone(entry.data); this.slug = entry.slug ?? ''; this.revision = entry._rev;
    this.baseline = this.key();
  }
  private key() { return JSON.stringify({ data: this.data, slug: this.slug }); }
  get changed() { return this.key() !== this.baseline; }
  get dirty() { return this.isNew || this.changed; }
  get canAutosave() { return !this.isNew && this.writable && this.dirty && !this.pending && !this.conflict && this.key() !== this.rejected; }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify() { for (const listener of this.listeners) listener(); }
  edit(data: Record<string, unknown>, slug = this.slug) { this.data = clone(data); this.slug = slug; this.notify(); }
  receive(entry: EditorRecord) {
    if (identity(entry) !== identity(this.entry)) {
      this.entry = entry; this.data = clone(entry.data); this.slug = entry.slug ?? ''; this.revision = entry._rev;
      this.baseline = this.key(); this.conflict = false; this.rejected = undefined; this.error = undefined;
    } else if (!this.pending && !this.dirty && !this.conflict) {
      this.entry = entry; this.data = clone(entry.data); this.slug = entry.slug ?? ''; this.revision = entry._rev;
      this.baseline = this.key();
    }
    this.notify();
  }
  acceptLatestToken(entry: EditorRecord) {
    if (identity(entry) !== identity(this.entry)) throw new Error('The refreshed entry does not match this editor.');
    this.revision = entry._rev; this.entry = entry; this.conflict = false; this.rejected = undefined; this.notify();
  }
  reload(entry: EditorRecord) {
    if (identity(entry) !== identity(this.entry)) throw new Error('The refreshed entry does not match this editor.');
    this.entry = entry; this.data = clone(entry.data); this.slug = entry.slug ?? ''; this.revision = entry._rev;
    this.baseline = this.key(); this.conflict = false; this.error = undefined; this.rejected = undefined; this.notify();
  }
  async save(submit: (payload: SavePayload) => Promise<EditorReceipt>, autosave = false): Promise<boolean> {
    if (!this.writable || this.pending || !this.dirty || (autosave && !this.canAutosave)) return false;
    const payload: SavePayload = { data: clone(this.data), slug: this.slug, _rev: this.revision || undefined, autosave };
    const sent = this.key();
    this.pending = true; this.error = undefined; this.notify();
    try {
      const receipt = await submit(payload);
      if (receipt.type !== this.entry.type || receipt.locale !== this.entry.locale ||
        (!this.isNew && receipt.id !== this.entry.id) || !receipt._rev) throw new Error('The save receipt does not match this entry.');
      this.entry = { ...this.entry, id: receipt.id, _rev: receipt._rev };
      this.revision = receipt._rev; this.baseline = sent; this.isNew = false;
      this.conflict = false; this.rejected = undefined;
      return true;
    } catch (cause) {
      const error = editorError(cause);
      this.error = describeContentValidationError(error, this.fields) ?? error.message;
      this.conflict = error.code === 'CONFLICT' || error.code === 'REVISION_CONFLICT';
      if (!this.conflict && error.status >= 400 && error.status < 500 && ![408, 421, 425, 429].includes(error.status)) this.rejected = sent;
      return false;
    } finally { this.pending = false; this.notify(); }
  }
}
