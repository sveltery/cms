// Whole selected Source methods; MIT Copyright 2026 Cloudflare Inc.
// Immutable pin913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/plugins/hooks.ts.
// Comment-only registration/context are native hosts; no full plugin engine credit.
import { createCommentPluginContext, type PluginContextFactoryOptions } from './context.ts';
import type { PluginContext, CommentBeforeCreateEvent, CommentAfterCreateEvent, CommentAfterModerateEvent, HookHandlerMap, HookNameV2, ResolvedHook, ResolvedPlugin } from './types.ts';
export class HookPipeline {
 private hooks: Map<HookNameV2, Array<ResolvedHook<unknown>>> = new Map();
 private pluginMap = new Map<string, ResolvedPlugin>();
 private exclusiveHookNames = new Set<string>();
 private exclusiveSelections = new Map<string,string>();
 constructor(plugins: ResolvedPlugin[], private factoryOptions?: PluginContextFactoryOptions) {
  for (const plugin of plugins) {
   this.pluginMap.set(plugin.id, plugin);
   for (const name of ['comment:beforeCreate','comment:moderate','comment:afterCreate','comment:afterModerate'] as const) {
    const hook=plugin.hooks[name];
    if (!hook) continue;
    if (!plugin.capabilities.includes('users:read')) {
     console.warn(`[hooks] Plugin "${plugin.id}" declares ${name} hook without users:read capability — skipping`);
     continue;
    }
    if(hook.exclusive) this.exclusiveHookNames.add(name);
    const list=this.hooks.get(name)??[];list.push(hook);this.hooks.set(name,list);
   }
  }
  for(const [name,hooks] of this.hooks) this.hooks.set(name,this.sortHooks(hooks));
 }
 private getContext(pluginId:string):PluginContext {
  const plugin=this.pluginMap.get(pluginId);
  if(!plugin) throw new Error(`Plugin "${pluginId}" not found`);
  if(!this.factoryOptions) throw new Error('Context factory not initialized - call setContextFactory first');
  return createCommentPluginContext(plugin,this.factoryOptions);
 }


	/**
	 * Get typed hooks for a specific hook name.
	 * The internal map stores ResolvedHook<unknown>, but we know each name
	 * maps to a specific handler type via HookHandlerMap.
	 *
	 * Exclusive hooks that have a selected provider are filtered out — they
	 * should only run via invokeExclusiveHook(), not in the regular pipeline.
	 */
	private getTypedHooks<N extends HookNameV2>(name: N): Array<ResolvedHook<HookHandlerMap[N]>> {
		// The map stores hooks as ResolvedHook<unknown>. Each hook name corresponds
		// to a specific handler type. The cast here is the single point where we
		// bridge the untyped map to the typed API — callers never need to cast.
		const all = (this.hooks.get(name) ?? []) as Array<ResolvedHook<HookHandlerMap[N]>>;

		// If this hook has an exclusive selection, filter out all exclusive handlers
		// so they don't run in the regular pipeline
		if (this.exclusiveSelections.has(name)) {
			return all.filter((h) => !h.exclusive);
		}

		return all;
	}


	/**
	 * Sort hooks by priority and dependencies
	 */
	private sortHooks(hooks: Array<ResolvedHook<unknown>>): Array<ResolvedHook<unknown>> {
		const sorted: Array<ResolvedHook<unknown>> = [];
		const remaining = [...hooks];

		// Simple topological sort with priority as tiebreaker
		while (remaining.length > 0) {
			// Find hooks whose dependencies are satisfied
			const ready = remaining.filter((hook) =>
				hook.dependencies.every((dep) => sorted.some((s) => s.pluginId === dep)),
			);

			if (ready.length === 0) {
				// Circular dependency or missing dependency - log warning and fall back to priority
				const pluginIds = remaining.map((h) => h.pluginId).join(", ");
				console.warn(
					`[hooks] Hook dependency cycle or missing dependency detected among plugins: ${pluginIds}. Falling back to priority order.`,
				);
				remaining.sort((a, b) => a.priority - b.priority);
				sorted.push(...remaining);
				break;
			}

			// Sort ready hooks by priority and add the first one
			ready.sort((a, b) => a.priority - b.priority);
			const next = ready[0];
			sorted.push(next);
			remaining.splice(remaining.indexOf(next), 1);
		}

		return sorted;
	}


