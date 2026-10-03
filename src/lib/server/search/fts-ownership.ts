// Source-derived FTSManager DDL ownership: EmDash 1.1.0, commit
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e, FTSManager blob
// 1de7650597123a72b11a2ca8ae45ce367a1fe290. Copyright (c) Cloudflare, Inc.
// SPDX-License-Identifier: MIT. See notices/emdash-MIT.txt.
// Search owner's recognition corrections: bf2a4e9 / 19f8cac; native source
// order/config regression evidence remains in that feature's owning worktree.
const SEARCH_TOKENIZERS = ['porter unicode61', 'unicode61', 'trigram'] as const;
type SearchTokenizer = typeof SEARCH_TOKENIZERS[number];

/** Native startup ownership recognition. It grants no search permissions. */
export interface FtsOwnerMetadata {
  id: string;
  slug: string;
  searchConfig: string | null;
  /** Complete declared fields; indexed order is read from the actual virtual SQL. */
  fields: readonly {slug: string; type: string; searchable: number}[];
}
export interface FtsCatalogueObject { name: string; type: string; tbl_name: string; sql: string | null }
export interface ReadOnlyOwnershipGuard { sql: string; parameters: readonly (string | number | null)[] }
export interface RecognizedFtsOwner {
  table: string;
  contentTable: string;
  owner: FtsOwnerMetadata;
  objects: readonly FtsCatalogueObject[];
  metadataGuard: ReadOnlyOwnershipGuard;
}
const identifier = /^[a-z][a-z0-9_]*$/;

/** One JSON binding covers every owner/field without exceeding D1's bind limit. */
export function ftsMetadataGuard(owners: readonly FtsOwnerMetadata[]): ReadOnlyOwnershipGuard {
  return {sql:`NOT EXISTS (SELECT 1 FROM json_each(?) AS owner WHERE
    NOT EXISTS (SELECT 1 FROM _cms_collections WHERE id=json_extract(owner.value,'$.id')
      AND slug=json_extract(owner.value,'$.slug') AND search_config IS json_extract(owner.value,'$.searchConfig'))
    OR (SELECT COUNT(*) FROM _cms_fields WHERE collection_id=json_extract(owner.value,'$.id')) <> json_array_length(owner.value,'$.fields')
    OR EXISTS (SELECT 1 FROM json_each(owner.value,'$.fields') AS declared WHERE
      NOT EXISTS (SELECT 1 FROM _cms_fields WHERE collection_id=json_extract(owner.value,'$.id')
        AND slug=json_extract(declared.value,'$.slug') AND type=json_extract(declared.value,'$.type')
        AND searchable=json_extract(declared.value,'$.searchable'))))`,parameters:[JSON.stringify(owners)]};
}
// Ignore formatting only outside quoted SQL tokens. String literals (including
// Portable Text's separator and tokenizer) must remain byte-exact.
function normalized(value: string): string {
  let result = '', quote = '';
  for(let index=0; index<value.length; index++) {
    const character = value[index];
    if(quote) {
      result += character;
      if(character === quote) {
        if(value[index+1] === quote) result += value[++index];
        else quote = '';
      }
    } else if(character === "'" || character === '"' || character === '`') {
      quote = character; result += character;
    } else if(!/\s/.test(character)) result += character;
  }
  return result;
}

/** Exact source-generated nine-object layout, limited to the reserved vN collision.
 * The source enableSearch requires searchable fields; it does not require supports.
 * Unknown operators, malformed configs, partial groups and legacy trigger SQL fail.
 */
