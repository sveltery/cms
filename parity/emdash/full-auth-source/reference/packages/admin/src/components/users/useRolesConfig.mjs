import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react/macro";
import * as React from "react";
import { ROLE_ENTRIES } from "./roleDefinitions.js";
const MSG_ROLE_UNKNOWN = msg `Unknown`;
/**
 * Shared resolved role strings + descriptor rows for selects (after `i18n` is active).
 */
export function useRolesConfig() {
    const { t } = useLingui();
    const roles = React.useMemo(() => ROLE_ENTRIES.map(({ value, label, description }) => ({
        value,
        label: t(label),
        description: t(description),
    })), [t]);
    const roleLabels = React.useMemo(() => Object.fromEntries(ROLE_ENTRIES.map((r) => [String(r.value), t(r.label)])), [t]);
    const getRoleLabel = React.useCallback((level) => roleLabels[String(level)] ?? t(MSG_ROLE_UNKNOWN), [roleLabels, t]);
    return { roleLabels, getRoleLabel, roles };
}
