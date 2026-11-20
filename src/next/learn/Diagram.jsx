/**
 * Memory and data diagrams for explain steps (see shared/next/learn/schema.js):
 * vars (boxes), refs (variables pointing at objects), array, grid, trace.
 */
import { useLayoutEffect, useRef, useState } from 'react';

const show = (v) => (v === null || v === undefined ? 'null' : String(v));

function Vars({ vars }) {
  return (
    <div className="lr-vars">
      {vars.map((v, i) => (
        <div key={i} className="lr-var">
          <span className="lr-var__name">
            {v.type && <span className="lr-var__type">{v.type} </span>}
            {v.name}
          </span>
          <span className="lr-box">{show(v.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Variables on the left, objects on the right, arrows measured from the DOM. */
function Refs({ vars, objects }) {
  const wrap = useRef(null);
  const [lines, setLines] = useState([]);
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => {
      const base = el.getBoundingClientRect();
      const out = [];
      vars.forEach((v, i) => {
        if (v.to == null) return;
        const from = el.querySelector(`[data-dot="${i}"]`)?.getBoundingClientRect();
        const to = el.querySelector(`[data-obj="${CSS.escape(String(v.to))}"]`)?.getBoundingClientRect();
        if (!from || !to) return;
        out.push({
          x1: from.left + from.width / 2 - base.left,
          y1: from.top + from.height / 2 - base.top,
          x2: to.left - base.left - 2,
          y2: Math.min(Math.max(from.top + from.height / 2, to.top + 14), to.bottom - 14) - base.top,
        });
      });
      setLines(out);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [vars, objects]);

  return (
    <div className="lr-refs" ref={wrap}>
      <div className="lr-refs__vars">
        {vars.map((v, i) => (
          <div key={i} className="lr-var">
            <span className="lr-var__name">
              {v.type && <span className="lr-var__type">{v.type} </span>}
              {v.name}
            </span>
            <span className="lr-box">{v.to != null ? <span className="lr-dot" data-dot={i} aria-label={`refers to object ${v.to}`} /> : show(v.value)}</span>
          </div>
        ))}
      </div>
      <div className="lr-refs__objs">
        {objects.map((o) => (
          <div key={o.id} className="lr-obj" data-obj={o.id}>
            <div className="lr-obj__type">{o.type}</div>
            {(o.fields || []).map((f, j) => (
              <div key={j} className="lr-obj__f">
                <span>{f.name}</span>
                <span className="lr-box lr-box--sm">{show(f.value)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <svg className="lr-refs__svg" aria-hidden="true">
        <defs>
          <marker id="lr-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill="currentColor" />
          </marker>
        </defs>
        {lines.map((l, i) => (
          <path key={i} d={`M${l.x1} ${l.y1} C${(l.x1 + l.x2) / 2} ${l.y1}, ${(l.x1 + l.x2) / 2} ${l.y2}, ${l.x2} ${l.y2}`} markerEnd="url(#lr-arrow)" />
        ))}
      </svg>
    </div>
  );
}

function ArrayD({ name, values, highlight = [] }) {
  return (
    <div className="lr-arr-wrap">
      {name && <div className="lr-var__name">{name}</div>}
      <div className="lr-arr" role="table" aria-label={name || 'array'}>
        <div role="row" className="lr-arr__row">
          {values.map((v, i) => (
            <span role="cell" key={i} className={`lr-arr__cell${highlight.includes(i) ? ' is-hl' : ''}`}>{show(v)}</span>
          ))}
        </div>
        <div role="row" className="lr-arr__row lr-arr__idx">
          {values.map((_, i) => <span role="cell" key={i}>{i}</span>)}
        </div>
      </div>
    </div>
  );
}

function Grid({ name, rows, highlight = [] }) {
  const hl = new Set(highlight.map(([r, c]) => `${r},${c}`));
  const cols = Math.max(...rows.map((r) => r.length));
  return (
    <div className="lr-table-wrap">
      {name && <div className="lr-var__name">{name}</div>}
      <table className="lr-grid">
        <thead>
          <tr>
            <th aria-hidden="true" />
            {Array.from({ length: cols }, (_, c) => <th key={c} scope="col">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <th scope="row">{i}</th>
              {r.map((v, j) => <td key={j} className={hl.has(`${i},${j}`) ? 'is-hl' : undefined}>{show(v)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Trace({ columns, rows }) {
  return (
    <div className="lr-table-wrap">
      <table className="lr-table lr-trace">
        <thead>
          <tr>{columns.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{show(v)}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

export default function Diagram({ d }) {
  const body =
    d.type === 'vars' ? <Vars vars={d.vars} />
    : d.type === 'refs' ? <Refs vars={d.vars} objects={d.objects} />
    : d.type === 'array' ? <ArrayD name={d.name} values={d.values} highlight={d.highlight} />
    : d.type === 'grid' ? <Grid name={d.name} rows={d.rows} highlight={d.highlight} />
    : d.type === 'trace' ? <Trace columns={d.columns} rows={d.rows} />
    : null;
  return (
    <figure className="lr-diagram">
      {body}
      {d.caption && <figcaption>{d.caption}</figcaption>}
    </figure>
  );
}