	/**
	 * Execute a hook with timeout
	 */
	private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
		let timer: ReturnType<typeof setTimeout>;
		const timeoutPromise = new Promise<T>(
			(_, reject) =>
				(timer = setTimeout(() => reject(new Error(`Hook timeout after ${timeout}ms`)), timeout)),
		);
		try {
			return await Promise.race([fn(), timeoutPromise]);
		} finally {
			clearTimeout(timer!);
		}
	}


	// =========================================================================
	// Comment Hooks
	// =========================================================================

	/**
	 * Run comment:beforeCreate hooks (middleware pipeline).
	 *
	 * Each handler receives the event and returns a modified event or
	 * `false` to reject the comment. The pipeline chains transformations —
	 * each handler receives the output of the previous one.
	 */
	async runCommentBeforeCreate(
		event: CommentBeforeCreateEvent,
	): Promise<CommentBeforeCreateEvent | false> {
		const hooks = this.getTypedHooks("comment:beforeCreate");
		let currentEvent = event;

		for (const hook of hooks) {
			const { handler } = hook;
			const ctx = this.getContext(hook.pluginId);
			const start = Date.now();

			try {
				const result = await this.executeWithTimeout(
					() => handler({ ...currentEvent }, ctx),
					hook.timeout,
				);

				if (result === false) {
					return false;
				}

				if (result && typeof result === "object") {
					currentEvent = result;
				}
			} catch (error) {
				console.error(
					`[comment:beforeCreate] Plugin "${hook.pluginId}" error (${Date.now() - start}ms):`,
					error instanceof Error ? error.message : error,
				);

				if (hook.errorPolicy === "abort") {
					throw error;
				}
			}
		}

		return currentEvent;
	}


	/**
	 * Run comment:afterCreate hooks (fire-and-forget).
	 *
	 * Errors are logged but don't propagate — they don't affect the caller.
	 */
	async runCommentAfterCreate(event: CommentAfterCreateEvent): Promise<void> {
		const hooks = this.getTypedHooks("comment:afterCreate");

		for (const hook of hooks) {
			const { handler } = hook;
			const ctx = this.getContext(hook.pluginId);

			try {
				await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
			} catch (error) {
				console.error(
					`[comment:afterCreate] Plugin "${hook.pluginId}" error:`,
					error instanceof Error ? error.message : error,
				);
			}
		}
	}


	/**
	 * Run comment:afterModerate hooks (fire-and-forget).
	 *
	 * Errors are logged but don't propagate — they don't affect the caller.
	 */
	async runCommentAfterModerate(event: CommentAfterModerateEvent): Promise<void> {
		const hooks = this.getTypedHooks("comment:afterModerate");

		for (const hook of hooks) {
			const { handler } = hook;
			const ctx = this.getContext(hook.pluginId);

			try {
				await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
			} catch (error) {
				console.error(
					`[comment:afterModerate] Plugin "${hook.pluginId}" error:`,
					error instanceof Error ? error.message : error,
				);
			}
		}
	}


	// =========================================================================
	// Utilities
	// =========================================================================

	/**
	 * Check if any hooks are registered for a given name
	 */
	hasHooks(name: HookNameV2): boolean {
		const hooks = this.hooks.get(name);
		return hooks !== undefined && hooks.length > 0;
	}


	/**
	 * Get hook count for debugging
	 */
	getHookCount(name: HookNameV2): number {
		return this.hooks.get(name)?.length || 0;
	}


	/**
	 * Get all registered hook names
	 */
	getRegisteredHooks(): HookNameV2[] {
		return [...this.hooks.keys()];
	}


	// =========================================================================
	// Exclusive Hook Support
	// =========================================================================

	/**
	 * Returns hook names where at least one handler declared exclusive: true
	 */
	getRegisteredExclusiveHooks(): string[] {
		return [...this.exclusiveHookNames];
	}


	/**
	 * Check if a hook is exclusive
	 */
	isExclusiveHook(name: string): boolean {
		return this.exclusiveHookNames.has(name);
	}


	/**
	 * Set the selected provider for an exclusive hook.
	 * Called by PluginManager after resolution.
	 */
	setExclusiveSelection(hookName: string, pluginId: string): void {
		this.exclusiveSelections.set(hookName, pluginId);
	}


	/**
	 * Clear the selected provider for an exclusive hook.
	 */
	clearExclusiveSelection(hookName: string): void {
		this.exclusiveSelections.delete(hookName);
	}


	/**
	 * Get the selected provider for an exclusive hook (if any).
	 */
	getExclusiveSelection(hookName: string): string | undefined {
		return this.exclusiveSelections.get(hookName);
	}


	/**
	 * Get all plugins that registered a handler for a given exclusive hook.
	 */
	getExclusiveHookProviders(hookName: string): Array<{ pluginId: string }> {
		const hooks = this.hooks.get(hookName as HookNameV2) ?? [];
		return hooks.filter((h) => h.exclusive).map((h) => ({ pluginId: h.pluginId }));
	}


	/**
	 * Get all plugins that registered a non-exclusive handler for a given
	 * hook (e.g. `email:beforeSend`, `email:afterSend`), preserving priority
	 * order. Partitions with `getExclusiveHookProviders()`, which returns
	 * plugins whose registration is marked `exclusive: true`.
	 */
	getHookProviders(hookName: string): Array<{ pluginId: string }> {
		const hooks = this.hooks.get(hookName as HookNameV2) ?? [];
		return hooks.filter((h) => !h.exclusive).map((h) => ({ pluginId: h.pluginId }));
	}


	/**
	 * Invoke an exclusive hook — dispatch only to the selected provider.
	 * Returns null if no provider is selected or if the selected hook
	 * is not found in the pipeline.
	 *
	 * This is a generic dispatch used by the email pipeline and other
	 * exclusive hook consumers. The handler type is unknown — callers
	 * must know the expected signature.
	 *
	 * Errors are isolated: a failing handler returns an error result
	 * instead of propagating the exception to the caller.
	 */
	async invokeExclusiveHook(
		hookName: string,
		event: unknown,
	): Promise<{ result: unknown; pluginId: string; error?: Error; duration: number } | null> {
		const selectedPluginId = this.exclusiveSelections.get(hookName);
		if (!selectedPluginId) return null;

		const hooks = this.hooks.get(hookName as HookNameV2) ?? [];
		const hook = hooks.find((h) => h.pluginId === selectedPluginId && h.exclusive);
		if (!hook) return null;

		const start = Date.now();
		try {
			const ctx = this.getContext(selectedPluginId);
			const handler = hook.handler as (event: unknown, ctx: PluginContext) => Promise<unknown>;
			const result = await this.executeWithTimeout(() => handler(event, ctx), hook.timeout);
			return { result, pluginId: selectedPluginId, duration: Date.now() - start };
		} catch (error) {
			return {
				result: undefined,
				pluginId: selectedPluginId,
				error: error instanceof Error ? error : new Error(String(error)),
				duration: Date.now() - start,
			};
		}
	}
}
export function createHookPipeline(plugins:ResolvedPlugin[],factoryOptions?:PluginContextFactoryOptions):HookPipeline{return new HookPipeline(plugins,factoryOptions);}
const EXCLUSIVE_HOOK_KEY_PREFIX='emdash:exclusive_hook:';


