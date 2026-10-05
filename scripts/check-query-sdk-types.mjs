import ts from 'typescript';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const contract = resolve('tests/query-sdk-native/generics-contract.ts');
const configuration = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
if (configuration.error) throw new Error(ts.flattenDiagnosticMessageText(configuration.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(configuration.config, ts.sys, process.cwd());
// The real installed Node/Vite declarations are the server/platform authority.
// This bounded consumer program does not include unrelated application roots.
const options = {...parsed.options, types: [...new Set([...(parsed.options.types ?? []), 'node', 'vite/client'])]};
const program = ts.createProgram({rootNames: [contract], options});
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
const rows = diagnostics.map(diagnostic => ({
  file: diagnostic.file?.fileName,
  line: diagnostic.file && diagnostic.start !== undefined ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1 : undefined,
  code: diagnostic.code,
  category: ts.DiagnosticCategory[diagnostic.category],
  message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
}));
const report = {
  actualProgramRoots: [contract],
  compilerErrors: rows.filter(row => row.category === 'Error').length,
  consumerContractErrors: rows.filter(row => row.file === contract && row.category === 'Error').length,
  productCallbacksRun: 0,
  sourceCallbacksCredited: 0,
  diagnostics: rows
};
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(ts.formatDiagnostics(diagnostics, {
  getCanonicalFileName: filename => filename,
  getCurrentDirectory: () => process.cwd(),
  getNewLine: () => '\n'
}));
console.log(JSON.stringify(report));
if (report.compilerErrors > 0) process.exitCode = 1;
