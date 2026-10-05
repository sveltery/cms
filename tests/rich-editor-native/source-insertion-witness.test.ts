// Supplemental method witness, not execution credit for an original Source
// callback or the complete React renderer. The entire pinned declaration runs
// unchanged against the real Source-version ProseMirror/StarterKit host.
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { expect, it } from 'vitest';
import { tick } from 'svelte';
import { closeHistory } from '@tiptap/pm/history';
import { NodeSelection } from '@tiptap/pm/state';
import { renderInDraftForm, texts } from '../helpers/rich-editor/native-authoring-dom';

it('the whole pinned insertion declaration retains a real StarterKit trailing paragraph after an end HTML block', async () => {
  const source = readFileSync('parity/emdash/rich-editor-source/packages/admin/src/components/PortableTextEditor.tsx', 'utf8');
  const ast = ts.createSourceFile('PortableTextEditor.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = ast.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'insertTopLevelBlock')!;
  const emitted = ts.transpileModule(declaration.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText;
  const insert = new Function('closeHistory', 'NodeSelection', `${emitted}\nreturn insertTopLevelBlock;`)(closeHistory, NodeSelection);
  const { editor, cleanup } = await renderInDraftForm();
  try {
    editor.commands.insertContentAt(editor.state.doc.content.size, { type: 'paragraph' });
    const from = editor.state.doc.content.size - 1;
    editor.commands.setTextSelection(from); editor.commands.insertContent('/');
    insert(editor, editor.schema.nodes.htmlBlock.create({ isolated: true }), { from, to: from + 1 }); await tick();
    expect(texts(editor)).toEqual(['First', 'Last', 'htmlBlock', 'paragraph']);
  } finally { await cleanup(); }
});
