// Native comment-only provider authoring. Pinned defaults from define-plugin.ts.
// MIT Copyright 2026 Cloudflare Inc.; notices/emdash-MIT.txt.
import type { PluginDefinition, ResolvedPlugin, HookNameV2, HookConfig, HookHandlerMap } from './types.ts';
export function definePlugin(definition: PluginDefinition): ResolvedPlugin {
 if (!definition.id) throw new Error('Native comment providers require an id');
 const hooks: ResolvedPlugin['hooks'] = {};
 for (const name of Object.keys(definition.hooks) as HookNameV2[]) {
  const original = definition.hooks[name];
  if (!original) continue;
  const hook: HookConfig<HookHandlerMap[HookNameV2]> = typeof original === 'function' ? { handler: original } : original;
  const resolved = { handler: hook.handler, pluginId: definition.id,
    priority: hook.priority ?? 100, timeout: hook.timeout ?? 5000,
    dependencies: hook.dependencies ?? [], errorPolicy: hook.errorPolicy ?? 'abort', exclusive: hook.exclusive ?? false };
  Object.assign(hooks, { [name]: resolved });
 }
 return { id: definition.id, version: definition.version, capabilities: [...definition.capabilities], hooks };
}
