// EmDash1.1.0 MIT, Copyright2026 Cloudflare Inc.; notices/emdash-MIT.txt.
// Immutable913cb1bb9b7f08c3ff0d258b4420e53835b6a58e whole authorities retained.
// Exact Source redirect interface declarations; full plugin context is unimplemented.
export interface PaginatedResult<T> {
	items: T[];
	cursor?: string;
	hasMore: boolean;
}

export type RedirectStatus = 301 | 302 | 307 | 308 | 410 | 451;

export interface RedirectInfo {
	id: string;
	source: string;
	destination: string;
	type: RedirectStatus;
	isPattern: boolean;
	enabled: boolean;
	hits: number;
	lastHitAt: string | null;
	groupName: string | null;
	auto: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface VersionedRedirect {
	redirect: RedirectInfo;
	/** Opaque host revision. Pass it back unchanged for update or delete. */
	_rev: string;
}

export interface RedirectListOptions {
	limit?: number;
	cursor?: string;
	search?: string;
	group?: string;
	enabled?: boolean;
	auto?: boolean;
}

export interface RedirectCreateInput {
	source: string;
	destination?: string;
	type?: RedirectStatus;
	enabled?: boolean;
	groupName?: string | null;
}

export interface RedirectUpdateInput {
	source?: string;
	destination?: string;
	type?: RedirectStatus;
	enabled?: boolean;
	groupName?: string | null;
}

export interface RedirectAccess {
	list(options?: RedirectListOptions): Promise<PaginatedResult<RedirectInfo>>;
	get(id: string): Promise<VersionedRedirect | null>;
	create?(input: RedirectCreateInput): Promise<VersionedRedirect>;
	update?(id: string, input: RedirectUpdateInput & { _rev: string }): Promise<VersionedRedirect>;
	delete?(id: string, options: { _rev: string }): Promise<boolean>;
}

export interface RedirectAccessWithWrite extends RedirectAccess {
	create(input: RedirectCreateInput): Promise<VersionedRedirect>;
	update(id: string, input: RedirectUpdateInput & { _rev: string }): Promise<VersionedRedirect>;
	delete(id: string, options: { _rev: string }): Promise<boolean>;
}


export interface RedirectPluginContext {redirects?:RedirectAccess|RedirectAccessWithWrite}
// Source test transport imports this bounded native context; no full PluginContext typing credit.
export type PluginContext=RedirectPluginContext;
