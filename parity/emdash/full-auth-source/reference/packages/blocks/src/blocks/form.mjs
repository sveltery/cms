import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button } from "@cloudflare/kumo";
import { useCallback, useState } from "react";
import { renderElement } from "../render-element.js";
function deepEqual(a, b) {
    if (a === b)
        return true;
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length)
            return false;
        return a.every((v, i) => deepEqual(v, b[i]));
    }
    return false;
}
function evaluateCondition(condition, values) {
    const fieldValue = values[condition.field];
    if ("eq" in condition && condition.eq !== undefined) {
        return deepEqual(fieldValue, condition.eq);
    }
    if ("neq" in condition && condition.neq !== undefined) {
        return !deepEqual(fieldValue, condition.neq);
    }
    return true;
}
function getInitialValues(fields) {
    const values = {};
    for (const field of fields) {
        if ("initial_value" in field && field.initial_value !== undefined) {
            values[field.action_id] = field.initial_value;
        }
    }
    return values;
}
export function FormBlockComponent({ block, onAction, }) {
    const [values, setValues] = useState(() => getInitialValues(block.fields));
    const handleChange = useCallback((actionId, value) => {
        setValues((prev) => ({ ...prev, [actionId]: value }));
    }, []);
    function submit() {
        onAction({
            type: "form_submit",
            action_id: block.submit.action_id,
            block_id: block.block_id,
            values,
        });
    }
    // Submit from the button's click so no native submit event is dispatched. Plugin editor
    // panels render inside the content editor's form, and Chromium stops a nested form's
    // `submit` from bubbling past the outer form, so React's onSubmit never runs and the
    // browser reloads the editor. Pressing Enter in a single-line input clicks this button
    // too. Preventing the click also skips the browser's validation, so run it here.
    function handleClick(e) {
        e.preventDefault();
        const form = e.currentTarget.form;
        if (form && !form.reportValidity())
            return;
        submit();
    }
    function handleSubmit(e) {
        e.preventDefault();
        submit();
    }
    return (_jsxs("form", { onSubmit: handleSubmit, className: "flex flex-col gap-4", children: [block.fields.map((field) => {
                if (field.condition && !evaluateCondition(field.condition, values)) {
                    return null;
                }
                return _jsx("div", { children: renderElement(field, onAction, handleChange) }, field.action_id);
            }), _jsx("div", { children: _jsx(Button, { type: "submit", onClick: handleClick, children: block.submit.label }) })] }));
}
