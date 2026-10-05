// IDs generated from whole immutable IframeBlockNode, EmbedBlockShell and CodeEditor
// by the installed Source-exact Lingui macro compiler. EmDash1.1.0
// 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e; MIT notices/emdash-MIT.txt.
import type { MessageDescriptor } from '@lingui/core';
import type { Translate } from './types';

export const EMBED_MESSAGE_IDS: Readonly<Record<string, string>> = {
  "Code": "EWPtMO",
  "Preview": "rdUucN",
  "No iframe found in this code. For an embed that runs a script, use an HTML block.": "SIXKt2",
  "Only https links can be embedded.": "EeUenc",
  "Embedded content": "aETRCY",
  "Iframe block options": "YbH0Y5",
  "This block embeds a page from {0}.": "nMPsXp",
  "Load preview": "LIm+1B",
  "Nothing to preview yet.": "bp04ce",
  "Embed code": "xIxm0t",
  "Paste an embed code or an https link…": "PnRbc/",
  "The code editor couldn't load. Save your work, then reload the page.": "3EdpI3",
  "Reload page": "tF5Smn",
  "Delete block": "hHMv6l",
  "Press Escape to leave the code editor.": "8ydGzJ"
};

export function embedMessage(translate: Translate, message: string, values?: MessageDescriptor['values']): string {
  return translate({ id: EMBED_MESSAGE_IDS[message], message, ...(values ? { values } : {}) });
}
