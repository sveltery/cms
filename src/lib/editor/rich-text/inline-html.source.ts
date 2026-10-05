// Native transport of the whole private cleanInlineHtml algorithm from pinned
// EmDash HtmlBlockPreview; DOMPurify is an isolated instance, never global hooks.
import DOMPurify from 'dompurify';
import { SITE_HTML_ALLOWED_ATTRIBUTES, SITE_HTML_ALLOWED_SCHEMES, SITE_HTML_ALLOWED_TAGS, SITE_HTML_IFRAME_HOSTS } from '../portable-text/html-block';
const URL_ATTRIBUTES = new Set(['href', 'src', 'cite']);
const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/i;
let purifier: ReturnType<typeof DOMPurify> | undefined;
export function cleanInlineHtml(html: string): string {
  if (!purifier) {
    purifier = DOMPurify(window);
    purifier.addHook('afterSanitizeAttributes', node => {
      const tag = node.nodeName.toLowerCase();
      const allowed = new Set([...(SITE_HTML_ALLOWED_ATTRIBUTES['*'] ?? []), ...(SITE_HTML_ALLOWED_ATTRIBUTES[tag] ?? [])]);
      for (const name of node.getAttributeNames()) {
        const scheme = URL_ATTRIBUTES.has(name) ? SCHEME_RE.exec(node.getAttribute(name)?.trim() ?? '')?.[1]?.toLowerCase() : undefined;
        const permitted = allowed.has(name) || (name.startsWith('data-') && allowed.has('data-*'));
        if (!permitted || (scheme && !SITE_HTML_ALLOWED_SCHEMES.includes(scheme))) node.removeAttribute(name);
      }
      if (tag !== 'iframe') return;
      const src = node.getAttribute('src') ?? '', base = 'https://invalid.invalid';
      if (!URL.canParse(src, base) || !SITE_HTML_IFRAME_HOSTS.includes(new URL(src, base).hostname)) node.removeAttribute('src');
    });
  }
  return purifier.sanitize(html, { ALLOWED_TAGS: [...SITE_HTML_ALLOWED_TAGS], ALLOWED_ATTR: Object.values(SITE_HTML_ALLOWED_ATTRIBUTES).flat().filter(name => name !== 'data-*'), ALLOW_DATA_ATTR: true, FORBID_CONTENTS: ['script', 'style', 'textarea', 'option'] });
}
