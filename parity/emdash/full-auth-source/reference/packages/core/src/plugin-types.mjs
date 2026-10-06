/**
 * `emdash/plugin` — types and lightweight helpers for authoring sandboxed plugins.
 *
 * Type-only imports erase normally. The value exports are small identity and
 * response-builder helpers that the plugin CLI bundles into the sandbox
 * artifact without pulling in the EmDash runtime.
 *
 * Recommended authoring pattern:
 *
 * ```ts
 * import type { SandboxedPlugin } from "emdash/plugin";
 *
 * export default {
 *   hooks: {
 *     "content:beforeSave": async (event, ctx) => {
 *       // event: ContentHookEvent, ctx: PluginContext — both inferred.
 *       return event.content;
 *     },
 *   },
 *   routes: {
 *     health: async (routeCtx, ctx) => ({ ok: true }),
 *   },
 * } satisfies SandboxedPlugin;
 * ```
 *
 * The `satisfies SandboxedPlugin` annotation drives full inference on
 * every hook handler. Authors should not need to annotate handler
 * params — TypeScript reads the event type from the hook name. The
 * runtime probe at build time reads `default.hooks` and `default.routes`
 * directly; the shape declared here mirrors what the probe consumes.
 *
 * Return types matter: `content:beforeSave` may return a mutated
 * `content` to override the saved fields; `content:beforeDelete` and
 * `comment:beforeCreate` may return `false` to veto; `page:metadata`
 * returns the metadata contribution. The mapped type captures these
 * per-hook return contracts so misuse fails at compile time.
 */
export function pluginResponse(init = {}) {
    const headers = [];
    new Headers(init.headers).forEach((value, name) => headers.push([name, value]));
    return {
        __emdashPluginResponse: true,
        status: init.status ?? 200,
        headers,
        body: init.body ?? null,
    };
}
export function pluginRoute(config) {
    return config;
}
