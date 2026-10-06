// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Native composition of the complete pinned plugin owners. This is not a
// replacement mapped onto the immutable Source EmDashRuntime test authority.
import { AsyncLocalStorage } from 'node:async_hooks';
import type { CmsDatabase } from '../database/contract.ts';
import { OptionsRepository } from '../options/repository.ts';
import { PluginContextFactory, type PluginContextFactoryOptions } from './context.ts';
import { CronExecutor } from './cron.ts';
import { definePlugin } from './define-plugin.ts';
import { pluginSourceDatabase } from './database.ts';
import { EmailPipeline } from './email.ts';
import { createHookPipeline, resolveExclusiveHooks, type HookPipeline } from './hooks.ts';
import { handlePluginList } from './handlers.ts';
import { disableRuntimePlugin, enableRuntimePlugin } from './lifecycle.ts';
import { PluginRouteRegistry, type InvokeRouteOptions } from './routes.ts';
import type { SandboxedPluginEntry } from './runtime-types.ts';
import type { CronScheduler } from './scheduler/types.ts';
import { PluginStateRepository } from './state.ts';
import { syncDeclaredStorageIndexes } from './storage-indexes.ts';
import type { PluginDefinition, ResolvedPlugin, PluginContext } from './types.ts';

/** The hosting owner supplies the actual current initialized database. */
const currentOwner = new AsyncLocalStorage<CmsDatabase>();
export function runWithPluginDatabase<T>(database: CmsDatabase, operation: () => T): T {
  return currentOwner.run(database, operation);
}

export interface PluginMaintenance {
  publishScheduled(onPublished?: (refs: PublishedPluginContent[]) => Promise<void>): Promise<PublishedPluginContent[]>;
  runSystemCleanup(): Promise<unknown>;
  maybeRunScheduledBackup(): Promise<void>;
  recordSchedulerHeartbeatSafely(): Promise<void>;
}
export interface PublishedPluginContent { collection: string; id: string }
export interface ConfiguredPluginRuntimeOptions extends Omit<PluginContextFactoryOptions, 'db' | 'getDb' | 'emailPipeline' | 'cronReschedule'> {
  database: CmsDatabase;
  /** Optional trusted event resolver; the actual request owner takes precedence. */
  getDatabase?: () => CmsDatabase;
  plugins: readonly PluginDefinition[];
  preferredHints?: Map<string, string[]>;
  fallbackProviders?: ReadonlySet<string>;
  createScheduler?: (executor: CronExecutor) => CronScheduler;
  maintenance?: PluginMaintenance;
}

/** Configured startup is implicitly active when no state exists; no install or activation write. */
export class CmsPluginRuntime {
  readonly configuredPlugins: ResolvedPlugin[];
  readonly sandboxedPluginEntries: SandboxedPluginEntry[] = [];
  readonly email: EmailPipeline;
  readonly cronExecutor: CronExecutor;
  readonly manager: {
    hasPlugin(id: string): boolean;
    isActive(id: string): boolean;
    getPlugin(id: string): ResolvedPlugin | undefined;
  };
  private pipeline: HookPipeline;
  private factoryOptions: PluginContextFactoryOptions;
  private readonly enabled = new Set<string>();
  private readonly states = new Map<string, string>();
  private scheduler?: CronScheduler;
  private storageIndexesSynced = false;
  private closed = false;
  private readonly extensionSynchronizers = new Map<'marketplace' | 'registry', () => Promise<void>>();

  private constructor(private readonly options: ConfiguredPluginRuntimeOptions, plugins: ResolvedPlugin[]) {
    this.configuredPlugins = plugins;
    this.factoryOptions = { ...options, db: this.db, getDb: () => this.db };
    this.pipeline = createHookPipeline([], this.factoryOptions);
    this.email = new EmailPipeline(this.pipeline);
    this.cronExecutor = new CronExecutor(() => this.db, async (pluginId, event) => {
      const result = await this.pipeline.invokeCronHook(pluginId, event);
      if (!result.success && result.error) throw result.error;
    }, options.now);
    this.manager = Object.freeze({
      hasPlugin: (id: string) => this.configuredPlugins.some(plugin => plugin.id === id),
      isActive: (id: string) => this.enabled.has(id),
      getPlugin: (id: string) => this.configuredPlugins.find(plugin => plugin.id === id)
    });
  }

