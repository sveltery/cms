import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dependencyRoot = process.argv[2] ? path.resolve(process.argv[2]) : root;
const require = createRequire(path.join(dependencyRoot, 'package.json'));
// message-utils is an existing frozen transitive dependency of @lingui/core.
// Its package root and package.json are intentionally not exported.
const linguiRequire = createRequire(require.resolve('@lingui/core'));
const compilerPath = linguiRequire.resolve('@lingui/message-utils/compileMessage');
const compilerPackage = JSON.parse(readFileSync(path.resolve(path.dirname(compilerPath), '../package.json'), 'utf8'));
if (compilerPackage.version !== '5.9.5') throw new Error('Expected frozen @lingui/message-utils 5.9.5');
const { compileMessage } = linguiRequire('@lingui/message-utils/compileMessage');
const { generateMessageId } = linguiRequire('@lingui/message-utils/generateMessageId');

const authority = path.join(root, 'parity/emdash/calendar-locales-source/upstream/packages/admin/src/locales');
const output = path.join(root, 'src/lib/ui/locales');
const notice = '// Generated from whole EmDash 1.1.0 catalogs at 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.\n' +
  '// MIT, Copyright 2026 Cloudflare Inc. See notices/emdash-MIT.txt.\n' +
  '// Reproduce: node scripts/compile-calendar-locales.mjs\n';

// Parse the immutable Lingui PO format. ICU plural/select expressions are in
// msgid/msgstr; gettext plural records are not present in this pinned corpus.
// Unknown fields fail rather than silently dropping authority data.
function parseCatalog(text, filename) {
  const entries = [];
  let entry = { context: '', msgid: undefined, msgstr: undefined, fuzzy: false };
  let field;
  function finish() {
    if (entry.msgid !== undefined) {
      if (entry.msgstr === undefined) throw new Error(`${filename}: missing msgstr`);
      if (entry.msgid !== '') entries.push(entry);
    }
    entry = { context: '', msgid: undefined, msgstr: undefined, fuzzy: false };
    field = undefined;
  }
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim();
    if (!line) { finish(); continue; }
    if (line.startsWith('#~')) continue; // obsolete entries are not compiled
    if (line.startsWith('#')) {
      if (line.startsWith('#,') && line.slice(2).split(',').some(flag => flag.trim() === 'fuzzy')) entry.fuzzy = true;
      continue;
    }
    const declaration = /^(msgctxt|msgid|msgstr)\s+(".*")$/.exec(line);
    if (declaration) {
      field = declaration[1] === 'msgctxt' ? 'context' : declaration[1];
      entry[field] = JSON.parse(declaration[2]);
    } else if (line.startsWith('"') && field) {
      entry[field] += JSON.parse(line);
    } else {
      throw new Error(`${filename}:${index + 1}: unsupported PO syntax`);
    }
  }
  finish();
  const map = new Map();
  for (const item of entries) {
    const id = generateMessageId(item.msgid, item.context);
    if (map.has(id)) throw new Error(`${filename}: duplicate compiled message ID ${id}`);
    map.set(id, item);
  }
  return map;
}

const ledger = JSON.parse(readFileSync(path.join(root, 'docs/calendar-locales-source.json'), 'utf8'));
const english = parseCatalog(readFileSync(path.join(authority, 'en/messages.po'), 'utf8'), 'en/messages.po');
const ids = {};
const contextualIds = {};
for (const [id, entry] of english) {
  if (!entry.context) ids[entry.msgid] = id;
  else (contextualIds[entry.context] ??= {})[entry.msgid] = id;
}
mkdirSync(output, { recursive: true });
writeFileSync(path.join(output, 'ids.ts'), notice +
  '/** Context-free original English msgid → Lingui message ID. */\n' +
  `export const MESSAGE_IDS: Record<string, string> = ${JSON.stringify(ids, null, 2)};\n\n` +
  '/** Original msgctxt → English msgid → Lingui message ID. */\n' +
  `export const MESSAGE_IDS_BY_CONTEXT: Record<string, Record<string, string>> = ${JSON.stringify(contextualIds, null, 2)};\n`);

const summary = [];
for (const row of ledger.files.filter(row => row.upstreamPath.endsWith('/messages.po'))) {
  const locale = row.upstreamPath.split('/').at(-2);
  const catalog = parseCatalog(readFileSync(path.join(root, row.path), 'utf8'), row.upstreamPath);
  const messages = {};
  let fallbackCount = 0;
  for (const [id, entry] of catalog) {
    // Lingui defaults untranslated/fuzzy messages to the source locale.
    const source = english.get(id);
    const translated = entry.fuzzy ? '' : entry.msgstr;
    const message = translated || (source && !source.fuzzy && source.msgstr) || entry.msgid;
    if (!translated) fallbackCount++;
    messages[id] = compileMessage(message);
  }
  const catalogOutput = path.join(output, 'catalogs', locale);
  mkdirSync(catalogOutput, { recursive: true });
  // Pseudo data is retained, but the Native app does not enable the original
  // development-only pseudo injection. Garbled development output is deferred.
  const pseudoNote = locale === 'pseudo' ? '// Native development pseudo garbling is not implemented; this disabled catalog uses source fallback.\n' : '';
  writeFileSync(path.join(catalogOutput, 'messages.mjs'), notice + pseudoNote + `export const messages = ${JSON.stringify(messages)};\n`);
  summary.push({ locale, messages: catalog.size, sourceFallbacks: fallbackCount });
}
console.log(JSON.stringify({ compiler: '@lingui/message-utils@5.9.5', catalogCount: summary.length,
  contextFreeIds: Object.keys(ids).length, contexts: Object.keys(contextualIds).length, catalogs: summary }, null, 2));
