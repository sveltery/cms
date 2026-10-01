// Inventory tooling only. This script never executes upstream tests or CMS code.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const base = dirname(fileURLToPath(import.meta.url));
const commit = '0e8977c221dd8e5111511eb226faa3d164c829ef';
const [upstream, typescriptFile, mode = 'check'] = process.argv.slice(2);
if (!upstream || !typescriptFile || !['check', 'write'].includes(mode)) {
  throw new Error('Usage: node catalog.mjs UPSTREAM_CHECKOUT TYPESCRIPT_JS [check|write]');
}
const ts = createRequire(import.meta.url)(resolve(typescriptFile));
const git = (...args) => execFileSync('git', ['-C', upstream, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trimEnd();
const hash = text => createHash('sha256').update(text).digest('hex');
const selections = JSON.parse(readFileSync(resolve(base, 'selection.json'), 'utf8'));
const paths = git('ls-tree', '-r', '--name-only', commit).split('\n');
const files = [];
for (const path of paths) {
  if (!/\.(test|spec)\.tsx?$/.test(path)) continue;
  const selection = selections.find(x => x.paths.includes(path) || x.prefixes.some(prefix => path.startsWith(prefix)));
  if (!selection) continue;
  // Read committed blobs, never the working tree or upstream HEAD.
  const source = execFileSync('git', ['-C', upstream, 'show', `${commit}:${path}`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (tree.parseDiagnostics.length) throw new Error(`Parse failure: ${path}`);
  const location = node => tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
  const url = line => `https://github.com/emdash-cms/emdash/blob/${commit}/${path}#L${line}`;
  const tests = [];
  const ownedAssertions = new Set();
  function runtimeGates(node) {
    const gates = [];
    function walk(n) {
      if (ts.isCallExpression(n) && /^(?:test|it|describe)\.(?:skip|skipIf|runIf|fixme)(?:\(|\b)/.test(n.expression.getText(tree))) {
        gates.push({ line: location(n), expression: n.getText(tree), sourceUrl: url(location(n)) });
      }
      ts.forEachChild(n, walk);
    }
    walk(node);
    return gates;
  }
  function assertionCalls(node) {
    const found = [];
    function visit(n) {
      if (ts.isCallExpression(n) && /^expect(?:\.|\()/.test(n.getText(tree))) {
        let receiver = n.expression;
        while (ts.isPropertyAccessExpression(receiver)) receiver = receiver.expression;
        const isMatcher = ts.isCallExpression(receiver);
        const isGuard = /^expect\.(?:assertions|hasAssertions|unreachable|fail)$/.test(n.expression.getText(tree));
        // Retain the outer matcher call, including .not/.resolves/.rejects and await.
        // A direct constructor such as expect.any(...) has no expectation receiver.
        if ((isMatcher || isGuard) && !ts.isPropertyAccessExpression(n.parent) && !ts.isCallExpression(n.parent)) {
          const exact = ts.isAwaitExpression(n.parent) ? n.parent : n;
          found.push({ line: location(exact), expression: exact.getText(tree), sourceUrl: url(location(exact)) });
        }
      }
      ts.forEachChild(n, visit);
    }
    visit(node);
    return found;
  }
  function visit(node, suites = [], expansion = []) {
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText(tree);
      const callback = node.arguments.find(x => ts.isArrowFunction(x) || ts.isFunctionExpression(x));
      const isSuite = /^(describe(?:\.|$)|test\.describe(?:\.|$)|describeEachDialect$)/.test(name);
      const isTest = /^(it(?:\.|$)|test(?:\.|$))/.test(name) && !name.startsWith('test.describe') && !/^(test|it)\.(use|before|after|setTimeout|skip|fixme)/.test(name);
      // A titled skip/fixme registration is inventory too; in-body skip calls have no callback.
      const skippedTest = /^(it|test)\.(skip|fixme)/.test(name);
      if (callback && (isSuite || isTest || skippedTest)) {
        const titleNode = node.arguments[0];
        const title = titleNode && (ts.isStringLiteral(titleNode) || ts.isNoSubstitutionTemplateLiteral(titleNode)) ? titleNode.text : titleNode?.getText(tree) ?? '<dynamic>';
        const parameter = name.includes('.each') || name === 'describeEachDialect' ? { line: location(node), registration: name, dataset: name === 'describeEachDialect' ? 'sqlite; postgres only when EMDASH_TEST_PG is configured (tests/utils/test-db.ts)' : node.expression.getText(tree) } : null;
        const nextExpansion = parameter ? [...expansion, parameter] : expansion;
        if (isSuite) { visit(callback.body, [...suites, title], nextExpansion); return; }
        const assertions = assertionCalls(callback.body);
        assertions.forEach(x => ownedAssertions.add(x.line + ':' + x.expression));
        const line = location(node);
        const loopContexts = [];
        for (let parent = node.parent; parent; parent = parent.parent) {
          if (ts.isForOfStatement(parent) || ts.isForInStatement(parent) || ts.isForStatement(parent)) {
            loopContexts.push({ line: location(parent), sourceUrl: url(location(parent)), header: parent.getText(tree).split('{')[0].trim() });
          }
        }
        tests.push({
          sourceId: `${commit}:${path}:${line}`,
          title, suites, line, sourceUrl: url(line),
          registration: name, registrationSha256: hash(node.getText(tree)),
          expansion: nextExpansion, loopContexts, runtimeGates: runtimeGates(callback.body),
          status: 'inventory-only', productExecution: null,
          assertions
        });
        return;
      }
    }
    ts.forEachChild(node, child => visit(child, suites, expansion));
  }
  visit(tree);
  const sharedAssertions = assertionCalls(tree).filter(x => !ownedAssertions.has(x.line + ':' + x.expression));
  files.push({ path, category: selection.category, stage: selection.stage, sourceBlob: git('rev-parse', `${commit}:${path}`), sourceSha256: hash(source), sourceUrl: url(1), tests, sharedAssertions, runtimeGates: runtimeGates(tree) });
}
for (const selection of selections) for (const path of selection.paths) {
  if (!files.some(file => file.path === path)) throw new Error(`Missing selected source: ${path}`);
}
const catalog = { formatVersion: 1, upstream: 'https://github.com/emdash-cms/emdash', commit, tag: 'emdash@1.0.1', kind: 'inventory-only', files };
const serialized = JSON.stringify(catalog, null, 2) + '\n';
const target = resolve(base, 'inventory.json');
if (mode === 'write') writeFileSync(target, serialized);
else if (readFileSync(target, 'utf8') !== serialized) throw new Error('Inventory differs from committed upstream source; inspect before regenerating.');
console.log(JSON.stringify({ mode, sourceFiles: files.length, testDeclarations: files.reduce((n, f) => n + f.tests.length, 0), assertionExpressions: files.reduce((n, f) => n + f.tests.reduce((m, t) => m + t.assertions.length, 0) + f.sharedAssertions.length, 0), productTestsRun: 0 }));
