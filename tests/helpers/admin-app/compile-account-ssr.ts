// Compile actual product dependencies for the existing standalone whole-shell
// SSR fixtures. No component/query/user response is replaced by a fake module.
import { readFile, writeFile } from 'node:fs/promises';
import { compile, compileModule } from 'svelte/compiler';
import ts from 'typescript';
export async function compileWorkspaceAccountSsr(directory: string): Promise<void> {
 for (const name of ['client', 'response']) {
  const source = await readFile(new URL(`../../../src/lib/dashboard/${name}.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText.replace("'./response'", "'./dashboard-response.js'");
  await writeFile(`${directory}/dashboard-${name}.js`, compiled);
 }
 const queryUrl = new URL('../../../src/lib/dashboard/query.svelte.ts', import.meta.url);
 const query = ts.transpileModule(await readFile(queryUrl, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
 await writeFile(`${directory}/dashboard-query.js`, compileModule(query, { filename: 'query.svelte.js', generate: 'server' }).js.code);
 const currentUser = ts.transpileModule(await readFile(new URL('../../../src/lib/admin-app/current-user.svelte.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText.replace('../dashboard/query.svelte', './dashboard-query.js');
 await writeFile(`${directory}/current-user.js`, compileModule(currentUser, { filename: 'current-user.svelte.js', generate: 'server' }).js.code);
 for (const [source, filename] of [
  ['admin-app/WorkspaceAccount.svelte', 'WorkspaceAccount.js'], ['dashboard/WelcomeModal.svelte', 'WelcomeModal.js']
 ] as const) {
  const url = new URL(`../../../src/lib/${source}`, import.meta.url);
  const compiled = compile(await readFile(url, 'utf8'), { filename: source, generate: 'server' }).js.code
   .replace('../dashboard/client', './dashboard-client.js')
   .replace("'./client'", "'./dashboard-client.js'")
   .replace('./current-user.svelte', './current-user.js')
   .replace('../dashboard/WelcomeModal.svelte', './WelcomeModal.js')
   .replace('../dashboard/query.svelte', './dashboard-query.js')
   .replace("'./query.svelte'", "'./dashboard-query.js'");
  await writeFile(`${directory}/${filename}`, compiled);
 }
}
