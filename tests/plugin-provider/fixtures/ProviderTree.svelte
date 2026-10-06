<script lang="ts">
  import PluginAdminProvider from '../../../src/lib/plugins/PluginAdminProvider.svelte';
  import PluginWidget from '../../../src/lib/plugins/PluginWidget.svelte';
  import PluginPage from '../../../src/lib/plugins/PluginPage.svelte';
  import LabelOne from './LabelOne.svelte';
  import LabelTwo from './LabelTwo.svelte';
  import type { PluginAdmins } from '../../../src/lib/plugins/provider.svelte.ts';
  let admins = $state<PluginAdmins>({ example: { widgets: { status: LabelOne }, pages: { '/overview/': LabelOne } } });
  export function replaceAdmins() { admins = { example: { widgets: { status: LabelTwo }, pages: { '/overview/': LabelTwo } } }; }
</script>
<PluginAdminProvider pluginAdmins={admins}>
  <div data-outer><PluginWidget pluginId="example" widgetId="status" /><PluginPage pluginId="example" path="/overview" /></div>
  <PluginAdminProvider pluginAdmins={{ example: { widgets: { status: LabelOne } } }}>
    <div data-inner><PluginWidget pluginId="example" widgetId="status" /></div>
  </PluginAdminProvider>
</PluginAdminProvider>
