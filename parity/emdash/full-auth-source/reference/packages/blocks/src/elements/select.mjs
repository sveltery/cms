import { jsx as _jsx } from "react/jsx-runtime";
import { Select } from "@cloudflare/kumo";
import { useCallback } from "react";
export function SelectElementComponent({ element, onAction, onChange, }) {
    const handleValueChange = useCallback((value) => {
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
    return (_jsx(Select, { label: element.label, defaultValue: element.initial_value, onValueChange: handleValueChange, items: element.options, children: element.options.map((opt) => (_jsx(Select.Option, { value: opt.value, children: opt.label }, opt.value))) }));
}
