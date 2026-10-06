import { jsx as _jsx } from "react/jsx-runtime";
import { Checkbox } from "@cloudflare/kumo";
import { useCallback, useEffect, useState } from "react";
export function CheckboxElementComponent({ element, onAction, onChange, }) {
    const [values, setValues] = useState(element.initial_value ?? []);
    useEffect(() => {
        setValues(element.initial_value ?? []);
    }, [element.initial_value]);
    const handleChange = useCallback((newValues) => {
        setValues(newValues);
        if (onChange) {
            onChange(element.action_id, newValues);
        }
        else {
            onAction({
                type: "block_action",
                action_id: element.action_id,
                value: newValues,
            });
        }
    }, [onChange, onAction, element.action_id]);
    return (_jsx(Checkbox.Group, { legend: element.label, value: values, onValueChange: handleChange, children: element.options.map((opt) => (_jsx(Checkbox.Item, { value: opt.value, label: opt.label }, opt.value))) }));
}
