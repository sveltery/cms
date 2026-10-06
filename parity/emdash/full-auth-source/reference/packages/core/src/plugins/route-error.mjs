/**
 * Error class for plugin routes
 * Allows plugins to return structured errors with specific HTTP status codes
 */
export class PluginRouteError extends Error {
    code;
    status;
    details;
    constructor(code, message, status = 400, details) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details;
        this.name = "PluginRouteError";
    }
    /**
     * Create a bad request error (400)
     */
    static badRequest(message, details) {
        return new PluginRouteError("BAD_REQUEST", message, 400, details);
    }
    /**
     * Create an unauthorized error (401)
     */
    static unauthorized(message = "Unauthorized") {
        return new PluginRouteError("UNAUTHORIZED", message, 401);
    }
    /**
     * Create a forbidden error (403)
     */
    static forbidden(message = "Forbidden") {
        return new PluginRouteError("FORBIDDEN", message, 403);
    }
    /**
     * Create a not found error (404)
     */
    static notFound(message = "Not found") {
        return new PluginRouteError("NOT_FOUND", message, 404);
    }
    /**
     * Create a conflict error (409)
     */
    static conflict(message, details) {
        return new PluginRouteError("CONFLICT", message, 409, details);
    }
    /**
     * Create an internal error (500)
     */
    static internal(message = "Internal error") {
        return new PluginRouteError("INTERNAL_ERROR", message, 500);
    }
}
