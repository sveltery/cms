/** A configuration failure whose message is safe to return from the API. */
export class EmDashConfigurationError extends Error {
    code;
    cause;
    constructor(message, code, cause) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.name = "EmDashConfigurationError";
    }
}
