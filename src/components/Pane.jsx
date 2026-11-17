import { slug, paras, bullets } from '../lib/md.js';

/** A titled terminal pane: `<b>file</b> ... meta` header over a body. */
export function Pane({ file, meta, cls = '', delay, children, spot = true }) {
  return (
    <section className={`pn ${spot ? 'sp' : ''} rv ${cls}`} style={delay ? { '--d': delay } : undefined}>
      <div className="pane-h">
        <span><b>{file}</b></span>
        <span className="hide-xs">{meta}</span>
      </div>
      {children}
    </section>
  );
}

export function Paras({ section }) {
  return (
    <div className="pn-b">
      {paras(section).map((p, i) => <p key={i}>{p}</p>)}
      {bullets(section).length > 0 && (
        <ul className="ul" style={{ marginTop: 6 }}>
          {bullets(section).map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      )}
    </div>
  );
}

/** Page header band: `$ eyebrow`, big title, optional lead and stat boxes. */
export function PageHead({ eyebrow, title, lead, kv, one }) {
  return (
    <section className="phd">
      <div className="wrap">
        <div className="phd-in" style={one ? { gridTemplateColumns: '1fr' } : undefined}>
          <div>
            <p className="eb"><span className="g">$</span>{eyebrow}</p>
            <h1>{title}<span className="cursor" aria-hidden="true" /></h1>
            {lead && <p className="lead">{lead}</p>}
          </div>
          {kv}
        </div>
      </div>
    </section>
  );
}

export { slug };
