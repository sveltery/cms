<script lang="ts">
  import { onMount } from 'svelte';
  import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
  import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
  import { bracketMatching, indentOnInput, syntaxHighlighting } from '@codemirror/language';
  import { Compartment, Prec } from '@codemirror/state';
  import { EditorView, drawSelection, keymap, lineNumbers, placeholder } from '@codemirror/view';
  import { LANGUAGES, highlightStyle, theme, editability, type CodeEditorProps } from './code-editor-config.source';
  let { language, value, onChange, onFocusChange, onEscape, editable, autoFocus, ariaLabel,
    placeholder: placeholderText, describedBy }: CodeEditorProps = $props();
  const hintId = $props.id();
  let host: HTMLDivElement;
  let view = $state.raw<EditorView | null>(null);
  const editableCompartment = new Compartment();
  onMount(() => {
    const current = new EditorView({
      parent: host,
      doc: value,
      extensions: [
        lineNumbers(), history(), drawSelection(), indentOnInput(), bracketMatching(), closeBrackets(),
        EditorView.lineWrapping, placeholder(placeholderText), LANGUAGES[language](),
        syntaxHighlighting(highlightStyle), theme,
        Prec.high(keymap.of([{ key: 'Escape', run: () => { onEscape(); return true; } }])),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
        editableCompartment.of(editability(editable)),
        EditorView.contentAttributes.of({ 'aria-label': ariaLabel, 'aria-describedby': describedBy ? `${hintId} ${describedBy}` : hintId }),
        EditorView.updateListener.of(update => { if (update.docChanged) onChange(update.state.doc.toString()); }),
        EditorView.domEventHandlers({ focus: () => onFocusChange(true), blur: () => onFocusChange(false) })
      ]
    });
    view = current;
    return () => { view = null; current.destroy(); };
  });
  $effect(() => { view?.dispatch({ effects: editableCompartment.reconfigure(editability(editable)) }); });
  $effect(() => { if (autoFocus) view?.focus(); });
</script>

<div class="emdash-code-editor" dir="ltr">
  <div bind:this={host}></div>
  <span id={hintId} class="sr-only">Press Escape to leave the code editor.</span>
</div>