// ── Shared exclusive hook resolution ─────────────────────────────────────────

/**
 * Options for exclusive hook resolution.
 */
export interface ExclusiveHookResolutionOptions {
	pipeline: HookPipeline;
	/**
	 * Check whether a plugin ID is currently active.
	 * Used to filter providers — only active providers participate in selection.
	 */
	isActive: (pluginId: string) => boolean;
	/** Read an option value from persistent storage. */
	getOption: (key: string) => Promise<string | null>;
	/**
	 * Batch-read option values for many keys in a single round trip.
	 * When provided, resolution reads all current selections through this
	 * instead of one getOption() call per hook. Keys absent from the
	 * returned map are treated as unset.
	 */
	getOptions?: (keys: string[]) => Promise<ReadonlyMap<string, string>>;
	/** Write an option value to persistent storage. */
	setOption: (key: string, value: string) => Promise<void>;
	/** Delete an option from persistent storage. */
	deleteOption: (key: string) => Promise<void>;
	/**
	 * Map of pluginId → hook names the plugin prefers to handle.
	 * Used as a tiebreaker when no DB selection exists and multiple providers are active.
	 */
	preferredHints?: Map<string, string[]>;
	/**
	 * Plugin IDs of built-in providers that give way to a plugin. When no
	 * selection is stored, a fallback is auto-selected only if no other
	 * provider of the hook is active, and that selection is not stored, so a
	 * plugin provider that becomes active later is selected in its place.
	 */
	fallbackProviders?: ReadonlySet<string>;
}


