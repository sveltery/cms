const DIGEST_DOMAIN = "@emdash-cms/plugin-types/declared-access";
const DIGEST_VERSION = 1;
function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function isStringArray(value) {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
}
function compareStrings(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}
function defineDataProperty(target, key, value) {
    Object.defineProperty(target, key, {
        value,
        writable: true,
        enumerable: true,
        configurable: true,
    });
}
function canonicalizeJson(value, ancestors, path) {
    if (value === null || typeof value === "string" || typeof value === "boolean")
        return value;
    if (typeof value === "number") {
        if (!Number.isFinite(value))
            throw new TypeError(`Non-finite number at ${path.join(".") || "root"}`);
        return Object.is(value, -0) ? 0 : value;
    }
    if (typeof value !== "object") {
        throw new TypeError(`Non-JSON value at ${path.join(".") || "root"}`);
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
        throw new TypeError(`Symbol-keyed property at ${path.join(".") || "root"}`);
    }
    if (ancestors.has(value))
        throw new TypeError(`Circular value at ${path.join(".") || "root"}`);
    ancestors.add(value);
    let result;
    if (Array.isArray(value)) {
        const output = [];
        for (let index = 0; index < value.length; index++) {
            if (!Object.hasOwn(value, index)) {
                throw new TypeError(`Sparse array at ${[...path, String(index)].join(".")}`);
            }
            output.push(canonicalizeJson(value[index], ancestors, [...path, String(index)]));
        }
        result = Object.freeze(output);
    }
    else {
        const prototype = Object.getPrototypeOf(value);
        if (prototype !== Object.prototype && prototype !== null) {
            throw new TypeError(`Non-JSON object at ${path.join(".") || "root"}`);
        }
        const output = {};
        for (const key of Object.keys(value).toSorted(compareStrings)) {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor || !("value" in descriptor)) {
                throw new TypeError(`Non-JSON property at ${[...path, key].join(".")}`);
            }
            defineDataProperty(output, key, canonicalizeJson(descriptor.value, ancestors, [...path, key]));
        }
        result = Object.freeze(output);
    }
    ancestors.delete(value);
    return result;
}
function requireObject(value, path) {
    if (!isObject(value))
        throw new TypeError(`Expected object at ${path.join(".") || "root"}`);
    return value;
}
function normalizeDeclaredAccess(value) {
    const canonical = requireObject(canonicalizeJson(value, new Set(), []), []);
    const output = {};
    for (const category of Object.keys(canonical)) {
        const operations = requireObject(canonical[category], [category]);
        const normalizedOperations = {};
        for (const operation of Object.keys(operations)) {
            const constraints = requireObject(operations[operation], [category, operation]);
            const normalizedConstraints = { ...constraints };
            if (category === "network" &&
                operation === "request" &&
                Object.hasOwn(constraints, "allowedHosts")) {
                const hosts = constraints.allowedHosts;
                if (!isStringArray(hosts)) {
                    throw new TypeError("Expected network.request.allowedHosts to be an array of strings");
                }
                normalizedConstraints.allowedHosts = Object.freeze([...new Set(hosts)].toSorted(compareStrings));
            }
            defineDataProperty(normalizedOperations, operation, Object.freeze(normalizedConstraints));
        }
        if (category === "comments" && Object.hasOwn(normalizedOperations, "moderate")) {
            normalizedOperations.read ??= Object.freeze({});
        }
        if ((((category === "content" ||
            category === "media" ||
            category === "redirects" ||
            category === "taxonomies") &&
            Object.hasOwn(normalizedOperations, "write")) ||
            (category === "content" && Object.hasOwn(normalizedOperations, "publish"))) &&
            !Object.hasOwn(normalizedOperations, "read")) {
            normalizedOperations.read = Object.freeze({});
        }
        if (category === "content" && Object.hasOwn(normalizedOperations, "revisionsRead")) {
            normalizedOperations.read ??= Object.freeze({});
        }
        defineDataProperty(output, category, Object.freeze(Object.fromEntries(Object.entries(normalizedOperations).toSorted(([left], [right]) => compareStrings(left, right)))));
    }
    return Object.freeze(output);
}
/**
 * Returns an immutable, implication-closed declared-access value with recursively
 * sorted keys and canonical host sets. Non-JSON runtime values throw TypeError.
 */
