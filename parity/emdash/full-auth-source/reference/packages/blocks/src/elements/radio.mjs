import { jsx as _jsx } from "react/jsx-runtime";
import { Radio } from "@cloudflare/kumo";
import { useCallback, useEffect, useState } from "react";
export function RadioElementComponent({ element, onAction, onChange, }) {
    const [value, setValue] = useState(element.initial_value ?? "");
    useEffect(() => {
        setValue(element.initial_value ?? "");
    }, [element.initial_value]);
    const handleChange = useCallback((newValue) => {
        setValue(newValue);
        if (onChange) {
            onChange(element.action_id, newValue);
        }
        else {
            onAction({
                type: "block_action",
                action_id: element.action_id,
                value: newValue,
            });
        }
    }, [onChange, onAction, element.action_id]);
    return (_jsx(Radio.Group, { legend: element.label, value: value, onValueChange: handleChange, children: element.options.map((opt) => (_jsx(Radio.Item, { value: opt.value, label: opt.label }, opt.value))) }));
}
