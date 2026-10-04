// Exact Source type declarations, EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// The complete owning source file remains retained in the source authority tree.
export interface VersionedValue<T = unknown> {
	value: T;
	/** Opaque host revision, valid only for the key from which it was read. */
	revision: string;
}
export type ConditionalWriteResult = { applied: true; revision: string } | { applied: false };
export interface ConditionalDeleteResult {
	applied: boolean;
}
