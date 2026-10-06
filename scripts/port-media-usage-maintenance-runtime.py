"""Port the owned whole repositories with explicit canonical namespace/import substitutions."""
import hashlib
import json
import pathlib
import re
import subprocess

root = pathlib.Path(__file__).resolve().parents[1]
source = pathlib.Path('/tmp/cms-emdash-full')
pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e'
paths = ['database/repositories/media-usage-work.ts',
    'media/usage/reconciliation.ts', 'media/usage/collection-deletion.ts',
    'media/usage/collection-deletion-processor.ts', 'media/usage/reconciliation-processor.ts',
    'media/usage/work-processor.ts', 'media/usage/maintenance-engine.ts',
    'media/usage/content-repair.ts', 'api/handlers/media-usage-work.ts']
records = []
for path in paths:
    origin = 'packages/core/src/' + path
    original = subprocess.check_output(['git', '-C', str(source), 'show', pin + ':' + origin])
    text = original.decode().replace('_emdash_', '_cms_')
    text = re.sub(r'(?<=\.)js(?=["\'])', 'ts', text)
    substitutions = ['_emdash_ physical identifiers -> _cms_', '.js module suffix -> .ts', 'MIT/provenance header']
    if path in ['database/repositories/media-usage-work.ts', 'media/usage/reconciliation.ts', 'media/usage/collection-deletion.ts']:
        text = text.replace('constructor(private db: Kysely<Database>) {}',
            'private db: Kysely<Database>;\n\tconstructor(db: Kysely<Database>) { this.db = db; }')
        substitutions.append('parameter property expanded to identical explicit assignment for Node24 erasable TypeScript')
    if path == 'media/usage/collection-deletion-processor.ts':
        text = text.replace('import { withTransaction } from "../../database/transaction.ts";',
            'import { withTransaction } from "../../database/transaction.ts";\n'
            'import { blockDatabaseHost } from "../../../../blocks/upstream/host.ts";\n'
            'import { NativeMediaUsageCollectionDeletionPhases } from "../../../collection-deletion-phases.ts";')
        for method, native in [('processWorkBatch', 'processWork'), ('processSourceBatch', 'processSources'), ('processStatus', 'processStatus')]:
            pattern = r'(async function ' + method + r'\([\s\S]*?\): Promise<boolean> \{\n)'
            def branch(match, native=native):
                return match.group(1) + '\tconst owner = blockDatabaseHost(db);\n\tif (owner && !owner.atomicQueryLoops) return new NativeMediaUsageCollectionDeletionPhases(owner).' + native + '(claim);\n'
            text, count = re.subn(pattern, branch, text, count=1)
            if count != 1:
                raise RuntimeError('Missing complete Source phase ' + method)
        substitutions.append('finite Native C-07 work/sources/status D1 branch; complete original Node callback bodies retained below')
    header = ('// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.\n'
        '// Complete pinned Source ' + pin + ':' + origin + '.\n'
        '// Canonical physical namespace and module imports are explicit Native substitutions.\n')
    target = root / 'src/lib/server/media-usage/upstream' / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(header + text)
    records.append({'sourcePath': origin, 'nativePath': str(target.relative_to(root)),
        'sourceSha256': hashlib.sha256(original).hexdigest(),
        'nativeSha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'substitutions': substitutions})
origin = 'packages/core/src/api/handlers/media-usage.ts'
original = subprocess.check_output(['git', '-C', str(source), 'show', pin + ':' + origin])
whole = original.decode()
selection = (whole[whole.index('export async function handleMediaUsageProgress('):whole.index('export function aggregateMediaUsageCoverageStatus(')]
    + whole[whole.index('export async function handleMediaUsageRepair('):whole.index('function normalizeMediaUsageCoverageStatus(')])
imports = '''import type { Kysely } from "kysely";
import { MediaUsageRepository } from "../../database/repositories/media-usage.ts";
import type { Database } from "../../database/types.ts";
import { getMediaUsageActivationStatus, MediaUsageActivationVersionMismatchError } from "../../media/usage/activation.ts";
import { repairContentMediaUsageAll, repairContentMediaUsageCollection, type ContentMediaUsageRepairAllResult, type ContentMediaUsageRepairCollectionResult } from "../../media/usage/content-repair.ts";
import { runMediaUsageMaintenanceStep, type MediaUsageMaintenanceContinuation } from "../../media/usage/maintenance-engine.ts";
import { ErrorCode } from "../errors.ts";
import type { MediaUsageProgress, MediaUsageProgressAdvanceResponse, MediaUsageRepairRequest, MediaUsageRepairResponse } from "../schemas/media-usage.ts";
import type { ApiResult } from "../types.ts";
type ContentMediaUsageRepairResult = ContentMediaUsageRepairCollectionResult | ContentMediaUsageRepairAllResult;
'''
target = root / 'src/lib/server/media-usage/upstream/api/handlers/media-usage-progress.ts'
target.write_text('// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.\n'
    '// Complete owned progress and repair functions from pinned Source ' + pin + ':' + origin + '.\n'
    '// Whole Source authority is retained; Media read functions remain with the sole Media owner.\n'
    + imports + '\n' + selection)
records.append({'sourcePath': origin, 'nativePath': str(target.relative_to(root)),
    'sourceSha256': hashlib.sha256(original).hexdigest(), 'nativeSha256': hashlib.sha256(target.read_bytes()).hexdigest(),
    'completeOwnedFunctions': ['handleMediaUsageProgress', 'handleMediaUsageProgressAdvance', 'continuationDelayMs',
        'handleMediaUsageRepair', 'toMediaUsageRepairResponse', 'toMediaUsageRepairCollectionSummary'],
    'substitutions': ['imports narrowed to complete owned functions; sole Media read functions remain with Media113', 'MIT/provenance header']})
(root / 'parity/emdash/media-usage-maintenance-source/native-body-manifest.json').write_text(json.dumps({
    'pin': pin, 'records': records, 'sourceCausalCredit': 0}, indent=2) + '\n')
