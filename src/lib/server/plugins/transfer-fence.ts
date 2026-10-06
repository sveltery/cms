// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Complete Source fence error protocol only; no fence reader/writer or transfer implementation.
export type SiteWriteFenceCode =
	| "MEDIA_USAGE_ACTIVATION_IN_PROGRESS"
	| "MEDIA_USAGE_ACTIVATION_CHECK_FAILED"
	| "TRANSFER_IMPORT_IN_PROGRESS"
	| "TRANSFER_FENCE_CHECK_FAILED";

export interface SiteWriteFenceError {
	code: SiteWriteFenceCode;
	message: string;
	status: 503;
	/** The fencing import, when the fence is a transfer import. */
	operationId?: string;
}

export class SiteWriteBlockedError extends Error {
	readonly code: SiteWriteFenceCode;
	readonly status: 503;
	readonly operationId: string | undefined;

	constructor(error: SiteWriteFenceError) {
		super(error.message);
		this.name = error.code;
		this.code = error.code;
		this.status = error.status;
		this.operationId = error.operationId;
	}
}

