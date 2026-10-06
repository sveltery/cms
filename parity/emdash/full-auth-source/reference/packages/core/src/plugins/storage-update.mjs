import { validateJsonFieldName } from "../database/validate.js";
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function requireRecord(value, label) {
    if (!isRecord(value)) {
        throw new TypeError(`${label} must be an object`);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError(`${label} must be a plain object`);
    }
    return value;
}
function operand(value) {
    if (typeof value === "string" || (typeof value === "number" && Number.isFinite(value))) {
        return value;
    }
    throw new TypeError("Storage guard operands must be strings or finite numbers");
}
function normalizeFilter(value) {
    if (value === null || typeof value === "boolean")
        return value;
    if (typeof value === "string" || typeof value === "number")
        return operand(value);
    const filter = requireRecord(value, "Storage guard filter");
    const values = filter.in;
    if (Array.isArray(values)) {
        return { in: Array.from(values, operand) };
    }
    const prefix = filter.startsWith;
    if (typeof prefix === "string") {
        return { startsWith: prefix };
    }
    const range = {};
    for (const key of ["gt", "gte", "lt", "lte"]) {
        if (key in filter) {
            const bound = filter[key];
            range[key] = bound === undefined ? undefined : operand(bound);
        }
    }
    return range;
}
export function parseStorageUpdate(value) {
    const args = requireRecord(value, "Storage update arguments");
    if (Object.keys(args).some((key) => key !== "where" && key !== "set" && key !== "delta")) {
        throw new TypeError("Unknown storage update argument");
    }
    const where = {};
    for (const [field, filter] of Object.entries(requireRecord(args.where, "Storage where guard"))) {
        validateJsonFieldName(field);
        where[field] = normalizeFilter(filter);
    }
    const set = args.set === undefined ? {} : requireRecord(args.set, "Storage set");
    const delta = args.delta === undefined ? {} : requireRecord(args.delta, "Storage delta");
    const setEntries = [];
    for (const [field, entry] of Object.entries(set)) {
        if (entry === undefined)
            continue;
        validateJsonFieldName(field);
        const serialized = JSON.stringify(entry);
        if (serialized === undefined)
            throw new TypeError("Storage set values must be JSON serializable");
        const normalized = JSON.parse(serialized);
        setEntries.push([field, normalized]);
    }
    const setFields = new Set(setEntries.map(([field]) => field));
    const deltaEntries = [];
    for (const [field, entry] of Object.entries(delta)) {
        if (entry === undefined)
            continue;
        validateJsonFieldName(field);
        if (setFields.has(field))
            throw new TypeError("Storage field appears in both set and delta");
        const spec = requireRecord(entry, "Storage numeric delta");
        const keys = Object.keys(spec);
        const key = keys[0];
        if (keys.length !== 1 || (key !== "inc" && key !== "dec")) {
            throw new TypeError("Storage delta must contain exactly one of inc or dec");
        }
        const amount = spec[key];
        if (typeof amount !== "number" || !Number.isSafeInteger(amount)) {
            throw new TypeError("Storage delta must be a safe integer");
        }
        deltaEntries.push([field, key === "dec" ? -amount : amount]);
    }
    if (setEntries.length + deltaEntries.length === 0) {
        throw new TypeError("Storage update requires at least one of set or delta");
    }
    return { where, setEntries, deltaEntries };
}
