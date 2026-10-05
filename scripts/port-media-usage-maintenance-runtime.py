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
    'media/usage/work-processor.ts', 'media/usage/maintenance-engine.ts']
records = []
for path in paths:
    origin = 'packages/core/src/' + path
    original = subprocess.check_output(['git', '-C', str(source), 'show', pin + ':' + origin])
    text = original.decode().replace('_emdash_', '_cms_')
    text = re.sub(r'(?<=\.)js(?=["\'])', 'ts', text)
    header = ('// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.\n'
        '// Complete pinned Source ' + pin + ':' + origin + '.\n'
        '// Canonical physical namespace and module imports are explicit Native substitutions.\n')
    target = root / 'src/lib/server/media-usage/upstream' / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(header + text)
    records.append({'sourcePath': origin, 'nativePath': str(target.relative_to(root)),
        'sourceSha256': hashlib.sha256(original).hexdigest(),
        'nativeSha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'substitutions': ['_emdash_ physical identifiers -> _cms_', '.js module suffix -> .ts', 'MIT/provenance header']})
(root / 'parity/emdash/media-usage-maintenance-source/native-body-manifest.json').write_text(json.dumps({
    'pin': pin, 'records': records, 'sourceCausalCredit': 0}, indent=2) + '\n')
