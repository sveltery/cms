import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const record = JSON.parse(readFileSync(resolve(root, 'docs/full-auth-qualified-reference-package-bindings-v2.json'), 'utf8'));
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(readFileSync(record.qualifiedPackageMapPath)), record.qualifiedPackageMapSha256, 'whole Root-qualified isolated package map');
const packages = JSON.parse(readFileSync(record.qualifiedPackageMapPath, 'utf8'));
assert.equal(sha(readFileSync(record.additionalQualifiedPackageMapPath)), record.additionalQualifiedPackageMapSha256, 'whole additional Root-qualified isolated package map');
const additionalPackages = JSON.parse(readFileSync(record.additionalQualifiedPackageMapPath, 'utf8'));
assert.equal(additionalPackages.wholeReceiptSha256, record.additionalQualifiedReceiptSha256);
assert.equal(additionalPackages.approvedProposalSha256, record.additionalQualifiedProposalSha256);
assert.equal(packages.wholeReceiptSha256, record.qualifiedPluginReceiptSha256);
assert.equal(packages.approvedProposalSha256, record.qualifiedPluginProposalSha256);
for (const entry of record.wholeSourceManifests) assert.equal(sha(readFileSync(resolve(root, entry.destination))), entry.sha256, `whole Source importer manifest ${entry.source}`);
const bindings = new Map<string, any>(record.sourceImporters.map((entry: any) => [`${entry.importer}:${entry.specifier}`, entry]));
function importedValue(value: any): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(importedValue).find(Boolean);
  if (!value || typeof value !== 'object') return;
  for (const [condition, target] of Object.entries(value)) if (condition === 'import' || condition === 'node' || condition === 'default') {
    const selected = importedValue(target); if (selected) return selected;
  }
}
function exportedPath(directory: string, specifier: string): string {
  const pkg = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  const key = specifier === pkg.name ? '.' : `.${specifier.slice(pkg.name.length)}`;
  let entry = pkg.exports?.[key];
  if (!entry && key === '.' && (typeof pkg.exports === 'string' || (pkg.exports && !Object.keys(pkg.exports).some(item => item.startsWith('.'))))) entry = pkg.exports;
  if (!entry) for (const [pattern, target] of Object.entries(pkg.exports ?? {})) {
    if (!pattern.includes('*')) continue;
    const [prefix, suffix] = pattern.split('*');
    if (key.startsWith(prefix) && key.endsWith(suffix)) {
      const name = key.slice(prefix.length, suffix ? -suffix.length : undefined);
      const selected = importedValue(target); if (selected) entry = selected.replaceAll('*', name); break;
    }
  }
  const target = importedValue(entry) ?? (key === '.' ? pkg.module ?? pkg.main : undefined);
  assert.equal(typeof target, 'string', `actual package export ${specifier}`);
  const path = resolve(directory, target); assert.ok(existsSync(path), `whole actual package export ${specifier}`); return path;
}
export function qualifiedReferencePackages() {
  return { name: 'whole-root-qualified-isolated-source-packages', enforce: 'pre' as const, resolveId(specifier: string, importer?: string) {
    if (!importer) return;
    const relative = importer.split('/parity/emdash/full-auth-source/reference/')[1]?.replace(/\.mjs$/, '.ts');
    if (!relative) return;
    const binding = bindings.get(`${relative}:${specifier}`);
    if (!binding) return;
    const registered = [...packages.packages, ...additionalPackages.packages].find((entry: any) => entry.packageKey === binding.packageKey);
    assert.ok(registered?.sourceExactSRIMatch); assert.equal(registered.actualPackageDirectory, binding.actualPackageDirectory);
    const pkg = JSON.parse(readFileSync(resolve(binding.actualPackageDirectory, 'package.json'), 'utf8'));
    assert.equal(`${pkg.name}@${pkg.version}`, binding.packageKey, 'exact Source importer-selected package version');
    return exportedPath(binding.actualPackageDirectory, specifier);
  } };
}
