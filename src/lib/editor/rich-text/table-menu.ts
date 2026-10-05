// Native presentation/lifecycle transport of pinned TableControls.tsx.
// EmDash1.1.0 913cb1bb9b7f08c3ff0d258b4420e53835b6a58e, MIT.
import type { Editor } from '@tiptap/core';
import { CellSelection } from '@tiptap/pm/tables';
import type { TableActionId, getTableControlState } from './TableActions';
import type { Translate } from './types';
import { tableMessage } from './table-control-messages';
export { tableMessage } from './table-control-messages';

export type TableControlState = NonNullable<ReturnType<typeof getTableControlState>>;
export type TableMenuAction = readonly [TableActionId, string, string | null];
export const TABLE_ACTION_GROUPS: ReadonlyArray<readonly [string, readonly TableMenuAction[]]> = [
  ['Selection', [['select-row', 'Select row', null], ['select-column', 'Select column', null], ['select-table', 'Select table', null]]],
  ['Rows', [['add-row-before', 'Add row above', 'Row added above'], ['add-row-after', 'Add row below', 'Row added below'], ['delete-row', 'Delete row', null]]],
  ['Columns', [['add-column-before', 'Add column before', 'Column added before'], ['add-column-after', 'Add column after', 'Column added after'], ['delete-column', 'Delete column', null]]],
  ['Headers', [['header-row', 'Toggle header row', null], ['header-column', 'Toggle header column', null]]],
  ['Cells', [['merge', 'Merge selected cells', 'Cells merged'], ['split', 'Split merged cell', 'Cell split']]],
  ['Widths', [['decrease-width', 'Decrease column width', 'Column width decreased'], ['increase-width', 'Increase column width', 'Column width increased'], ['distribute-widths', 'Distribute columns evenly', 'Columns distributed evenly'], ['reset-widths', 'Reset column widths', 'Column widths reset']]],
  ['Document', [['paragraph-before', 'Insert paragraph before', 'Paragraph inserted before table'], ['paragraph-after', 'Insert paragraph after', 'Paragraph inserted after table']]],
  ['Table', [['delete-table', 'Delete table', 'Table deleted']]]
];
export function selectedTableLabel(editor: Editor, state: TableControlState, translate: Translate) {
  return translate(tableMessage(editor.state.selection instanceof CellSelection
    ? '{0, plural, one {# row} other {# rows}} × {1, plural, one {# column} other {# columns}} selected' : 'Current cell',
  { 0: state.rows, 1: state.columns }));
}
export function tableActionLabel([id, message]: TableMenuAction, state: TableControlState, translate: Translate) {
  return translate(tableMessage(id === 'delete-row' && state.rows > 1 ? 'Delete rows'
    : id === 'delete-column' && state.columns > 1 ? 'Delete columns' : message));
}
export function tableActionResult([id, , message]: TableMenuAction, state: TableControlState, changed: boolean, translate: Translate) {
  if (id.startsWith('select-')) return null;
  if (id === 'delete-row') return translate(tableMessage('{0, plural, one {Row deleted} other {# rows deleted}}', { 0: state.rows }));
  if (id === 'delete-column') return translate(tableMessage('{0, plural, one {Column deleted} other {# columns deleted}}', { 0: state.columns }));
  if (id === 'header-row') return translate(tableMessage(state.headerRow === true ? 'Header row removed' : 'Header row added'));
  if (id === 'header-column') return translate(tableMessage(state.headerColumn === true ? 'Header column removed' : 'Header column added'));
  if (id === 'paragraph-before' && !changed) return translate(tableMessage('Moved to paragraph before table'));
  if (id === 'paragraph-after' && !changed) return translate(tableMessage('Moved to paragraph after table'));
  return message === null ? null : translate(tableMessage(message));
}
