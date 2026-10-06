import fs from 'node:fs';
import path from 'node:path';

/** Complete actual package exports; no replacement functions or export subsets. */
export function createReferencePackageResolver(root: string, directory = '/tmp/plugin127-complete-reference-packages') {
  const source = path.join(root, 'parity/emdash/plugin-runtime/source');
  const inventory = JSON.parse(fs.readFileSync(path.join(root, 'parity/emdash/plugin-runtime/inventory.json'), 'utf8'));
  const proposal = JSON.parse(fs.readFileSync(path.join(root, 'parity/emdash/plugin-runtime/reference-external-acquisition-proposal.json'), 'utf8'));
  const qualified = JSON.parse(fs.readFileSync(path.join(directory, 'qualified-package-map.json'), 'utf8'));
  if (qualified.approvedProposalSha256 !== '447753f6dd3567e57fd0d7ca5c2a0572f6117762e44e8eccaf8bbef63c3313ad') throw new Error('Unqualified isolated Reference graph');
  const packages = new Map<string, string>(qualified.packages.map((row: any) => [row.packageKey, row.actualPackageDirectory]));
  const snapshots = new Map<string, any>(proposal.completeSelectedExternalLockClosure.map((row: any) => [row.packageKey, row.sourceSnapshot]));
  function entry(directory: string, name: string, specifier: string): string {
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
    if (manifest.name !== name) throw new Error(`Reference package name mismatch: ${specifier}`);
    const subpath = specifier.slice(name.length);
    const key = subpath ? `.${subpath}` : '.';
    let value = manifest.exports;
    if (value && typeof value === 'object' && Object.keys(value).some(key => key.startsWith('.'))) {
      value = value[key];
      if (value === undefined) {
        const pattern = Object.keys(manifest.exports).find(pattern => pattern.includes('*') && key.startsWith(pattern.split('*')[0]) && key.endsWith(pattern.split('*')[1]));
        if (pattern) {
          const [prefix, suffix] = pattern.split('*');
          const wildcard = key.slice(prefix.length, suffix ? -suffix.length : undefined);
          const replace = (v: any): any => typeof v === 'string' ? v.replaceAll('*', wildcard) : Array.isArray(v) ? v.map(replace) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, replace(x)]));
          value = replace(manifest.exports[pattern]);
        }
      }
    }
    function condition(value: any): string | undefined {
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) return value.map(condition).find(Boolean);
      if (value && typeof value === 'object') {
        for (const key of Object.keys(value)) if (['node', 'import', 'default', 'module-sync'].includes(key)) {
          const resolved = condition(value[key]); if (resolved) return resolved;
        }
      }
    }
    const target = condition(value) ?? (!manifest.exports && !subpath ? manifest.module ?? manifest.main : undefined);
    if (!target) throw new Error(`No genuine Node import export for Reference ${specifier}`);
    const result = path.resolve(directory, target);
    if (!result.startsWith(directory + path.sep) || !fs.statSync(result).isFile()) throw new Error(`Invalid genuine Reference entry: ${specifier}`);
    return result;
  }
  return (specifier: string, importer?: string): string | undefined => {
    if (!importer || specifier.startsWith('.') || specifier.startsWith('node:')) return;
    const name = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
    if (importer.startsWith(source + path.sep)) {
      const relative = path.relative(source, importer).replaceAll(path.sep, '/');
      if (name === 'sax' && relative.startsWith('packages/core/')) {
        const directory = process.env.PLUGIN_REFERENCE_SAX ?? '/tmp/plugin127-additional-reference-sax/package';
        const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
        if (manifest.name !== 'sax' || manifest.version !== '1.4.4') throw new Error('Unqualified Source Core sax');
        return path.resolve(directory, manifest.main);
      }
      // Additional exact Source Registry-client catalog7.7.4 archive, separately
      // approved and verified; transitive7.8.5 retains its own snapshot link.
      if (name === 'semver' && relative.startsWith('packages/registry-client/')) {
        const directory = process.env.PLUGIN_REFERENCE_SEMVER ?? '/tmp/plugin127-additional-reference-semver/package';
        const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8'));
        if (manifest.name !== 'semver' || manifest.version !== '7.7.4') throw new Error('Unqualified Source Registry-client semver');
        const suffix = specifier.slice(name.length);
        const result = path.resolve(directory, suffix ? `.${suffix}` : manifest.main);
        if (!result.startsWith(directory + path.sep) || !fs.statSync(result).isFile()) throw new Error(`Missing genuine semver subpath: ${specifier}`);
        return result;
      }
      const workspace = inventory.workspaceImports.find((row: any) => row.importer === relative && row.specifier === specifier);
      if (workspace) return path.join(source, workspace.target);
      const selected = proposal.missingImporterSelections.find((row: any) => row.importer === relative && row.specifier === specifier);
      if (selected) {
        const key = selected.snapshotKey.split('(')[0];
        const directory = packages.get(key); if (!directory) throw new Error(`Reference selection not acquired: ${key}`);
        return entry(directory, name, specifier);
      }
    }
    for (const [key, directory] of packages) if (importer.startsWith(directory + path.sep)) {
      const snapshot = snapshots.get(key);
      const selected = snapshot.dependencies?.[name] ?? snapshot.optionalDependencies?.[name];
      if (!selected) return;
      const dependency = packages.get(`${name}@${selected}`.split('(')[0]);
      if (!dependency) throw new Error(`Reference transitive selection not acquired: ${name}@${selected}`);
      return entry(dependency, name, specifier);
    }
  };
}
