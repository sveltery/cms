import { jsx as _jsx } from "react/jsx-runtime";
import { CodeBlock as KumoCodeBlock } from "@cloudflare/kumo";
export function CodeBlockComponent({ block }) {
    return _jsx(KumoCodeBlock, { code: block.code, lang: block.language });
}
