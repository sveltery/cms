/**
 * Storage Layer Types
 *
 * Defines the interface for S3-compatible storage backends.
 * Works with R2, AWS S3, Minio, and other S3-compatible services.
 */
/**
 * Storage error with additional context
 */
export class EmDashStorageError extends Error {
    code;
    cause;
    constructor(message, code, cause) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.name = "EmDashStorageError";
    }
}
