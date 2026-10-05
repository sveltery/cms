// Native test-host staging only. Source/product behavior and assertions are unchanged.
import { cp, lstat } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';

/**
 * Stage canonical libraries, hooks, app assets and root route files for a fixture
 * that supplies its own root page. Unrelated application route directories do
 * not participate in this isolated fixture's real SvelteKit build.
 */
export async function copyIsolatedRootPageSource(checkout, directory) {
  const routes = join(checkout, 'src', 'routes');
  await cp(join(checkout, 'src'), join(directory, 'src'), {
    recursive: true,
    filter: async source => !source.startsWith(routes + sep)
      || (dirname(source) === routes && !(await lstat(source)).isDirectory())
  });
}
