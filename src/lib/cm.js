/**
 * CodeMirror 6 setup for src/components/Editor.jsx. Loaded with a dynamic
 * import, so pages without an editor never download it.
 *
 * createEditor({ parent, doc, lang, onChange, onRun, label, describedBy, readOnly })
 *   -> { setDoc, setLang, setDiagnostics, focus, destroy }
 */
import { EditorState, Compartment, Prec } from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, highlightSpecialChars, rectangularSelection, crosshairCursor,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  indentOnInput, bracketMatching, syntaxHighlighting, HighlightStyle, indentUnit, foldGutter, foldKeymap,
} from '@codemirror/language';
import {
  autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap, completeFromList, snippetCompletion,
} from '@codemirror/autocomplete';
import { setDiagnostics as setLint, lintGutter, lintKeymap } from '@codemirror/lint';
import { highlightSelectionMatches } from '@codemirror/search';
import { java, javaLanguage } from '@codemirror/lang-java';
import { python, pythonLanguage } from '@codemirror/lang-python';
import { tags as t } from '@lezer/highlight';

// Colours come from CSS variables in src/index.css (V3-C block), so the editor follows the site theme.
const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword, t.definitionKeyword, t.modifier], color: 'var(--code-keyword)' },
  { tag: [t.string, t.special(t.string), t.character, t.regexp], color: 'var(--code-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--code-number)' },
  { tag: [t.lineComment, t.blockComment, t.docComment, t.comment], color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: [t.typeName, t.className, t.namespace, t.standard(t.variableName)], color: 'var(--code-type)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))], color: 'var(--code-fn)' },
  { tag: [t.annotation, t.meta, t.processingInstruction], color: 'var(--code-meta)' },
  { tag: [t.operator, t.punctuation, t.separator, t.bracket], color: 'var(--code-punct)' },
  { tag: t.invalid, color: 'var(--down)' },
]);

const theme = EditorView.theme(
  {
    '&': { color: 'var(--text)', backgroundColor: 'var(--code-bg)', fontSize: 'var(--code-size)' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'var(--mono)', lineHeight: '1.6' },
    '.cm-content': { caretColor: 'var(--gold)', padding: '10px 0' },
    '.cm-line': { padding: '0 14px 0 8px' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--gold)', borderLeftWidth: '2px' },
    '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
      { backgroundColor: 'var(--code-selection)' },
    '.cm-activeLine': { backgroundColor: 'var(--code-active)' },
    '.cm-gutters': { backgroundColor: 'var(--code-bg)', color: 'var(--mute)', border: 'none', borderRight: '1px solid var(--line)' },
    '.cm-activeLineGutter': { backgroundColor: 'var(--code-active)', color: 'var(--text)' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 14px', minWidth: '3ch' },
    '.cm-foldGutter .cm-gutterElement': { padding: '0 4px', color: 'var(--mute)' },
    '.cm-matchingBracket': { backgroundColor: 'transparent', outline: '1px solid var(--gold-d)', color: 'inherit' },
    '.cm-nonmatchingBracket': { outline: '1px solid var(--down)', backgroundColor: 'transparent' },
    '.cm-selectionMatch': { backgroundColor: 'var(--code-match)' },
    '.cm-tooltip': { backgroundColor: 'var(--panel2)', border: '1px solid var(--line2)', color: 'var(--text)', fontFamily: 'var(--mono)', fontSize: '13px' },
    '.cm-tooltip-autocomplete > ul > li': { padding: '3px 10px' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--gold)', color: '#000' },
    '.cm-completionDetail': { color: 'var(--mute)', fontStyle: 'normal', marginLeft: '1em' },
    '.cm-tooltip-lint': { padding: 0 },
    '.cm-diagnostic': { padding: '6px 10px', whiteSpace: 'pre-wrap', maxWidth: '60ch' },
    '.cm-diagnostic-error': { borderLeft: '3px solid var(--down)' },
    '.cm-diagnostic-warning': { borderLeft: '3px solid var(--gold)' },
    '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy var(--down)', textDecorationSkipInk: 'none', textUnderlineOffset: '3px' },
    '.cm-lintRange-warning': { backgroundImage: 'none', textDecoration: 'underline wavy var(--gold)', textUnderlineOffset: '3px' },
    '.cm-gutter-lint': { width: '1.1em' },
    '.cm-gutter-lint .cm-gutterElement': { padding: '0 0 0 2px' },
    '.cm-lint-marker': { width: '0.8em', height: '0.8em' },
    '.cm-panels': { backgroundColor: 'var(--panel2)', color: 'var(--text)' },
  },
  { dark: true },
);

