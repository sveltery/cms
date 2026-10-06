// Owned test-only real isolated build. One actual build per test Node process;
// failure propagates. Production Vite config, shared CI and commands stay exact.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
let pending: Promise<void> | undefined;
export function ensureAccountSsrBuild(): Promise<void> {
  return pending ??= new Promise((resolve, reject) => {
    const projectRoot = fileURLToPath(new URL('../../../', import.meta.url));
    const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'build',
      '--config', 'vite.default-seed-account-ssr.config.ts'], {
      cwd: projectRoot, stdio: ['ignore', 'pipe', 'pipe']
    });
    let output = '';
    child.stdout.on('data', data => { output += data; process.stdout.write(data); });
    child.stderr.on('data', data => { output += data; process.stderr.write(data); });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Actual account-component SSR fixture build failed (${code ?? signal}):\n${output}`));
    });
  });
}
