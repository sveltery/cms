// Read-only review inventory. This does not execute or emulate a transaction.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');
const base = 'parity/emdash/media-usage-maintenance-source/authority/packages/core/src/media/usage/';
const wanted = new Set(['deleteRegistryAndCheckpoint', 'executeCollectionDeletionGuard',
  'executeLocalCollectionDeletionGuard', 'fenceCollection', 'lockLiveTombstone',
  'processWorkBatch', 'processSourceBatch', 'processStatus', 'finalizeDeletion',
  'exactCleanupRowsRemain', 'updateDeletion', 'liveLeaseGuard', 'liveLease', 'timestampOffset']);
const records = [];
for (const file of ['collection-deletion.ts', 'collection-deletion-processor.ts']) {
  const text = readFileSync(resolve(root, base + file + '.txt'), 'utf8');
  const syntax = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) && node.name
        && wanted.has(node.name.getText(syntax))) {
      const exact = node.getText(syntax);
      const position = syntax.getLineAndCharacterOfPosition(node.getStart(syntax));
      records.push({sourcePath:'packages/core/src/media/usage/' + file,
        name:node.name.getText(syntax),line:position.line+1,
        sha256:createHash('sha256').update(exact).digest('hex'),exactSourceFunction:exact});
    }
    ts.forEachChild(node, visit);
  }
  visit(syntax);
}
const phases = [
  {phase:'fence',reads:['live tombstone exact collection ID/slug, leased state, fence phase, lease token and unexpired lease',
    'actual ec_slug live row if forceDelete is false', 'actual collection metadata identity'],
    writes:['guarded no-op tombstone lock', 'conditional status capture_state active -> deleting with actual collection identity'],
    sourceReceipt:'actual affected status row count',nativeReceipt:'actual status UPDATE RETURNING plus genuine content-presence read'},
  {phase:'registry',reads:[],writes:['DELETE exact collection ID/slug WHERE EXISTS exact live registry-phase tombstone',
    'UPDATE exact live registry-phase tombstone to table phase'],sourceReceipt:'actual checkpoint affected-row count',
    nativeReceipt:'actual checkpoint UPDATE RETURNING; preserve Source behavior when registry deletion affects zero rows'},
  {phase:'table',reads:['actual FTS metadata/catalogue required by existing FTS producer',
    'exact live table-phase tombstone'],writes:['existing FTS trigger/table drops', 'DROP TABLE IF EXISTS exact ec_slug'],
    sourceReceipt:'real adapter guard dropped outcome',nativeReceipt:'real whole atomic plan and guarded live tombstone receipt; no synthetic DDL results'},
  {phase:'work',reads:['actual sorted content_id page, collection_id predicate, optional source work cursor, limit51'],
    writes:['DELETE selected <=50 exact work IDs for collection_id, same live phase lease guard',
      'UPDATE exact live work-phase tombstone: work cursor or sources phase, clear attempt/error'],
    sourceReceipt:'actual affected checkpoint count must equal1',nativeReceipt:'actual checkpoint UPDATE RETURNING must have exactly1 row'},
  {phase:'sources',reads:['actual first content source by source_type content + collection_id when source key is absent',
    'actual occurrence ID page for selected source key, optional occurrence cursor, limit51'],
    writes:['DELETE selected <=50 occurrence IDs for source key with exact live sources-phase lease',
      'DELETE source key only when source_type content and collection_id match, exact live sources-phase lease',
      'UPDATE exact live sources-phase tombstone: occurrence cursor/source key or status phase, clear attempt/error'],
    sourceReceipt:'actual affected checkpoint count must equal1',nativeReceipt:'actual checkpoint UPDATE RETURNING must have exactly1 row'},
  {phase:'status',reads:['actual EXISTS work/source/status cleanup metadata, ignoring status for this phase'],
    writes:['DELETE reconciliations by exact collection ID/slug and live status-phase lease',
      'DELETE status by content-media adapter/collection scope/slug/collection ID and live status-phase lease',
      'UPDATE exact live status-phase tombstone to finalize, clear attempt/error'],
    sourceReceipt:'throw on actual remaining work/source; actual checkpoint affected count must equal1',
    nativeReceipt:'same genuine cleanup refusal plus actual checkpoint UPDATE RETURNING must have exactly1 row'},
  {phase:'finalize',reads:['actual content table existence', 'actual work/source/status cleanup existence',
    'actual registry ID/slug existence'],writes:['DELETE exact collection ID/slug leased finalize-phase tombstone with lease token and unexpired lease'],
    sourceReceipt:'real numDeletedRows must equal1',nativeReceipt:'real DELETE RETURNING must have exactly1 row'}
];
const result = {pin:'913cb1bb9b7f08c3ff0d258b4420e53835b6a58e',
  state:'Source review inventory; Native plan implementation and public Seed descriptor qualification pending',
  executor:'sole qualified same-owner Seed read/compile/atomic descriptor; never callback emulation or new general executor',
  bindingLimit:100,sourcePageLimit:51,mutationRowsPerBatch:50,phases,sourceFunctions:records,
  invariants:['retain exact Source lease timestamp comparisons', 'retain exact per-phase guards and collection identity predicates',
    'do not invent a current live collection requirement in post-registry cleanup phases',
    'preserve Source missing/zero-row outcomes, actual count/result hooks and query IDs',
    'Source callback bodies remain immutable in reference witnesses', 'Native whole atomic-batch strengthening is C-07, zero Source D1 callback identity credit']};
writeFileSync(resolve(root, 'parity/emdash/media-usage-maintenance-source/deletion-plan-review-inventory.json'), JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({phases:phases.length,exactSourceFunctions:records.length,productPlansExecuted:0}));