export function canonicalizeDeclaredAccess(value) {
    return normalizeDeclaredAccess(value);
}
function canonicalString(value) {
    return JSON.stringify(canonicalizeDeclaredAccess(value));
}
export function declaredAccessEqual(previous, next) {
    return canonicalString(previous) === canonicalString(next);
}
function change(kind, category, operation, path, previous, next, escalation) {
    return Object.freeze({
        kind,
        category,
        operation,
        path: Object.freeze([...path]),
        previous,
        next,
        escalation,
    });
}
function patternCovers(oldPattern, newPattern) {
    if (oldPattern === "*")
        return true;
    if (oldPattern === newPattern)
        return true;
    if (!oldPattern.startsWith("*."))
        return oldPattern === newPattern;
    const oldSuffix = oldPattern.slice(1);
    if (newPattern.startsWith("*.")) {
        const newSuffix = newPattern.slice(1);
        return newSuffix !== oldSuffix && newSuffix.endsWith(oldSuffix);
    }
    return newPattern.endsWith(oldSuffix) && newPattern.length > oldSuffix.length;
}
function hostsEscalate(previous, next) {
    return next.some((nextPattern) => !previous.some((oldPattern) => patternCovers(oldPattern, nextPattern)));
}
function valuesEqual(previous, next) {
    return JSON.stringify(previous) === JSON.stringify(next);
}
function diffConstraints(previous, next, category, operation) {
    const changes = [];
    const keys = [...new Set([...Object.keys(previous), ...Object.keys(next)])].toSorted(compareStrings);
    for (const key of keys) {
        const hadOldValue = Object.hasOwn(previous, key);
        const hasNewValue = Object.hasOwn(next, key);
        const oldValue = previous[key];
        const newValue = next[key];
        const path = [category, operation, key];
        const knownHosts = category === "network" && operation === "request" && key === "allowedHosts";
        if (!hadOldValue) {
            changes.push(change("constraint-added", category, operation, path, undefined, newValue, !knownHosts));
        }
        else if (!hasNewValue) {
            changes.push(change("constraint-removed", category, operation, path, oldValue, undefined, true));
        }
        else {
            if (oldValue === undefined || newValue === undefined) {
                throw new TypeError(`Non-JSON constraint at ${path.join(".")}`);
            }
            if (valuesEqual(oldValue, newValue))
                continue;
            let escalation = true;
            if (knownHosts) {
                if (!isStringArray(oldValue) || !isStringArray(newValue)) {
                    throw new TypeError("Expected network.request.allowedHosts to be arrays of strings");
                }
                escalation = hostsEscalate(oldValue, newValue);
            }
            changes.push(change("constraint-changed", category, operation, path, oldValue, newValue, escalation));
        }
    }
    return changes;
}
export function diffDeclaredAccess(previous, next) {
    const oldAccess = normalizeDeclaredAccess(previous);
    const newAccess = normalizeDeclaredAccess(next);
    const changes = [];
    const categories = [...new Set([...Object.keys(oldAccess), ...Object.keys(newAccess)])].toSorted(compareStrings);
    for (const category of categories) {
        const hadOldCategory = Object.hasOwn(oldAccess, category);
        const hasNewCategory = Object.hasOwn(newAccess, category);
        const oldCategory = oldAccess[category];
        const newCategory = newAccess[category];
        if (!hadOldCategory) {
            changes.push(change("category-added", category, undefined, [category], undefined, newCategory, true));
            continue;
        }
        if (!hasNewCategory) {
            changes.push(change("category-removed", category, undefined, [category], oldCategory, undefined, false));
            continue;
        }
        if (oldCategory === undefined || newCategory === undefined) {
            throw new TypeError(`Non-JSON category at ${category}`);
        }
        const oldOperations = requireObject(oldCategory, [category]);
        const newOperations = requireObject(newCategory, [category]);
        const operations = [
            ...new Set([...Object.keys(oldOperations), ...Object.keys(newOperations)]),
        ].toSorted(compareStrings);
        for (const operation of operations) {
            const hadOldOperation = Object.hasOwn(oldOperations, operation);
            const hasNewOperation = Object.hasOwn(newOperations, operation);
            const oldOperation = oldOperations[operation];
            const newOperation = newOperations[operation];
            if (!hadOldOperation) {
                changes.push(change("operation-added", category, operation, [category, operation], undefined, newOperation, true));
            }
            else if (!hasNewOperation) {
                changes.push(change("operation-removed", category, operation, [category, operation], oldOperation, undefined, false));
            }
            else {
                if (oldOperation === undefined || newOperation === undefined) {
                    throw new TypeError(`Non-JSON operation at ${category}.${operation}`);
                }
                changes.push(...diffConstraints(requireObject(oldOperation, [category, operation]), requireObject(newOperation, [category, operation]), category, operation));
            }
        }
    }
    return Object.freeze({
        changes: Object.freeze(changes),
        escalation: changes.some((item) => item.escalation),
    });
}
export function isDeclaredAccessEscalation(previous, next) {
    return diffDeclaredAccess(previous, next).escalation;
}
/**
 * Returns the canonical JSON preimage for a declared-access digest. The format
 * is domain-separated and versioned; callers choose and apply the hash.
 */
export function declaredAccessDigestInput(value) {
    return `{"declaredAccess":${canonicalString(value)},"domain":${JSON.stringify(DIGEST_DOMAIN)},"version":${DIGEST_VERSION}}`;
}
