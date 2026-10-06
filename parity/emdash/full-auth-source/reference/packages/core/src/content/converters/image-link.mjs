export function normalizeImageLink(raw) {
    if (typeof raw === "string") {
        const href = raw.trim();
        return href ? { href } : null;
    }
    if (typeof raw !== "object" || raw === null)
        return null;
    const { href, blank } = raw;
    if (typeof href !== "string")
        return null;
    const trimmed = href.trim();
    if (!trimmed)
        return null;
    return blank === true ? { href: trimmed, blank: true } : { href: trimmed };
}
