import { jsx as _jsx } from "react/jsx-runtime";
import { ButtonElementComponent } from "./elements/button.js";
import { CheckboxElementComponent } from "./elements/checkbox.js";
import { ComboboxElementComponent } from "./elements/combobox.js";
import { DateInputElementComponent } from "./elements/date-input.js";
import { LinkElementComponent } from "./elements/link.js";
import { MenuElementComponent } from "./elements/menu.js";
import { NumberInputElementComponent } from "./elements/number-input.js";
import { RadioElementComponent } from "./elements/radio.js";
import { SecretInputElementComponent } from "./elements/secret-input.js";
import { SelectElementComponent } from "./elements/select.js";
import { TextInputElementComponent } from "./elements/text-input.js";
import { ToggleElementComponent } from "./elements/toggle.js";
export function renderElement(element, onAction, onChange, resolveLinkTarget) {
    switch (element.type) {
        case "button":
            return _jsx(ButtonElementComponent, { element: element, onAction: onAction });
        case "link":
            return _jsx(LinkElementComponent, { element: element, resolveTarget: resolveLinkTarget });
        case "menu":
            return _jsx(MenuElementComponent, { element: element, onAction: onAction });
        case "text_input":
            return (_jsx(TextInputElementComponent, { element: element, onAction: onAction, onChange: onChange }));
        case "number_input":
            return (_jsx(NumberInputElementComponent, { element: element, onAction: onAction, onChange: onChange }));
        case "select":
            return _jsx(SelectElementComponent, { element: element, onAction: onAction, onChange: onChange });
        case "toggle":
            return _jsx(ToggleElementComponent, { element: element, onAction: onAction, onChange: onChange });
        case "secret_input":
            return (_jsx(SecretInputElementComponent, { element: element, onAction: onAction, onChange: onChange }));
        case "checkbox":
            return _jsx(CheckboxElementComponent, { element: element, onAction: onAction, onChange: onChange });
        case "radio":
            return _jsx(RadioElementComponent, { element: element, onAction: onAction, onChange: onChange });
        case "date_input":
            return (_jsx(DateInputElementComponent, { element: element, onAction: onAction, onChange: onChange }));
        case "combobox":
            return _jsx(ComboboxElementComponent, { element: element, onAction: onAction, onChange: onChange });
        case "repeater":
            // Admin-authoring only. The runtime block renderer never returns a
            // DOM node for `repeater` — values are persisted on the parent
            // block and consumed by the plugin's own runtime component.
            if (import.meta.env?.DEV) {
                console.warn("[blocks] renderElement: 'repeater' is an admin-authoring element and renders nothing at runtime");
            }
            return null;
        case "media_picker":
            return null;
        default: {
            const _exhaustive = element;
            return null;
        }
    }
}
