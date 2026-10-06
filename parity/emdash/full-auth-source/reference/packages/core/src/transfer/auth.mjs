export { TRANSFER_SCOPES, isTransferScope } from "@emdash-cms/auth";
/** Token scope a bearer-token caller needs for each transfer action. */
export const TRANSFER_ACTION_SCOPE = Object.freeze({
    export: "transfer:export",
    analyze: "transfer:analyze",
    execute: "transfer:execute",
});
/** RBAC permission a session caller needs for each transfer action. */
export const TRANSFER_ACTION_PERMISSION = Object.freeze({
    export: "transfer:export",
    analyze: "transfer:import",
    execute: "transfer:import",
});
/** Actions an MCP approval grant can authorize. */
export const TRANSFER_APPROVAL_ACTIONS = ["export", "import"];
