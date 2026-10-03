// Selected whole Source type declarations; MIT Copyright 2026 Cloudflare Inc.
// See immutable authority packages/core/src/plugins/types.ts, pin913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.


/**
 * Read-only user information exposed to plugins.
 * Sensitive fields (password hashes, sessions, passkeys) are excluded.
 */
export interface UserInfo {
	id: string;
	email: string;
	name: string | null;
	role: number;
	createdAt: string;
}


/**
 * Email message shape
 */
export interface EmailMessage {
	to: string;
	/** Additional visible recipients. */
	cc?: string[];
	/** Address that replies go to instead of the sender. */
	replyTo?: string;
	subject: string;
	text: string;
	html?: string;
}


// =============================================================================
// Comment Types
// =============================================================================

/**
 * Collection comment settings (read from _emdash_collections)
 */
export interface CollectionCommentSettings {
	commentsEnabled: boolean;
	commentsModeration: "all" | "first_time" | "none";
	commentsClosedAfterDays: number;
	commentsAutoApproveUsers: boolean;
}


/**
 * Event passed to comment:beforeCreate hooks (middleware — transform, enrich, reject)
 */
export interface CommentBeforeCreateEvent {
	comment: {
		collection: string;
		contentId: string;
		parentId: string | null;
		authorName: string;
		authorEmail: string;
		authorUserId: string | null;
		body: string;
		ipHash: string | null;
		userAgent: string | null;
	};
	/** Metadata bag — plugins can attach signals for the moderator */
	metadata: Record<string, unknown>;
}


/**
 * Event passed to comment:moderate hook (exclusive — decides initial status)
 */
export interface CommentModerateEvent {
	comment: CommentBeforeCreateEvent["comment"];
	metadata: Record<string, unknown>;
	collectionSettings: CollectionCommentSettings;
	/** Number of prior approved comments from this email address */
	priorApprovedCount: number;
}


/**
 * Moderation decision returned by the comment:moderate handler
 */
export interface ModerationDecision {
	status: "approved" | "pending" | "spam";
	/** Optional reason for admin visibility */
	reason?: string;
}


/**
 * Stored comment shape (full record with id, status, timestamps)
 */
export interface StoredComment {
	id: string;
	collection: string;
	contentId: string;
	parentId: string | null;
	authorName: string;
	authorEmail: string;
	authorUserId: string | null;
	body: string;
	status: string;
	moderationMetadata: Record<string, unknown> | null;
	createdAt: string;
	updatedAt: string;
}


/**
 * Event passed to comment:afterCreate hooks (fire-and-forget)
 */
export interface CommentAfterCreateEvent {
	comment: StoredComment;
	metadata: Record<string, unknown>;
	/** The content item the comment is on */
	content: { id: string; collection: string; slug: string; title?: string };
	/** The content author (for notifications) */
	contentAuthor?: { id: string; name: string | null; email: string };
}


/**
 * Event passed to comment:afterModerate hooks (fire-and-forget, admin status change)
 */
export interface CommentAfterModerateEvent {
	comment: StoredComment;
	previousStatus: string;
	newStatus: string;
	/** The admin who moderated */
	moderator: { id: string; name: string | null };
	/** Identifies whether an administrator or a plugin initiated the transition. */
	origin?: { source: "admin"; userId: string } | { source: "plugin"; pluginId: string };
}

// Native bounded provider context; unsupported domains are not supplied.
export interface PluginContext {
 readonly log?: { info(...values: unknown[]): void; warn(...values: unknown[]): void; error(...values: unknown[]): void };
 readonly users?: { get(id: string): Promise<UserInfo | null> };
}
export interface HookHandlerMap {
 'comment:beforeCreate': (event: CommentBeforeCreateEvent, context: PluginContext) => Promise<CommentBeforeCreateEvent | false>;
 'comment:moderate': (event: CommentModerateEvent, context: PluginContext) => Promise<ModerationDecision>;
 'comment:afterCreate': (event: CommentAfterCreateEvent, context: PluginContext) => Promise<void>;
 'comment:afterModerate': (event: CommentAfterModerateEvent, context: PluginContext) => Promise<void>;
}
export type HookNameV2 = keyof HookHandlerMap;
export interface ResolvedHook<T> {
 handler: T; pluginId: string; priority: number; timeout: number;
 dependencies: string[]; errorPolicy: 'abort' | 'continue'; exclusive: boolean;
}
export interface HookConfig<T> {
 handler: T; priority?: number; timeout?: number; dependencies?: string[];
 errorPolicy?: 'abort' | 'continue'; exclusive?: boolean;
}
export interface PluginDefinition {
 id: string; version: string; capabilities: string[];
 hooks: { [Name in HookNameV2]?: HookHandlerMap[Name] | HookConfig<HookHandlerMap[Name]> };
}
export interface ResolvedPlugin {
 id: string; version: string; capabilities: string[];
 hooks: { [Name in HookNameV2]?: ResolvedHook<HookHandlerMap[Name]> };
}



export interface VersionedValue<T = unknown> {
	value: T;
	/** Opaque host revision, valid only for the key from which it was read. */
	revision: string;
}


export type ConditionalWriteResult = { applied: true; revision: string } | { applied: false };


export interface ConditionalDeleteResult {
	applied: boolean;
}


// =============================================================================
// Request Metadata Types
// =============================================================================

/**
 * Geographic location information derived from the request.
 * Available when running on Cloudflare Workers (via the `cf` object).
 */
export interface GeoInfo {
	country: string | null;
	region: string | null;
	city: string | null;
}


/**
 * Normalized request metadata available to plugin route handlers.
 * Extracted from request headers and platform-specific properties.
 */
export interface RequestMeta {
	ip: string | null;
	userAgent: string | null;
	referer: string | null;
	geo: GeoInfo | null;
}
