// EmDash 1.1.0, MIT, Copyright 2026 Cloudflare Inc.; notices/emdash-MIT.txt.
// packages/admin/src/lib/pluginBlocks.ts at 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
import type { PluginBlockDef } from './editor.ts';
import type { AdminManifest } from './api.ts';
export function getPluginBlocks(manifest: AdminManifest): PluginBlockDef[] {
  const blocks: PluginBlockDef[] = [];
  for (const [pluginId, plugin] of Object.entries(manifest.plugins)) {
    if (plugin.portableTextBlocks) {
      for (const block of plugin.portableTextBlocks) blocks.push({ ...block, pluginId });
    }
  }
  return blocks;
}
