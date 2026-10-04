import { groupBlockquoteRuns } from './portable-text-blockquote-group.ts';
import { buildPortableTextListTree, clonePortableTextValue } from './portable-text-lists.ts';
import { textAlignClassName } from './portable-text-text-align.ts';
import { sanitizeHref } from './url.ts';

type Node = Record<string, unknown>;
function object(value: unknown): Node | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Node : undefined;
}
function text(value: unknown): string { return typeof value === 'string' ? value : ''; }
export function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

/** Static public HTML: Source grouping/list/alignment and Link mark semantics. */
export function renderPortableText(value: unknown): string {
  const blocks = clonePortableTextValue(Array.isArray(value) ? value : value ? [value] : []);
  const grouped = groupBlockquoteRuns(blocks).filter(node => object(node)) as Node[];
  const tree = buildPortableTextListTree(grouped, 'html');
  return tree.map(node => render(node)).join('');
}

function spans(children: unknown, markDefs: unknown): string {
  const definitions = Array.isArray(markDefs) ? markDefs.map(object).filter((value): value is Node => !!value) : [];
  if (!Array.isArray(children)) return '';
  return children.map(value => {
    const span = object(value);
    if (!span) return '';
    if (span._type === '@list') return render(span);
    if (span._type !== 'span') return '';
    let html = escapeHtml(text(span.text)).replaceAll('\n', '<br>');
    for (const mark of Array.isArray(span.marks) ? span.marks : []) {
      const definition = definitions.find(candidate => candidate._key === mark);
      if (definition?._type === 'link') {
        const href = sanitizeHref(text(definition.href));
        const blank = !href.startsWith('#') && Boolean(definition.blank);
        html = `<a href="${escapeHtml(href)}"${blank ? ' target="_blank" rel="noopener noreferrer"' : ''}>${html}</a>`;
      } else {
        const tags: Record<string, string> = { strong: 'strong', em: 'em', code: 'code', underline: 'u', 'strike-through': 's', strikethrough: 's' };
        const key = String(mark);
        const tag = Object.hasOwn(tags, key) ? tags[key] : undefined;
        if (tag) html = `<${tag}>${html}</${tag}>`;
      }
    }
    return html;
  }).join('');
}

function render(node: Node, quoteChild = false): string {
  if (node._type === '@list') {
    const tag = node.listItem === 'number' ? 'ol' : 'ul';
    const start = tag === 'ol' && typeof node.start === 'number' && node.start !== 1 ? ` start="${node.start}"` : '';
    const children = Array.isArray(node.children) ? node.children.map(object).filter((value): value is Node => !!value) : [];
    return `<${tag}${start}>${children.map(child => child._type === '@list' ? render(child) : `<li>${spans(child.children, child.markDefs)}</li>`).join('')}</${tag}>`;
  }
  if (node._type === 'blockquoteGroup') {
    return `<blockquote>${(Array.isArray(node.blocks) ? node.blocks : []).map(object).filter((value): value is Node => !!value).map(block => render(block, true)).join('')}</blockquote>`;
  }
  if (node._type === 'block') {
    const style = text(node.style);
    const tag = /^h[1-6]$/.test(style) ? style : style === 'blockquote' && !quoteChild ? 'blockquote' : 'p';
    const alignment = textAlignClassName(typeof node.textAlign === 'string' ? node.textAlign : undefined);
    return `<${tag}${alignment ? ` class="${alignment}"` : ''}>${spans(node.children, node.markDefs)}</${tag}>`;
  }
  if (node._type === 'code') return `<pre><code>${escapeHtml(text(node.code))}</code></pre>`;
  // Other built-in and plugin block types require their owning media/embed renderers.
  return '';
}
