import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';
import DialogError from '../../src/lib/calendar/CalendarDialogError.svelte';
import ScheduleDialog from '../../src/lib/calendar/CalendarScheduleDialog.svelte';

// Supplemental native rendered-value controls, directed by the whole MIT Source
// DialogError.tsx at EmDash pin 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e.
// These are new tests, not copied Source callbacks. No DOM, browser, CSS geometry,
// HTTP, authentication, storage, localization-owner or whole Source family credit.
type Node = DefaultTreeAdapterTypes.Node;
type Element = DefaultTreeAdapterTypes.Element;
const elements = (node: Node): Element[] => 'childNodes' in node
  ? node.childNodes.filter((child): child is Element => 'tagName' in child) : [];
function text(node: Node): string {
  if (node.nodeName === '#text') return (node as DefaultTreeAdapterTypes.TextNode).value;
  return 'childNodes' in node ? node.childNodes.map(text).join('') : '';
}
async function output(message?: string | null) {
  return parseFragment((await render(DialogError, { props: { message } })).body);
}

describe('actual Calendar dialog error SSR rendering', () => {
  it.each([undefined, null, ''])('suppresses the falsy message %s', async message => {
    expect(elements(await output(message))).toHaveLength(0);
  });

  it('keeps whitespace-only messages visible', async () => {
    const alert = elements(await output(' '));
    expect(alert).toHaveLength(1);
    expect(alert[0].attrs).toContainEqual({ name: 'role', value: 'alert' });
    expect(text(alert[0])).toBe(' ');
  });

  it('escapes markup and entities as message text', async () => {
    const message = '<img src=x onerror="oops()"> & <script>bad()</script>';
    const alert = elements(await output(message));
    expect(text(alert[0])).toBe(message);
    const tags = (node: Node): string[] => elements(node).flatMap(child => [child.tagName, ...tags(child)]);
    expect(tags(alert[0])).not.toContain('img');
    expect(tags(alert[0])).not.toContain('script');
  });

  it.each([
    ['single line', 'Conflict', ['Conflict']],
    ['two lines', 'First\nSecond', ['First', 'Second']],
    ['empty middle line', 'First\n\nThird', ['First', '', 'Third']],
    ['leading and trailing empty lines', '\nMiddle\n', ['', 'Middle', '']],
    ['only a newline', '\n', ['', '']],
    ['carriage return without newline', 'Left\rRight', ['Left\nRight']],
    ['already rendered translated text', 'Échec\nتعذّر الحفظ', ['Échec', 'تعذّر الحفظ']],
  ])('renders %s as separate child divs', async (_label, message, lines) => {
    const [alert] = elements(await output(message));
    // parse5 applies HTML's CR-to-LF normalization. The CR case still requires
    // exactly one child: Source splits literal LF, not arbitrary line endings.
    expect({ tag: alert.tagName, role: alert.attrs.find(attr => attr.name === 'role')?.value,
      lines: elements(alert).map(line => ({ tag: line.tagName, text: text(line) })) })
      .toEqual({ tag: 'div', role: 'alert', lines: lines.map(value => ({ tag: 'div', text: value })) });
  });

  it('renders the actual production Schedule dialog without an error initially', async () => {
    const html = (await render(ScheduleDialog, { props: {
      open: false, entryKey: 'posts:entry:en', onOpenChange: () => {}, onSchedule: () => {},
    } })).body;
    const root = parseFragment(html);
    const descendants = (node: Node): Element[] => elements(node).flatMap(child => [child, ...descendants(child)]);
    const nodes = descendants(root);
    expect(nodes.filter(node => node.tagName === 'dialog')).toHaveLength(1);
    expect(nodes.filter(node => node.tagName === 'form')).toHaveLength(1);
    expect(nodes.filter(node => node.attrs.some(attr => attr.name === 'role' && attr.value === 'alert'))).toHaveLength(0);
  });
});
