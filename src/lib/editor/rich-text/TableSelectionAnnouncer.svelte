<script lang="ts">
  // Native lifecycle transport of pinned TableSelectionAnnouncer subscriptions.
  import type { Editor } from '@tiptap/core';
  import type { Transaction } from '@tiptap/pm/state';
  import { CellSelection } from '@tiptap/pm/tables';
  import { getTableControlState } from './TableActions';
  import { sourceMessage, type Translate } from './types';
  import { tableMessage } from './table-menu';
  let { editor, onChange, translate = sourceMessage }: {
    editor: Editor; onChange: (label: string) => void; translate?: Translate;
  } = $props();
  $effect(() => {
    const current = editor;
    const announce = ({ transaction }: { transaction: { docChanged: boolean } }) => {
      const state = getTableControlState(current);
      if (!transaction.docChanged && current.state.selection instanceof CellSelection && state) {
        const message = '{0, plural, one {# row} other {# rows}} × {1, plural, one {# column} other {# columns}} selected';
        onChange(translate(tableMessage(message, { 0: state.rows, 1: state.columns })));
      }
    };
    const announceDeletion = ({ transaction }: { transaction: Transaction }) => {
      const rows: unknown = transaction.getMeta('emdashDeletedTableRows');
      const columns: unknown = transaction.getMeta('emdashDeletedTableColumns');
      if (typeof rows === 'number') {
        const message = '{rows, plural, one {Row deleted} other {# rows deleted}}';
        onChange(translate(tableMessage(message, { rows })));
      } else if (typeof columns === 'number') {
        const message = '{columns, plural, one {Column deleted} other {# columns deleted}}';
        onChange(translate(tableMessage(message, { columns })));
      }
    };
    current.on('selectionUpdate', announce);
    current.on('transaction', announceDeletion);
    return () => { current.off('selectionUpdate', announce); current.off('transaction', announceDeletion); };
  });
</script>
