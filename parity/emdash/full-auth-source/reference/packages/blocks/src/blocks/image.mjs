import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ImageBlockComponent({ block }) {
    return (_jsxs("figure", { children: [_jsx("img", { src: block.url, alt: block.alt, className: "max-w-full rounded" }), block.title && (_jsx("figcaption", { className: "mt-1 text-sm text-kumo-subtle", children: block.title }))] }));
}
