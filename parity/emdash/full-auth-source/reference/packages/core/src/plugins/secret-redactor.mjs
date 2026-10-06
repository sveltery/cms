export function createPluginSecretRedactor() {
    const secretsByKey = new Map();
    const secretValues = () => [
        ...new Set([...secretsByKey.values()].flat().filter((value) => value !== undefined)),
    ].toSorted((a, b) => b.length - a.length);
    const redactString = (value) => {
        let redacted = value;
        for (const secret of secretValues()) {
            redacted = redacted.replaceAll(secret, "[REDACTED]");
        }
        return redacted;
    };
    const redactValue = (value, seen) => {
        if (typeof value === "string")
            return redactString(value);
        if (typeof value !== "object" || value === null)
            return value;
        const existing = seen.get(value);
        if (existing !== undefined)
            return existing;
        if (value instanceof Error) {
            const redacted = new Error(redactString(value.message));
            redacted.name = value.name;
            redacted.stack = value.stack ? redactString(value.stack) : undefined;
            seen.set(value, redacted);
            return redacted;
        }
        if (Array.isArray(value)) {
            const redacted = [];
            seen.set(value, redacted);
            for (const entry of value)
                redacted.push(redactValue(entry, seen));
            return redacted;
        }
        if (Object.getPrototypeOf(value) === Object.prototype ||
            Object.getPrototypeOf(value) === null) {
            const redacted = {};
            seen.set(value, redacted);
            for (const [key, entry] of Object.entries(value)) {
                redacted[redactString(key)] = redactValue(entry, seen);
            }
            return redacted;
        }
        return "[NonPlainObject]";
    };
    return {
        add(key, value) {
            if (value.length === 0)
                return;
            const current = secretsByKey.get(key)?.[0];
            if (current === value)
                return;
            secretsByKey.set(key, current ? [value, current] : [value]);
        },
        redact(value) {
            // eslint-disable-next-line typescript/no-unsafe-type-assertion -- redaction preserves the logged value's outer API shape
            return redactValue(value, new WeakMap());
        },
    };
}
