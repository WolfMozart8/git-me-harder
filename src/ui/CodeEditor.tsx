import { javascript } from '@codemirror/lang-javascript';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Annotation, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, GutterMarker, gutter } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { useEffect, useRef } from 'react';
import { tags as t } from '@lezer/highlight';
import { findConflicts, lineMarks, type LineMark } from '../engine';

/** The committed (HEAD) version of the file, to diff against. `undefined` = new file. */
const setBase = StateEffect.define<string | undefined>();
const external = Annotation.define<boolean>();

interface DiffInfo {
  base: string | undefined;
  marks: Record<number, LineMark>;
  deletedAfter: number[];
  /** line number → role inside a conflict block */
  conflict: Record<number, 'marker' | 'ours' | 'theirs'>;
}

function compute(base: string | undefined, text: string): DiffInfo {
  const conflict: DiffInfo['conflict'] = {};
  for (const b of findConflicts(text)) {
    for (let n = b.start; n <= b.end; n++) conflict[n] = n === b.start || n === b.mid || n === b.end ? 'marker' : n < b.mid ? 'ours' : 'theirs';
  }
  return { base, ...lineMarks(base, text), conflict };
}

const diffField = StateField.define<DiffInfo>({
  create: (state) => compute(undefined, state.doc.toString()),
  update(value, tr) {
    let base = value.base;
    let changed = tr.docChanged;
    for (const e of tr.effects) {
      if (e.is(setBase)) {
        base = e.value;
        changed = true;
      }
    }
    return changed ? compute(base, tr.state.doc.toString()) : value;
  },
});

class Mark extends GutterMarker {
  constructor(readonly kind: string) {
    super();
  }
  eq(other: Mark) {
    return other.kind === this.kind;
  }
  toDOM() {
    const el = document.createElement('div');
    el.className = `cm-diff-mark cm-diff-${this.kind}`;
    return el;
  }
}

const MARKERS: Record<string, Mark> = {
  added: new Mark('added'),
  modified: new Mark('modified'),
  deleted: new Mark('deleted'),
  'modified-deleted': new Mark('modified deleted'),
  'added-deleted': new Mark('added deleted'),
};

const diffGutter = gutter({
  class: 'cm-diff-gutter',
  lineMarker(view, line) {
    const info = view.state.field(diffField);
    const n = view.state.doc.lineAt(line.from).number;
    const mark = info.marks[n];
    // lines removed right after this one (or at the very top of the file)
    const deleted = info.deletedAfter.includes(n) || (n === 1 && info.deletedAfter.includes(0));
    if (mark && deleted) return MARKERS[`${mark}-deleted`];
    return mark ? MARKERS[mark] : deleted ? MARKERS.deleted : null;
  },
  lineMarkerChange: (update) => update.startState.field(diffField) !== update.state.field(diffField),
});

const lineClasses = EditorView.decorations.compute([diffField], (state) => {
  const info = state.field(diffField);
  const builder = new RangeSetBuilder<Decoration>();
  for (let n = 1; n <= state.doc.lines; n++) {
    const cls = info.conflict[n] ? `cm-conflict-${info.conflict[n]}` : info.marks[n] ? `cm-line-${info.marks[n]}` : null;
    if (cls) builder.add(state.doc.line(n).from, state.doc.line(n).from, Decoration.line({ class: cls }));
  }
  return builder.finish();
});

const theme = EditorView.theme(
  {
    '&': { height: '100%', fontSize: '13px', backgroundColor: 'transparent', color: 'var(--text)' },
    '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.55' },
    '.cm-content': { caretColor: 'var(--accent)' },
    '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--muted)', border: 'none' },
    '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'rgba(255,255,255,0.04)' },
    '&.cm-focused': { outline: 'none' },
    '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(120,170,255,0.28) !important' },
  },
  { dark: true },
);

const highlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword], color: '#e58fd8' },
    { tag: [t.string, t.special(t.string)], color: '#f2b84b' },
    { tag: [t.number, t.bool, t.null], color: '#ff9e6b' },
    { tag: [t.comment], color: '#6b7a96', fontStyle: 'italic' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#6cb6ff' },
    { tag: [t.definition(t.variableName)], color: '#7fe0d0' },
    { tag: [t.propertyName], color: '#a9c4f5' },
    { tag: [t.operator, t.punctuation], color: '#9aa7b8' },
    { tag: [t.heading], color: '#8ddb6a', fontWeight: 'bold' },
  ]),
);

interface Props {
  path: string;
  value: string;
  base: string | undefined;
  onChange: (value: string) => void;
}

export function CodeEditor({ path, value, base, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // one editor per file
  useEffect(() => {
    const v = new EditorView({
      doc: value,
      parent: host.current!,
      extensions: [
        basicSetup,
        ...(path.endsWith('.js') ? [javascript()] : []),
        diffField,
        diffGutter,
        lineClasses,
        theme,
        highlight,
        EditorView.updateListener.of((u) => {
          if (u.docChanged && !u.transactions.some((tr) => tr.annotation(external))) onChangeRef.current(u.state.doc.toString());
        }),
      ],
    });
    v.dispatch({ effects: setBase.of(base) });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // git commands (checkout, merge, restore…) rewrite files behind the editor's back
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value }, annotations: external.of(true) });
    }
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: setBase.of(base) });
  }, [base]);

  return <div className="code-editor" ref={host} />;
}
