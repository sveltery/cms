// Copyright 2026 Cloudflare Inc. MIT; see notices/emdash-MIT.txt.
// Pinned source 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; see docs/cloudflare-runtime-ports.json.
export type CmsConfigurationErrorCode = "BINDING_NOT_FOUND" | "CONFIGURATION_ERROR";

/** A configuration failure whose message is safe to return from the API. */
export class CmsConfigurationError extends Error {
  readonly code: CmsConfigurationErrorCode;
  override cause?: unknown;
	constructor(
		message: string,
		code: CmsConfigurationErrorCode,
		cause?: unknown,
	) {
		super(message);
    this.code = code;
    this.cause = cause;
		this.name = "CmsConfigurationError";
	}
}
