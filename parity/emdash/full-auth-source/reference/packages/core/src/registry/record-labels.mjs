export function hasCurrentRecordLabel(labels, value, record, now = Date.now()) {
    return labels.some((label) => {
        if (label.val !== value ||
            label.uri !== record.uri ||
            label.cid !== record.cid ||
            label.neg === true) {
            return false;
        }
        if (label.exp === undefined)
            return true;
        const expiresAt = Date.parse(label.exp);
        return Number.isFinite(expiresAt) && expiresAt > now;
    });
}
