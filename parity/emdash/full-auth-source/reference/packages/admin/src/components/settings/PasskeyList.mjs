import { jsx as _jsx } from "react/jsx-runtime";
/**
 * PasskeyList - Displays a list of passkeys with actions
 */
import * as React from "react";
import { PasskeyItem } from "./PasskeyItem";
export function PasskeyList({ passkeys, onRename, onDelete, isDeleting, isRenaming, }) {
    return (_jsx("ul", { className: "divide-y divide-kumo-line", children: passkeys.map((passkey) => (_jsx(PasskeyItem, { passkey: passkey, canDelete: passkeys.length > 1, onRename: onRename, onDelete: onDelete, isDeleting: isDeleting, isRenaming: isRenaming }, passkey.id))) }));
}
