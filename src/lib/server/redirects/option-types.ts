// EmDash 1.1.0 MIT, Copyright 2026 Cloudflare Inc.; see notices/emdash-MIT.txt.
// Source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e:packages/core/src/plugins/types.ts; blob 4c70d4438aebb76eb711482a8ed1e312b452fe1a.
export interface VersionedValue<T = unknown> {
	value: T;
	/** Opaque host revision, valid only for the key from which it was read. */
	revision: string;
}

export type ConditionalWriteResult = { applied: true; revision: string } | { applied: false };

export interface ConditionalDeleteResult {
	applied: boolean;
}