  get database(): CmsDatabase { return currentOwner.getStore() ?? this.options.getDatabase?.() ?? this.options.database; }
  get db() { return pluginSourceDatabase(this.database); }
  get hooks(): HookPipeline { return this.pipeline; }
  get storage() { return this.options.storage ?? null; }

  static async create(options: ConfiguredPluginRuntimeOptions): Promise<CmsPluginRuntime> {
    const plugins = options.plugins.map(definition => definePlugin(definition));
    const ids = new Set<string>();
    for (const plugin of plugins) {
      if (ids.has(plugin.id)) throw new Error(`Plugin "${plugin.id}" is already registered`);
      ids.add(plugin.id);
    }
    const runtime = new CmsPluginRuntime(options, plugins);
    for (const state of await new PluginStateRepository(runtime.db).getAll()) runtime.states.set(state.pluginId, state.status);
    for (const plugin of plugins) {
      const state = runtime.states.get(plugin.id);
      if (state === undefined || state === 'active') runtime.enabled.add(plugin.id);
    }
    await runtime.rebuildHookPipeline();
    if (options.createScheduler) {
      runtime.scheduler = options.createScheduler(runtime.cronExecutor);
      runtime.scheduler.setSystemCleanup(() => runtime.runMaintenance());
      await runtime.scheduler.start();
    }
    return runtime;
  }

  private assertOpen(): void { if (this.closed) throw new Error('Plugin runtime is closed'); }
  isPluginEnabled(pluginId: string): boolean { return this.enabled.has(pluginId); }
  createContext(pluginId: string): PluginContext {
    this.assertOpen();
    const plugin = this.configuredPlugins.find(candidate => candidate.id === pluginId);
    if (!plugin || !this.enabled.has(pluginId)) throw new Error(`Plugin "${pluginId}" not found`);
    return new PluginContextFactory({ ...this.factoryOptions, emailPipeline: this.email, cronReschedule: () => this.scheduler?.reschedule() }).createContext(plugin);
  }

