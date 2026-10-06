// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Whole Source SandboxedPluginEntry declaration; no Source runtime identity claim.
import type { PluginCapability, PluginStorageConfig, PluginMcpManifestConfig, PluginManifest, SettingField, PortableTextBlockConfig, FieldWidgetConfig } from "./types.ts";
export interface SandboxedPluginEntry {
	id: string;
	version: string;
	options: Record<string, unknown>;
	code: string;
	/** Capabilities the plugin requests */
	capabilities: PluginCapability[];
	/** Allowed hosts for network:fetch */
	allowedHosts: string[];
	/** Declared storage collections */
	storage: PluginStorageConfig;
	/** Serialized MCP declarations emitted at plugin build time. */
	mcp?: PluginMcpManifestConfig;
	/** Route declarations (name + public/permission/cacheControl), used for route auth decisions */
	routes?: PluginManifest["routes"];
	/** Hook declarations this plugin implements */
	hooks?: PluginManifest["hooks"];
	/** Admin pages */
	adminPages?: Array<{ path: string; label?: string; icon?: string }>;
	/** Dashboard widgets */
	adminWidgets?: Array<{ id: string; title?: string; size?: string }>;
	/** Saved-entry Block Kit panels. */
	editorPanels?: PluginManifest["admin"]["editorPanels"];
	/** Saved-entry host-rendered actions. */
	editorActions?: PluginManifest["admin"]["editorActions"];
	/** Settings schema for the auto-generated admin settings form */
	settingsSchema?: Record<string, SettingField>;
	/** Portable Text block types contributed to the editor (declarative Block Kit) */
	portableTextBlocks?: PortableTextBlockConfig[];
	/** Field widget types contributed for schema-field editing UIs */
	fieldWidgets?: FieldWidgetConfig[];
	/** Admin entry module */
	adminEntry?: string;
	/**
	 * Exclusive hooks this plugin should be auto-selected for.
	 * Weaker than an existing admin DB selection — config order wins when no selection exists.
	 */
	preferred?: string[];
}

