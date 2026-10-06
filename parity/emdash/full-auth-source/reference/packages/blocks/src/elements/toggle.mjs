import { jsx as _jsx } from "react/jsx-runtime";
import { Switch } from "@cloudflare/kumo";
import { useCallback, useState } from "react";
export function ToggleElementComponent({ element, onAction, onChange, }) {
    const [checked, setChecked] = useState(element.initial_value ?? false);
    const handleChange = useCallback((value) => {
        setChecked(value);
        if (onChange) {
            onChange(element.action_id, value);
        }
        else {
            onAction({
                type: "block_action",
                action_id: element.action_id,
                value,
            });
        }
    }, [onChange, onAction, element.action_id]);
    return _jsx(Switch, { label: element.label, checked: checked, onCheckedChange: handleChange });
}