export function recognizeVersionedFtsOwner(owner: FtsOwnerMetadata, objects: readonly FtsCatalogueObject[]): RecognizedFtsOwner | null {
  if (!identifier.test(owner.slug) || !/_v[0-9]+$/.test(owner.slug) || !owner.id) return null;
  if (owner.searchConfig !== null) {
    let config: unknown;
    try { config = JSON.parse(owner.searchConfig); } catch { return null; }
    if (typeof config !== 'object' || config === null || !('enabled' in config) || typeof config.enabled !== 'boolean') return null;
    if ('tokenize' in config && !SEARCH_TOKENIZERS.includes(config.tokenize as SearchTokenizer)) return null;
  }
  if (owner.fields.some(field => !identifier.test(field.slug))) return null;
  const declared = owner.fields.filter(field => field.searchable === 1);
  if (!declared.length || new Set(declared.map(field=>field.slug)).size !== declared.length) return null;
  const table = `_cms_fts_${owner.slug}`, contentTable = `ec_${owner.slug}`;
  const main = objects.find(object=>object.name===table);
  if(!main?.sql) return null;
  const virtual = normalized(main.sql).match(new RegExp(`^CREATEVIRTUALTABLE"${table}"USINGfts5\\(idUNINDEXED,localeUNINDEXED,([a-z0-9_,]+),tokenize='(porter unicode61|unicode61|trigram)'\\)$`));
  if(!virtual) return null;
  const names = virtual[1].split(','), tokenize = virtual[2];
  if(names.length !== declared.length || new Set(names).size !== names.length || names.some(name=>!declared.some(field=>field.slug===name))) return null;
  const fields = names.map(name=>declared.find(field=>field.slug===name)!);
  const columns = ['id UNINDEXED','locale UNINDEXED',...names].join(', ');
  const value = (field: typeof fields[number]) => {
    const ref = `NEW.${field.slug}`;
    return field.type !== 'portableText' ? ref : `CASE WHEN ${ref} IS NULL THEN NULL WHEN json_valid(${ref}) AND json_type(${ref}) IN ('array', 'object') THEN (SELECT group_concat(j.value, ' ') FROM json_tree(${ref}) AS j WHERE j.key IN ('text', 'alt', 'caption', 'code') AND j.type = 'text') ELSE ${ref} END`;
  };
  const values = fields.map(value).join(', '), list = names.join(', ');
  const changed = ['deleted_at','locale',...names].map(name=>`OLD.${name} IS NOT NEW.${name}`).join(' OR ');
  // These templates mirror the pinned FTSManager CREATE statements and the
  // SQLite FTS5-generated shadows. Real Node/D1 captured fixtures enforce this.
  const definitions: [string,string,string,string][] = [
    [table,'table',table,`CREATE VIRTUAL TABLE "${table}" USING fts5(${columns}, tokenize='${tokenize}')`],
    [`${table}_data`,'table',`${table}_data`,`CREATE TABLE '${table}_data'(id INTEGER PRIMARY KEY, block BLOB)`],
    [`${table}_idx`,'table',`${table}_idx`,`CREATE TABLE '${table}_idx'(segid, term, pgno, PRIMARY KEY(segid, term)) WITHOUT ROWID`],
    [`${table}_content`,'table',`${table}_content`,`CREATE TABLE '${table}_content'(id INTEGER PRIMARY KEY, ${Array.from({length:fields.length+2},(_,index)=>`c${index}`).join(', ')})`],
    [`${table}_docsize`,'table',`${table}_docsize`,`CREATE TABLE '${table}_docsize'(id INTEGER PRIMARY KEY, sz BLOB)`],
    [`${table}_config`,'table',`${table}_config`,`CREATE TABLE '${table}_config'(k PRIMARY KEY, v) WITHOUT ROWID`],
    [`${table}_insert`,'trigger',contentTable,`CREATE TRIGGER "${table}_insert" AFTER INSERT ON "${contentTable}" WHEN NEW.deleted_at IS NULL BEGIN INSERT OR REPLACE INTO "${table}"(rowid, id, locale, ${list}) VALUES (NEW.rowid, NEW.id, NEW.locale, ${values}); END`],
    [`${table}_update`,'trigger',contentTable,`CREATE TRIGGER "${table}_update" AFTER UPDATE ON "${contentTable}" WHEN ${changed} BEGIN DELETE FROM "${table}" WHERE rowid = OLD.rowid; INSERT INTO "${table}"(rowid, id, locale, ${list}) SELECT NEW.rowid, NEW.id, NEW.locale, ${values} WHERE NEW.deleted_at IS NULL; END`],
    [`${table}_delete`,'trigger',contentTable,`CREATE TRIGGER "${table}_delete" AFTER DELETE ON "${contentTable}" BEGIN DELETE FROM "${table}" WHERE rowid = OLD.rowid; END`]
  ];
  if (objects.length !== definitions.length || new Set(objects.map(object=>object.name)).size !== definitions.length) return null;
  for (const [name,type,tbl_name,sql] of definitions) {
    const actual = objects.find(object=>object.name===name);
    if (!actual || actual.type !== type || actual.tbl_name !== tbl_name || actual.sql === null || normalized(actual.sql) !== normalized(sql)) return null;
  }
  return {table,contentTable,owner,objects:[...objects],metadataGuard:ftsMetadataGuard([owner])};
}