/**
 * Resolve exclusive hook selections.
 *
 * Shared algorithm used by both PluginManager and EmDashRuntime:
 * 1. If a DB selection exists and that plugin is active → keep it.
 * 2. If DB selection is stale (plugin inactive/gone) → clear it.
 * 3. If no selection and only one active provider → auto-select it. Fallback
 *    providers are not counted when another provider is active, so a single
 *    plugin provider is selected over a built-in fallback. A fallback
 *    selection is kept in memory only.
 * 4. If preferred hints match an active provider → first match wins.
 * 5. If multiple providers and no hint → leave unselected (admin must choose).
 */
export async function resolveExclusiveHooks(opts: ExclusiveHookResolutionOptions): Promise<void> {
	const {
		pipeline,
		isActive,
		getOption,
		getOptions,
		setOption,
		deleteOption,
		preferredHints,
		fallbackProviders,
	} = opts;
	const exclusiveHookNames = pipeline.getRegisteredExclusiveHooks();
	if (exclusiveHookNames.length === 0) return;

	// Batch-read current selections in one round trip when the caller
	// provides a batch reader (1 query instead of N sequential gets).
	let batchedSelections: ReadonlyMap<string, string> | undefined;
	if (getOptions) {
		try {
			batchedSelections = await getOptions(
				exclusiveHookNames.map((hookName) => `${EXCLUSIVE_HOOK_KEY_PREFIX}${hookName}`),
			);
		} catch {
			// Options table may not be ready. Matches the per-key tolerance
			// below: every hook's read would fail, so resolution is skipped
			// entirely without touching any selection.
			return;
		}
	}

	for (const hookName of exclusiveHookNames) {
		const providers = pipeline.getExclusiveHookProviders(hookName);
		const activeProviderIds = new Set(
			providers.map((p) => p.pluginId).filter((id) => isActive(id)),
		);

		const key = `${EXCLUSIVE_HOOK_KEY_PREFIX}${hookName}`;
		let currentSelection: string | null = null;
		if (batchedSelections) {
			currentSelection = batchedSelections.get(key) ?? null;
		} else {
			try {
				currentSelection = await getOption(key);
			} catch {
				// Options table may not be ready
				continue;
			}
		}

		// If selection exists and the plugin is still active → keep it
		if (currentSelection && activeProviderIds.has(currentSelection)) {
			pipeline.setExclusiveSelection(hookName, currentSelection);
			continue;
		}

		// Selection is stale or missing — clear it
		if (currentSelection) {
			try {
				await deleteOption(key);
			} catch {
				// Non-fatal
			}
		}

		// Auto-select if only one active provider
		const candidates =
			activeProviderIds.size > 1 && fallbackProviders
				? [...activeProviderIds].filter((id) => !fallbackProviders.has(id))
				: [...activeProviderIds];
		if (candidates.length === 1) {
			const [onlyProvider] = candidates;
			if (!fallbackProviders?.has(onlyProvider)) {
				try {
					await setOption(key, onlyProvider);
				} catch {
					// Non-fatal
				}
			}
			pipeline.setExclusiveSelection(hookName, onlyProvider);
			continue;
		}

		// Check preferred hints
		if (preferredHints) {
			let found = false;
			for (const [pluginId, hooks] of preferredHints) {
				if (hooks.includes(hookName) && activeProviderIds.has(pluginId)) {
					try {
						await setOption(key, pluginId);
					} catch {
						// Non-fatal
					}
					pipeline.setExclusiveSelection(hookName, pluginId);
					found = true;
					break;
				}
			}
			if (found) continue;
		}

		// Multiple providers, no hint — leave unselected
		pipeline.clearExclusiveSelection(hookName);
	}
}
