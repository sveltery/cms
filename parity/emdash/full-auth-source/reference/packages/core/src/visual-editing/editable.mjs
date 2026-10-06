/**
 * Visual editing annotation system
 *
 * Creates Proxy objects that emit data-emdash-ref attributes when spread onto elements.
 */
/**
 * Create an editable proxy for an entry.
 *
 * Usage:
 * - `{...entry.edit}` - entry-level annotation (includes status/hasDraft)
 * - `{...entry.edit.title}` - field-level annotation
 * - `{...entry.edit['nested.field']}` - nested field (bracket notation)
 */
export function createEditable(collection, id, options) {
    const base = {
        collection,
        id,
        ...(options?.status && { status: options.status }),
        ...(options?.hasDraft && { hasDraft: true }),
    };
    return new Proxy({}, {
        get(_, prop) {
            if (prop === "toJSON")
                return () => ({ "data-emdash-ref": JSON.stringify(base) });
            if (typeof prop === "symbol")
                return undefined;
            // data-emdash-ref access returns the entry-level string
            if (prop === "data-emdash-ref")
                return JSON.stringify(base);
            // Field-level: return a FieldAnnotation for the specific field
            return {
                "data-emdash-ref": JSON.stringify({ ...base, field: String(prop) }),
            };
        },
        ownKeys() {
            return ["data-emdash-ref"];
        },
        getOwnPropertyDescriptor(_, prop) {
            if (prop === "data-emdash-ref") {
                return {
                    configurable: true,
                    enumerable: true,
                    value: JSON.stringify(base),
                };
            }
            return undefined;
        },
    });
}
/**
 * Create a noop proxy for production mode.
 * Spreading this produces no attributes.
 */
export function createNoop() {
    return new Proxy({}, {
        get(_, prop) {
            if (typeof prop === "symbol")
                return undefined;
            // All property access returns undefined in noop mode
            return undefined;
        },
        ownKeys() {
            return [];
        },
        getOwnPropertyDescriptor() {
            return undefined;
        },
    });
}
