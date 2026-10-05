// Ported from EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// Source: packages/admin/src/components/editor/CodeBlockNode.tsx; MIT, see notices/emdash-MIT.txt.

import { common, createLowlight } from 'lowlight';
import dockerfile from 'highlight.js/lib/languages/dockerfile';


const ADMIN_CODE_BLOCK_LOWLIGHT_KEY = Symbol.for("emdash:admin-code-block-lowlight");
const globalStore = globalThis as Record<symbol, unknown>;
const lowlight =
	// eslint-disable-next-line typescript/no-unsafe-type-assertion -- globalThis singleton pattern
	(globalStore[ADMIN_CODE_BLOCK_LOWLIGHT_KEY] as ReturnType<typeof createLowlight> | undefined) ??
	(() => {
		const instance = createLowlight(common);
		instance.register({ dockerfile });
		globalStore[ADMIN_CODE_BLOCK_LOWLIGHT_KEY] = instance;
		return instance;
	})();

const editorLowlight = {
	highlight(language: string, value: string) {
		return lowlight.highlight(lowlight.registered(language) ? language : "plaintext", value);
	},
	highlightAuto(value: string) {
		return lowlight.highlight("plaintext", value);
	},
	listLanguages() {
		return lowlight.listLanguages();
	},
	registered(language: string) {
		return lowlight.registered(language);
	},
};

async function copyTextToClipboard(text: string, shouldUseFallback: () => boolean): Promise<void> {
	if (navigator.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return;
		} catch {}
	}
	if (!shouldUseFallback()) return;
	const activeElement = document.activeElement;
	const selection = document.getSelection();
	const previousRange = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
	const textarea = document.createElement("textarea");
	textarea.value = text;
	textarea.readOnly = true;
	textarea.style.position = "fixed";
	textarea.style.opacity = "0";
	document.body.append(textarea);
	textarea.select();
	try {
		if (!document.execCommand("copy")) throw new Error("Clipboard copy failed");
	} finally {
		textarea.remove();
		if (activeElement instanceof HTMLElement && activeElement.isConnected) activeElement.focus();
		if (previousRange) {
			selection?.removeAllRanges();
			selection?.addRange(previousRange);
		}
	}
}

export { editorLowlight, copyTextToClipboard };
