import { Node, mergeAttributes } from '@tiptap/core';

// Schema attributes follow the pinned Source nodes. Stored media remain real
// values; media/provider authoring is wired only to actual published pickers.
export const ImageExtension = Node.create({
  name: 'image', group: 'block', atom: true, draggable: true,
  addAttributes() {
    return Object.fromEntries(['src', 'alt', 'title', 'caption', 'mediaId', 'provider', 'width', 'height', 'blurhash', 'dominantColor', 'displayWidth', 'displayHeight', 'alignment', 'link'].map(name => [name, { default: null }]));
  },
  parseHTML() { return [{ tag: 'img[src]' }]; },
  renderHTML({ HTMLAttributes }) { return ['img', HTMLAttributes]; }
});

export const GalleryExtension = Node.create({
  name: 'gallery', group: 'block', atom: true, draggable: true,
  addAttributes() { return { images: { default: [] }, columns: { default: null } }; },
  parseHTML() { return [{ tag: 'div[data-type="gallery"]' }]; },
  renderHTML() { return ['div', { 'data-type': 'gallery' }]; },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div'); dom.dataset.type = 'gallery';
      function render(current: typeof node) {
        dom.replaceChildren();
        const columns = typeof current.attrs.columns === 'number' ? current.attrs.columns : 3;
        dom.style.display = 'grid'; dom.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
        for (const item of current.attrs.images ?? []) {
          const image = document.createElement('img'); image.alt = typeof item.alt === 'string' ? item.alt : '';
          if (typeof item.asset?.url === 'string') image.src = item.asset.url;
          image.style.maxWidth = '100%'; dom.append(image);
        }
      }
      render(node);
      return { dom, update(next) { if (next.type !== node.type) return false; render(next); return true; } };
    };
  }
});

export const PluginBlockExtension = Node.create({
  name: 'pluginBlock', group: 'block', atom: true, draggable: true, selectable: true,
  addAttributes() {
    return { blockType: { default: null }, id: { default: null }, data: { default: {},
      parseHTML: element => JSON.parse(element.getAttribute('data-plugin-data') || '{}'),
      renderHTML: attrs => ({ 'data-plugin-data': JSON.stringify(attrs.data) }) } };
  },
  addStorage() { return { registry: new Map(), onEditBlock: null }; },
  parseHTML() { return [{ tag: 'div[data-plugin-block]' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-plugin-block': '' })]; },
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div'); dom.className = 'plugin-block'; dom.dataset.pluginBlock = ''; dom.contentEditable = 'false';
      function render(current: typeof node) { dom.textContent = `Block: ${current.attrs.blockType ?? ''}`; }
      render(node);
      return { dom, update(next) { if (next.type !== node.type) return false; render(next); return true; } };
    };
  },
  addKeyboardShortcuts() {
    const remove = () => { const { selection } = this.editor.state; const node = this.editor.state.doc.nodeAt(selection.from);
      if (node?.type.name === 'pluginBlock') { this.editor.commands.deleteSelection(); return true; } return false; };
    return { Backspace: remove, Delete: remove };
  }
});
