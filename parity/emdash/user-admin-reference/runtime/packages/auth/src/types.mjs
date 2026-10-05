/**
 * Core types for @emdash-cms/auth
 */
// ============================================================================
// Roles & Permissions
// ============================================================================
export const Role = {
    SUBSCRIBER: 10,
    CONTRIBUTOR: 20,
    AUTHOR: 30,
    EDITOR: 40,
    ADMIN: 50,
};
export function roleFromLevel(level) {
    const entry = Object.entries(Role).find(([, v]) => v === level);
    if (!entry)
        return undefined;
    const name = entry[0];
    if (isRoleName(name))
        return name;
    return undefined;
}
function isRoleName(value) {
    return value in Role;
}
const ROLE_LEVEL_MAP = new Map(Object.values(Role).map((v) => [v, v]));
export function toRoleLevel(value) {
    const level = ROLE_LEVEL_MAP.get(value);
    if (level !== undefined)
        return level;
    throw new Error(`Invalid role level: ${value}`);
}
const DEVICE_TYPE_MAP = {
    singleDevice: "singleDevice",
    multiDevice: "multiDevice",
};
export function toDeviceType(value) {
    const dt = DEVICE_TYPE_MAP[value];
    if (dt !== undefined)
        return dt;
    throw new Error(`Invalid device type: ${value}`);
}
const TOKEN_TYPE_MAP = {
    magic_link: "magic_link",
    email_verify: "email_verify",
    invite: "invite",
    recovery: "recovery",
};
export function toTokenType(value) {
    const tt = TOKEN_TYPE_MAP[value];
    if (tt !== undefined)
        return tt;
    throw new Error(`Invalid token type: ${value}`);
}
export function roleToLevel(name) {
    return Role[name];
}
// ============================================================================
// Auth Errors
// ============================================================================
export class AuthError extends Error {
    code;
    constructor(code, message) {
        super(message ?? code);
        this.code = code;
        this.name = "AuthError";
    }
}
