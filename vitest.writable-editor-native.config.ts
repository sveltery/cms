import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { realpathSync } from 'node:fs';
const root = import.meta.dirname;
const framework = `${root}/tests/helpers/writable-editor-dom/framework.ts`;
const remotes = `${root}/tests/helpers/writable-editor-dom/remotes.ts`;
const kit = realpathSync(`${root}/node_modules/@sveltejs/kit`);
export default defineConfig({ plugins: [{ name: 'actual-kit-editor-dom-environment', enforce: 'pre',
  resolveId(id, importer) {
    if (id === '$app/navigation' || id === '$app/paths' || id === '$app/paths/internal/client') return framework;
    if (importer?.includes('/@sveltejs/kit/src/runtime/client/remote-functions/') && (id === '../client.js' || id === '../state.svelte.js')) return framework;
    if (importer?.endsWith('/src/lib/editor/EditorForm.svelte') && (id === '../content.remote' || id === '../editor-autosave.remote')) return remotes;
    if (importer === remotes && id.endsWith('/@sveltejs/kit/src/runtime/client/remote-functions/form.svelte.js')) return `${kit}/src/runtime/client/remote-functions/form.svelte.js`;
  }
}, svelte({ configFile: false })], resolve: { conditions: ['browser'] },
  test: { environment: 'jsdom', include: ['tests/writable-editor-native/*.test.ts'], fileParallelism: false,
    server: { deps: { inline: [/@sveltejs\/kit/] } } } });