  private async rebuildHookPipeline(): Promise<void> {
    const pipeline = createHookPipeline(this.configuredPlugins.filter(plugin => this.enabled.has(plugin.id)), this.factoryOptions);
    const options = new OptionsRepository(this.db);
    await resolveExclusiveHooks({ pipeline, isActive: id => this.enabled.has(id),
      getOption: key => options.get<string>(key),
      getOptions: async keys => {
        const values = await options.getMany(keys);
        return new Map([...values].filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
      },
      setOption: (key, value) => options.set(key, value), deleteOption: key => options.delete(key),
      preferredHints: this.options.preferredHints, fallbackProviders: this.options.fallbackProviders });
    pipeline.setContextFactory({ emailPipeline: this.email, cronReschedule: () => this.scheduler?.reschedule() });
    this.email.setPipeline(pipeline);
    this.pipeline = pipeline;
  }

  async setPluginStatus(pluginId: string, status: 'active' | 'inactive'): Promise<void> {
    this.assertOpen();
    this.states.set(pluginId, status);
    if (status === 'active') {
      this.enabled.add(pluginId);
      await this.rebuildHookPipeline();
      await this.pipeline.runPluginActivate(pluginId);
    } else {
      try { await this.pipeline.runPluginDeactivate(pluginId); }
      finally { this.enabled.delete(pluginId); await this.rebuildHookPipeline(); }
    }
  }

  handlePluginList() { return handlePluginList(this.db, this.configuredPlugins, this.sandboxedPluginEntries); }
  handlePluginEnable(pluginId: string) { this.assertOpen(); return enableRuntimePlugin(this, pluginId); }
  handlePluginDisable(pluginId: string) { this.assertOpen(); return disableRuntimePlugin(this, pluginId); }
  async runPluginInstallLifecycle(pluginId: string): Promise<void> { await this.pipeline.runPluginInstall(pluginId); await this.pipeline.runPluginActivate(pluginId); }
  async runPluginActivateLifecycle(pluginId: string): Promise<void> { await this.pipeline.runPluginActivate(pluginId); }
  async runPluginUninstallLifecycle(pluginId: string, deleteData: boolean): Promise<void> {
    if (this.isPluginEnabled(pluginId)) {
      try { await this.pipeline.runPluginDeactivate(pluginId); }
      catch (error) { console.error(`EmDash: Plugin ${pluginId} deactivate hook failed during uninstall:`, error); }
    }
    try { await this.pipeline.runPluginUninstall(pluginId, deleteData); }
    catch (error) { console.error(`EmDash: Plugin ${pluginId} uninstall hook failed:`, error); }
  }

  /** PL2/PL3 provide real synchronizers; unavailable sources fail explicitly. */
  registerExtensionSynchronizer(source: 'marketplace' | 'registry', synchronize: () => Promise<void>): void { this.extensionSynchronizers.set(source, synchronize); }
  private async synchronize(source: 'marketplace' | 'registry'): Promise<void> {
    const synchronize = this.extensionSynchronizers.get(source);
    if (!synchronize) throw new Error(`Plugin ${source} runtime is not configured`);
    await synchronize();
  }
  syncMarketplacePlugins() { return this.synchronize('marketplace'); }
  syncRegistryPlugins() { return this.synchronize('registry'); }

  getPluginRouteMeta(pluginId: string, path: string) {
    if (!this.enabled.has(pluginId)) return null;
    const plugin = this.configuredPlugins.find(candidate => candidate.id === pluginId);
    if (!plugin) return null;
    const registry = new PluginRouteRegistry(this.factoryOptions); registry.register(plugin);
    return registry.getRouteMeta(pluginId, path.replace(/^\/+/, ''));
  }
  invokePluginRoute(pluginId: string, routeName: string, options: InvokeRouteOptions) {
    this.assertOpen();
    const registry = new PluginRouteRegistry({ ...this.factoryOptions, emailPipeline: this.email, cronReschedule: () => this.scheduler?.reschedule() });
    const plugin = this.configuredPlugins.find(candidate => candidate.id === pluginId);
    if (plugin && this.enabled.has(pluginId)) registry.register(plugin);
    return registry.invoke(pluginId, routeName.replace(/^\/+/, ''), options);
  }

  async syncPluginStorageIndexesOnce(): Promise<void> {
    if (this.storageIndexesSynced) return;
    this.storageIndexesSynced = true;
    await syncDeclaredStorageIndexes(this.db, this.configuredPlugins);
  }
  private async runMaintenance(onPublished?: (refs: PublishedPluginContent[]) => Promise<void>): Promise<PublishedPluginContent[]> {
    const maintenance = this.options.maintenance;
    if (!maintenance) throw new Error('The canonical scheduled maintenance producer is not configured');
    let published: PublishedPluginContent[] = [];
    try { published = await maintenance.publishScheduled(onPublished); }
    catch (error) { console.error('[scheduled-publish] Sweep failed:', error); }
    try { await maintenance.runSystemCleanup(); }
    catch (error) { console.error('[cleanup] System cleanup failed:', error); }
    try { await this.syncPluginStorageIndexesOnce(); }
    catch (error) { console.error('[plugins] Storage index sync failed:', error); }
    await maintenance.maybeRunScheduledBackup();
    await maintenance.recordSchedulerHeartbeatSafely();
    return published;
  }
  async runScheduledTasksWithStats(options: { onPublished?: (refs: PublishedPluginContent[]) => Promise<void> } = {}) {
    this.assertOpen();
    let processed = 0;
    try { processed = await this.cronExecutor.tick(); }
    catch (error) { console.error('[cron] Tick failed:', error); }
    try { await this.cronExecutor.recoverStaleLocks(); }
    catch (error) { console.error('[cron] Stale lock recovery failed:', error); }
    return { processed, published: await this.runMaintenance(options.onPublished) };
  }
  async runScheduledTasks(options: { onPublished?: (refs: PublishedPluginContent[]) => Promise<void> } = {}) {
    const { published } = await this.runScheduledTasksWithStats(options); return { published };
  }
  async stopCron(): Promise<void> { await this.scheduler?.stop(); }
  async shutdown(): Promise<void> { this.closed = true; await this.stopCron(); }
}

export function createConfiguredPluginRuntime(options: ConfiguredPluginRuntimeOptions): Promise<CmsPluginRuntime> { return CmsPluginRuntime.create(options); }
