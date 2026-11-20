/**
 * The small markdown subset lessons use: paragraphs, **bold**, *italic*,
 * `code`, "- " and "1. " lists, "### " headings, ``` fenced code (Java gets
 * highlighted) and simple | tables |. Never renders HTML from the text.
 */
import { Fragment } from 'react';

const KEYWORDS = new Set(
  'abstract boolean break byte case catch char class continue default do double else extends final finally float for if implements import instanceof int interface long new null package private protected public return short static super switch this throw throws true false try void while var'.split(' ')
);
const TOKEN = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])'|\b\d+(?:\.\d+)?[dDfFL]?\b|\b[A-Za-z_$][\w$]*\b)/g;

/** Java (or Java-like) source -> highlighted spans. */
export function Code({ code }) {
  const out = [];
  let last = 0;
  let i = 0;
  for (const m of code.matchAll(TOKEN)) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const t = m[0];
    let cls = null;
    if (t.startsWith('//') || t.startsWith('/*')) cls = 'c';
    else if (t[0] === '"' || t[0] === "'") cls = 's';
    else if (/^\d/.test(t)) cls = 'n';
    else if (KEYWORDS.has(t)) cls = 'k';
    else if (/^[A-Z]/.test(t)) cls = 't';
    out.push(cls ? <span key={i++} className={`lr-tk-${cls}`}>{t}</span> : t);
    last = m.index + t.length;
  }
  if (last < code.length) out.push(code.slice(last));
  return out;
}

export function CodeBlock({ code, label }) {
  return (
    <pre className="lr-code" tabIndex={0} aria-label={label}>
      <code>
        <Code code={code.replace(/\n$/, '')} />
      </code>
    </pre>
  );
}

function Inline({ text }) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((p, i) => {
    if (p.length > 2 && p.startsWith('`') && p.endsWith('`')) return <code key={i} className="lr-ic">{p.slice(1, -1)}</code>;
    if (p.length > 4 && p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.length > 2 && p.startsWith('*') && p.endsWith('*')) return <em key={i}>{p.slice(1, -1)}</em>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

function parse(text) {
  const blocks = [];
  let para = [];
  let list = null;
  let code = null;
  let table = null;
  const flush = () => {
    if (para.length) blocks.push({ k: 'p', t: para.join(' ') });
    if (list) blocks.push(list);
    if (table) blocks.push(table);
    para = [];
    list = null;
    table = null;
  };
  for (const raw of String(text || '').split('\n')) {
    if (code) {
      if (raw.trim().startsWith('```')) {
        blocks.push(code);
        code = null;
      } else code.lines.push(raw);
      continue;
    }
    const line = raw.trim();
    if (line.startsWith('```')) {
      flush();
      code = { k: 'code', lang: line.slice(3).trim(), lines: [] };
    } else if (!line) flush();
    else if (line.startsWith('### ') || line.startsWith('## ')) {
      flush();
      blocks.push({ k: 'h', t: line.replace(/^#+\s/, '') });
    } else if (/^\|.*\|$/.test(line)) {
      if (para.length || list) flush();
      const cells = line.slice(1, -1).split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
      (table ??= { k: 'table', rows: [] }).rows.push(cells);
    } else if (/^- /.test(line) || /^\d+\. /.test(line)) {
      const ordered = /^\d/.test(line);
      if (para.length || table || (list && list.ordered !== ordered)) flush();
      (list ??= { k: 'list', ordered, items: [] }).items.push(line.replace(/^(- |\d+\. )/, ''));
    } else if (list && /^\s{2,}/.test(raw)) {
      list.items[list.items.length - 1] += ` ${line}`;
    } else {
      if (list || table) flush();
      para.push(line);
    }
  }
  if (code) blocks.push(code);
  flush();
  return blocks;
}

export default function Markdown({ text, className = 'lr-md' }) {
  return (
    <div className={className}>
      {parse(text).map((b, i) => {
        if (b.k === 'p') return <p key={i}><Inline text={b.t} /></p>;
        if (b.k === 'h') return <h3 key={i}><Inline text={b.t} /></h3>;
        if (b.k === 'code') return <CodeBlock key={i} code={b.lines.join('\n')} />;
        if (b.k === 'table')
          return (
            <div key={i} className="lr-table-wrap">
              <table className="lr-table">
                <thead>
                  <tr>{b.rows[0].map((c, j) => <th key={j} scope="col"><Inline text={c} /></th>)}</tr>
                </thead>
                <tbody>
                  {b.rows.slice(1).map((r, j) => (
                    <tr key={j}>{r.map((c, n) => <td key={n}><Inline text={c} /></td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        const L = b.ordered ? 'ol' : 'ul';
        return <L key={i}>{b.items.map((t, j) => <li key={j}><Inline text={t} /></li>)}</L>;
      })}
    </div>
  );
}
