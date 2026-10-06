// Native test-host staging only. Source/product behavior and assertions are unchanged.
import { cp, lstat } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';

/**
 * Stage canonical libraries, hooks, app assets and root route files for a fixture
 * that supplies its own root page. Unrelated application route directories do
 * not participate in this isolated fixture's real SvelteKit build.
 * @param {string} checkout
 * @param {string} directory
 */
export async function copyIsolatedRootPageSource(checkout, directory) {
  const routes = join(checkout, 'src', 'routes');
  await cp(join(checkout, 'src'), join(directory, 'src'), {
    recursive: true,
    filter: async source => {
      if (!source.startsWith(routes + sep)) return true;
      if (dirname(source) !== routes) return false;
      return !(await lstat(source)).isDirectory();
    }
  });
}
