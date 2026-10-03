<script lang="ts">
 import {page} from '$app/state';
 import {resolve} from '$app/paths';
 import {getSiteSettings} from '$lib/settings.remote';
 import SettingsEditor from '$lib/ui/SettingsEditor.svelte';
 import WorkspaceShell from '$lib/ui/WorkspaceShell.svelte';
 const section=$derived(page.params.section==='social'?'social':page.params.section==='seo'?'seo':'general');
 const result=$derived(await getSiteSettings().then(settings=>({settings,available:true}),()=>({settings:{},available:false})));
</script>
<svelte:head><title>Settings · Sveltery CMS</title></svelte:head>
<WorkspaceShell homeHref={resolve('/')} activePage="settings">
 <h1>{section==='social'?'Social Links':section==='seo'?'SEO Settings':'General Settings'}</h1>
 <nav aria-label="Settings"><a href={resolve('/settings/[section]',{section:'general'})}>General</a> · <a href={resolve('/settings/[section]',{section:'social'})}>Social</a> · <a href={resolve('/settings/[section]',{section:'seo'})}>SEO</a></nav>
 {#if result.available}<SettingsEditor {section} settings={result.settings} />{:else}<p role="status">Site settings require a signed-in editor or administrator and configured storage.</p>{/if}
</WorkspaceShell>
