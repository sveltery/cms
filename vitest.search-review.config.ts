import { defineConfig } from 'vitest/config';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
// Explicit author baseline mode imports the sealed R1 candidates unchanged;
// ordinary CI omits this task-specific path and exercises actual product modules.
const root = import.meta.dirname;
const proposalPath = process.env.SVELTERY_SEARCH_REVIEW_RUNTIME_MANIFEST;
const candidateRoot = proposalPath ? resolve(dirname(proposalPath), 'candidates') : undefined;
const proposal = proposalPath ? JSON.parse(readFileSync(proposalPath, 'utf8')) : undefined;
if (proposal && proposal.pin !== '913cb1bb9b7f08c3ff0d258b4420e53835b6a58e') throw new Error('Unexpected search proposal pin');
const candidates = new Map<string, string>((proposal?.files ?? []).filter((file: {path: string}) => file.path.endsWith('.ts'))
  .map((file: {path: string; candidatePath: string}) => [resolve(root, file.path), file.candidatePath]));
export default defineConfig({ plugins: [{ name: 'finite-unapplied-search-review-proposal', enforce: 'pre',
  resolveId(id, importer) {
    if (!proposal || !importer || (!id.startsWith('.') && !isAbsolute(id))) return;
    const physical = isAbsolute(id) ? id : resolve(dirname(importer), id);
    const logical = candidateRoot && physical.startsWith(candidateRoot + '/') ? resolve(root, relative(candidateRoot, physical)) : physical;
    const candidate = candidates.get(logical);
    if (candidate) return candidate;
    if (candidateRoot && importer.startsWith(candidateRoot + '/') && existsSync(logical)) return logical;
  }
}], test: { fileParallelism: false, include: ['tests/search-native-review/*.test.ts'] } });
