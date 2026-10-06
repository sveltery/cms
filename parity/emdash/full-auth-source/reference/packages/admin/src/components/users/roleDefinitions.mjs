import { msg } from "@lingui/core/macro";
/**
 * Canonical role levels for admin UI (badge colors, selects, labels).
 * Allowed Domains UI only offers default roles up to Editor (40), not Admin (50).
 */
export const ROLE_ENTRIES = [
    {
        value: 10,
        color: "gray",
        label: msg `Subscriber`,
        description: msg `Can view content`,
    },
    {
        value: 20,
        color: "blue",
        label: msg `Contributor`,
        description: msg `Can create content`,
    },
    {
        value: 30,
        color: "green",
        label: msg `Author`,
        description: msg `Can publish own content`,
    },
    {
        value: 40,
        color: "purple",
        label: msg `Editor`,
        description: msg `Can manage all content`,
    },
    {
        value: 50,
        color: "red",
        label: msg `Admin`,
        description: msg `Full access`,
    },
];
const ROLE_CONFIG = Object.fromEntries(ROLE_ENTRIES.map((e) => [
    e.value,
    { label: e.label, description: e.description, color: e.color },
]));
function unknownRoleConfig(role) {
    return {
        label: msg `Role ${role}`,
        description: msg `Unknown role`,
        color: "gray",
    };
}
/** Badge / display config for a numeric role level */
export function getRoleConfig(role) {
    return ROLE_CONFIG[role] ?? unknownRoleConfig(role);
}
