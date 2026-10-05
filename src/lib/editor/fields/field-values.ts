// EmDash 1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e, MIT; see notices/emdash-MIT.txt.
// Exact whole Source value/constraint declarations; React controls port separately.


const URL_PROTOCOL_PATTERN = /^https?:\/\//;
const SITE_RELATIVE_URL_PATTERN = /^(\/(?![/\\])|#)[^\t\n\r]*$/;
const CONTACT_URL_PATTERN = /^(mailto|tel):\S/i;

function isValidUrl(val: string): boolean {
	if (SITE_RELATIVE_URL_PATTERN.test(val) || CONTACT_URL_PATTERN.test(val)) return true;
	if (!URL_PROTOCOL_PATTERN.test(val)) return false;
	try {
		const url = new URL(val);
		if (url.protocol !== "http:" && url.protocol !== "https:") return false;
		if (url.hostname.includes("..")) return false;
		return url.hostname.includes(".") || url.hostname === "localhost";
	} catch {
		return false;
	}
}

interface Bounds {
	min?: number;
	max?: number;
}

function constraintNumber(validation: Record<string, unknown> | undefined, key: string) {
	const value = validation?.[key];
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function lengthConstraints(validation: Record<string, unknown> | undefined): Bounds {
	return {
		min: constraintNumber(validation, "minLength"),
		max: constraintNumber(validation, "maxLength"),
	};
}

function rangeConstraints(validation: Record<string, unknown> | undefined): Bounds {
	return { min: constraintNumber(validation, "min"), max: constraintNumber(validation, "max") };
}

function hasBounds({ min, max }: Bounds) {
	return min !== undefined || max !== undefined;
}

function isOutOfBounds(value: number, { min, max }: Bounds, hasValue: boolean) {
	if (max !== undefined && value > max) return true;
	return hasValue && min !== undefined && value < min;
}


export function isNonListValue(value: unknown): boolean {
	if (value == null || Array.isArray(value)) return false;
	return !(typeof value === "string" && value.trim() === "");
}

export { isValidUrl, lengthConstraints, rangeConstraints, hasBounds, isOutOfBounds };
