"""Copy complete immutable Source families; no product implementation is copied here."""
import hashlib
import json
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[1]
source = pathlib.Path('/tmp/cms-emdash-full')
pin = '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e'
dest = root / 'parity/emdash/media-usage-maintenance-source'
paths = subprocess.check_output(['git', '-C', str(source), 'ls-tree', '-r', '--name-only', pin]).decode().splitlines()
owned_names = {
    'media-usage-work-repository', 'media-usage-work-operator', 'media-usage-work-processor',
    'media-usage-incremental-work-migration', 'media-usage-collection-deletion-foundation',
    'media-usage-collection-deletion-lifecycle', 'media-usage-collection-deletion-migration',
    'media-usage-collection-deletion-operator', 'media-usage-collection-deletion-processor',
    'media-usage-collection-deletion-d1', 'media-usage-reconciliation-foundation',
    'media-usage-reconciliation-scan', 'media-usage-reconciliation-finalization',
    'media-usage-progress-plan', 'media-usage-maintenance-engine-d1',
    'media-usage-scheduled-driver', 'media-usage-projection-admission-runtime',
    'media-usage-runtime-refresh', 'media-usage-content-repair',
    'media-usage-progress-route', 'media-usage-work-route',
    'media-usage-collection-deletion-route', 'media-usage-repair-route',
    'media-usage-repair-auth', 'media-usage-write-fence',
}
records = []
for path in paths:
    is_test = path.startswith('packages/core/tests/') and 'media-usage' in path
    is_authority = path.startswith('packages/core/src/') and (
        '/media/usage/' in path or 'media-usage' in path)
    is_helper = path in {'packages/core/tests/utils/test-db.ts',
        'packages/core/tests/workerd/d1-schema.ts', 'packages/core/src/request-context.ts',
        'packages/core/src/emdash-runtime.ts', 'packages/core/src/scheduler-health.ts',
        'packages/core/src/schema/registry.ts', 'packages/core/src/database/transaction.ts',
        'packages/core/src/astro/integration/routes.ts', 'packages/core/src/database/types.ts',
        'packages/core/src/plugins/scheduler/types.ts', 'LICENSE'}
    if not (is_test or is_authority or is_helper):
        continue
    data = subprocess.check_output(['git', '-C', str(source), 'show', pin + ':' + path])
    executable = is_test or path == 'packages/core/tests/utils/test-db.ts'
    relative = ('upstream/' + path) if executable else ('authority/' + path + '.txt')
    target = dest / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    name = pathlib.PurePosixPath(path).name.removesuffix('.test.ts')
    records.append({'sourcePath': path, 'copiedPath': str(target.relative_to(root)),
        'gitBlob': subprocess.check_output(['git', '-C', str(source), 'rev-parse', pin + ':' + path]).decode().strip(),
        'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
        'ownedWholeFamily': is_test and name in owned_names,
        'state': 'immutable-test-first; execution pending; zero causal credit'})
(dest / 'manifest.json').write_text(json.dumps({'pin': pin, 'records': records}, indent=2) + '\n')
print(json.dumps({'copiedFiles': len(records), 'wholeOwnedFamilies': sum(r['ownedWholeFamily'] for r in records),
    'copiedBytes': sum(r['bytes'] for r in records)}))
