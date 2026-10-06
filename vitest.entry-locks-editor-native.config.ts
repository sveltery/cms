import {defineConfig} from 'vitest/config';
import {svelte} from '@sveltejs/vite-plugin-svelte';
import {realpathSync} from 'node:fs';
const root=import.meta.dirname,framework=`${root}/tests/helpers/writable-editor-dom/framework.ts`;
const kit=realpathSync(`${root}/node_modules/@sveltejs/kit`);
export default defineConfig({plugins:[{name:'actual-kit-entry-lock-editor-controlled-error-boundary',enforce:'pre',resolveId(id,importer){
 if(id==='$app/navigation'||id==='$app/paths'||id==='$app/paths/internal/client')return framework;
 if(importer?.includes('/@sveltejs/kit/src/runtime/client/remote-functions/')&&(id==='../client.js'||id==='../state.svelte.js'))return framework;
 if(importer?.endsWith('/src/lib/editor/EditorForm.svelte')&&(id==='../content.remote'||id==='../editor-autosave.remote'))return`${root}/tests/helpers/entry-locks/controlled-remotes.ts`;
 if(id==='sveltery-test:installed-kit-form')return`${kit}/src/runtime/client/remote-functions/form.svelte.js`;
 if(id==='sveltery-test:installed-kit-form-utils')return`${kit}/src/runtime/form-utils.js`;
}},svelte({configFile:false})],resolve:{conditions:['browser']},test:{environment:'jsdom',fileParallelism:false,include:['tests/entry-locks-native/editor-mounted.test.ts'],server:{deps:{inline:[/@sveltejs\/kit/]}}}});