const JAVA_WORDS = (
  'abstract assert boolean break byte case catch char class continue default do double else enum extends final ' +
  'finally float for if implements import instanceof int interface long new package private protected public record ' +
  'return short static super switch this throw throws try var void while true false null ' +
  'String System Scanner Math Integer Long Double Character Boolean StringBuilder ArrayList LinkedList HashMap TreeMap ' +
  'HashSet TreeSet ArrayDeque PriorityQueue Arrays Collections List Map Set Queue Deque Iterator Comparator ' +
  'BufferedReader InputStreamReader PrintWriter StringTokenizer IOException Exception BigInteger BigDecimal'
).split(' ').map((label) => ({ label, type: /^[A-Z]/.test(label) ? 'class' : 'keyword' }));

const JAVA_SNIPPETS = [
  snippetCompletion('System.out.println(${})', { label: 'sout', detail: 'print a line', type: 'function' }),
  snippetCompletion('System.out.println(${})', { label: 'System.out.println', type: 'function' }),
  snippetCompletion('Scanner ${sc} = new Scanner(System.in);', { label: 'scanner', detail: 'read input', type: 'text' }),
  snippetCompletion('for (int ${i} = 0; ${i} < ${n}; ${i}++) {\n\t${}\n}', { label: 'fori', detail: 'for loop', type: 'keyword' }),
  snippetCompletion('public static void main(String[] args) {\n\t${}\n}', { label: 'main', detail: 'main method', type: 'function' }),
];

/** Words already in the file, so names the student made up complete too. */
function bufferWords(context) {
  const word = context.matchBefore(/[A-Za-z_$][\w$]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  const seen = new Set();
  const text = context.state.doc.toString();
  for (const m of text.matchAll(/[A-Za-z_$][\w$]{2,}/g)) {
    if (m.index === word.from) continue;
    seen.add(m[0]);
    if (seen.size > 2000) break;
  }
  return { from: word.from, options: [...seen].map((label) => ({ label, type: 'variable', boost: -1 })), validFor: /^[\w$]*$/ };
}

const javaSupport = [
  java(),
  javaLanguage.data.of({ autocomplete: completeFromList([...JAVA_SNIPPETS, ...JAVA_WORDS]) }),
  javaLanguage.data.of({ autocomplete: bufferWords }),
];
const pythonSupport = [python(), pythonLanguage.data.of({ autocomplete: bufferWords })];
const languageFor = (lang) => (lang === 'python' ? pythonSupport : javaSupport);

/** { line, col?, message, severity } -> a CodeMirror lint diagnostic, clamped to the document. */
function toLint(doc, d) {
  if (!d?.line) return null;
  const line = doc.line(Math.min(Math.max(1, d.line), doc.lines));
  let from;
  let to;
  const end = line.from + line.text.trimEnd().length;
  if (d.col && line.from + d.col - 1 < end) {
    from = line.from + d.col - 1;
    const word = /^[\w$]+/.exec(line.text.slice(d.col - 1));
    to = from + (word ? word[0].length : 1);
  } else if (d.col) {
    // Past the end of the code, e.g. "';' expected": mark the last token so the squiggle is visible.
    to = end;
    from = line.from + line.text.slice(0, end - line.from).search(/\S+$/);
    if (from < line.from) from = line.from;
  } else {
    from = line.from + (/^\s*/.exec(line.text)[0].length);
    to = line.to;
  }
  return { from, to: Math.max(to, from), severity: d.severity === 'warning' ? 'warning' : 'error', message: d.message };
}

export function createEditor({ parent, doc = '', lang = 'java', onChange, onRun, label = 'Code', describedBy, readOnly = false }) {
  const language = new Compartment();
  const editable = new Compartment();
  let quiet = false; // true while we set the text ourselves

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        foldGutter({ markerDOM: (open) => Object.assign(document.createElement('span'), { textContent: open ? '▾' : '▸' }) }),
        lintGutter(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
        bracketMatching(),
        closeBrackets(),
        autocompletion({ icons: false }),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        syntaxHighlighting(highlight),
        theme,
        EditorView.lineWrapping,
        language.of(languageFor(lang)),
        editable.of([EditorView.editable.of(!readOnly), EditorState.readOnly.of(readOnly)]),
        EditorView.contentAttributes.of({ 'aria-label': label, ...(describedBy ? { 'aria-describedby': describedBy } : {}) }),
        Prec.highest(keymap.of([{ key: 'Mod-Enter', run: () => (onRun?.(), true) }])),
        // Tab indents; Esc then Tab moves focus on (CodeMirror's built-in tab focus mode).
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap, ...foldKeymap, ...completionKeymap, ...lintKeymap, indentWithTab]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged && !quiet) onChange?.(u.state.doc.toString());
        }),
      ],
    }),
  });

  return {
    view,
    setDoc(text) {
      if (text === view.state.doc.toString()) return;
      quiet = true;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
      quiet = false;
    },
    setLang(l) {
      view.dispatch({ effects: language.reconfigure(languageFor(l)) });
    },
    setDiagnostics(list) {
      const doc = view.state.doc;
      view.dispatch(setLint(view.state, (list || []).map((d) => toLint(doc, d)).filter(Boolean)));
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  };
}
