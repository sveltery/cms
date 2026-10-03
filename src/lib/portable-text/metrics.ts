// Adapted from pinned EmDash 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// MIT Copyright 2026 Cloudflare Inc.; see notices/emdash-MIT.txt.
const WORDS_PER_MINUTE = 200;
const CJK_CHARACTERS_PER_MINUTE = 500;
const WHITESPACE_REGEX = /\s+/;
export const URL_SCHEME_REGEX = /^[a-z][a-z0-9+.-]*:/i;
export const WWW_PREFIX_REGEX = /^www\./i;

// CJK scripts do not separate words with spaces, so a split()-based count treats
// a whole paragraph as a single word. Count those characters individually.
const CJK_CHARACTER_REGEX =
	/\p{Script=Han}|\p{Script=Hangul}|\p{Script=Hiragana}|\p{Script=Katakana}/gu;

function countCjkCharacters(text: string): number {
	return text.match(CJK_CHARACTER_REGEX)?.length ?? 0;
}

function countNonCjkWords(text: string): number {
	return text.replace(CJK_CHARACTER_REGEX, " ").split(WHITESPACE_REGEX).filter(Boolean).length;
}

/**
 * Word count for the editor footer. CJK characters are counted individually
 * because they are not delimited by spaces; other scripts are counted by word.
 * Used as the `wordCounter` for the CharacterCount extension, whose default
 * (`text.split(' ')`) reports a spaceless CJK paragraph as a single word.
 */
export function countWords(text: string): number {
	return countNonCjkWords(text) + countCjkCharacters(text);
}

/**
 * Calculate reading time in minutes for the given text. Word-based scripts are
 * read at WORDS_PER_MINUTE and CJK characters at CJK_CHARACTERS_PER_MINUTE.
 * Returns 0 for an empty document.
 */
export function calculateReadingTime(text: string): number {
	return Math.ceil(
		countNonCjkWords(text) / WORDS_PER_MINUTE +
			countCjkCharacters(text) / CJK_CHARACTERS_PER_MINUTE,
	);
}

