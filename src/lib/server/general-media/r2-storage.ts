// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; Copyright 2026 Cloudflare Inc. MIT; notices/emdash-MIT.txt.
// Complete pinned R2Storage class and URL constant; trusted native binding injection. Source cloudflare:workers env factory remains separate incomplete scope.
import type { R2Bucket as WorkerR2Bucket, R2Object, R2ObjectBody, R2PutOptions } from '@cloudflare/workers-types';
import type {Storage,UploadResult,DownloadResult,ListResult,ListOptions,SignedUploadUrl,SignedUploadOptions} from './upstream/storage/types.ts';
import {EmDashStorageError} from './upstream/storage/types.ts';

/** Native DOM streams and Worker streams have different ambient type declarations.
 * This trusted binding contract changes types only; the complete Source class
 * calls the supplied actual binding directly without wrapping its operations.
 */
export type R2Bucket = Pick<WorkerR2Bucket, 'delete' | 'head' | 'list'> & {
  put(key:string,body:Buffer | Uint8Array | ReadableStream<Uint8Array>,options?:R2PutOptions):Promise<R2Object|null>;
  get(key:string):Promise<(Omit<R2ObjectBody,'body'> & {body:ReadableStream<Uint8Array>})|null>;
};

const TRAILING_SLASH_REGEX = /\/$/;

export class R2Storage implements Storage {
	private bucket: R2Bucket;
	private publicUrl?: string;

	constructor(bucket: R2Bucket, publicUrl?: string) {
		this.bucket = bucket;
		this.publicUrl = publicUrl;
	}

	async upload(options: {
		key: string;
		body: Buffer | Uint8Array | ReadableStream<Uint8Array>;
		contentType: string;
		cacheControl?: string;
	}): Promise<UploadResult> {
		try {
			const result = await this.bucket.put(options.key, options.body, {
				httpMetadata: {
					contentType: options.contentType,
					cacheControl: options.cacheControl,
				},
			});

			if (!result) {
				throw new EmDashStorageError(`Failed to upload file: ${options.key}`, "UPLOAD_FAILED");
			}

			return {
				key: options.key,
				url: this.getPublicUrl(options.key),
				size: result.size,
			};
		} catch (error) {
			if (error instanceof EmDashStorageError) throw error;
			throw new EmDashStorageError(`Failed to upload file: ${options.key}`, "UPLOAD_FAILED", error);
		}
	}

	async download(key: string): Promise<DownloadResult> {
		try {
			const object = await this.bucket.get(key);

			if (!object) {
				throw new EmDashStorageError(`File not found: ${key}`, "NOT_FOUND");
			}

			// R2ObjectBody has the body property — use it as a type guard
			if (!("body" in object) || !object.body) {
				throw new EmDashStorageError(`File not found: ${key}`, "NOT_FOUND");
			}

			return {
				body: object.body,
				contentType: object.httpMetadata?.contentType || "application/octet-stream",
				size: object.size,
			};
		} catch (error) {
			if (error instanceof EmDashStorageError) throw error;
			throw new EmDashStorageError(`Failed to download file: ${key}`, "DOWNLOAD_FAILED", error);
		}
	}

	async delete(key: string): Promise<void> {
		try {
			await this.bucket.delete(key);
		} catch (error) {
			// R2 delete is idempotent
			throw new EmDashStorageError(`Failed to delete file: ${key}`, "DELETE_FAILED", error);
		}
	}

	async exists(key: string): Promise<boolean> {
		try {
			const object = await this.bucket.head(key);
			return object !== null;
		} catch (error) {
			throw new EmDashStorageError(`Failed to check file existence: ${key}`, "HEAD_FAILED", error);
		}
	}

	async list(options: ListOptions = {}): Promise<ListResult> {
		try {
			const response = await this.bucket.list({
				prefix: options.prefix,
				limit: options.limit,
				cursor: options.cursor,
			});

			return {
				files: response.objects.map((item) => ({
					key: item.key,
					size: item.size,
					lastModified: item.uploaded,
					etag: item.etag,
				})),
				nextCursor: response.truncated ? response.cursor : undefined,
			};
		} catch (error) {
			throw new EmDashStorageError("Failed to list files", "LIST_FAILED", error);
		}
	}

	async getSignedUploadUrl(_options: SignedUploadOptions): Promise<SignedUploadUrl> {
		// R2 doesn't support pre-signed URLs in the same way as S3
		// For R2, uploads go through the Worker
		// This method is here for interface compatibility but throws an error
		throw new EmDashStorageError(
			"R2 bindings do not support pre-signed upload URLs. " +
				"Use the S3 API with R2 credentials for signed URL support, " +
				"or upload through the Worker.",
			"NOT_SUPPORTED",
		);
	}

	getPublicUrl(key: string): string {
		if (this.publicUrl) {
			return `${this.publicUrl.replace(TRAILING_SLASH_REGEX, "")}/${key}`;
		}
		// Without a public URL, we can't generate one for R2 bindings
		// Return a relative path that should be served through the API
		return `/_emdash/api/media/file/${key}`;
	}
}
