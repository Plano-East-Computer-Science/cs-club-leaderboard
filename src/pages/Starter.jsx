import { Link, useParams } from 'react-router-dom';
import { Pane, PageHead } from '../components/Pane.jsx';
import { useReveal } from '../lib/ui.js';
import { starterBySlug } from '../lib/starters.js';

/** One starter as a short README: steps, a first file, and where to get the code. */
export default function Starter() {
  const { slug } = useParams();
  const s = starterBySlug(slug);
  useReveal();
  if (!s) {
    return (
      <div className="state-note">
        <p>No such starter.</p>
        <Link className="g uline" to="/build">back to build</Link>
      </div>
    );
  }
  const links = [...(s.repo ? [s.repo] : []), ...(s.links ?? [])];
  return (
    <>
      <PageHead eyebrow={`build --start ${s.slug}`} title={<>Start a <em>{s.name.toLowerCase()}</em>.</>} lead={`${s.blurb} Takes ${s.time}.`} one />
      <section className="sec">
        <div className="wrap st-grid">
          <Pane file="README.md" meta={s.time}>
            <div className="pn-b">
              <ol className="st-steps">
                {s.steps.map((t) => <li key={t}>{t}</li>)}
              </ol>
              <p className="d">
                This is the first step of a ship cycle. When you have something running, <Link className="u" to="/build">enter the current cycle</Link> and post a devlog.
              </p>
            </div>
          </Pane>
          <div style={{ display: 'grid', gap: 16, alignContent: 'start', minWidth: 0 }}>
            {links.length > 0 && (
              <Pane file="get-it" meta="opens in a new tab">
                <div className="pn-b">
                  {links.map((l) => (
                    <p key={l.url}><a className="u" href={l.url} target="_blank" rel="noreferrer noopener">{l.label}</a></p>
                  ))}
                  <p className="d" style={{ fontSize: 12.5 }}>If GitHub is blocked on school wifi, use the <Link className="u" to="/gateway">gateway</Link> during meetings.</p>
                </div>
              </Pane>
            )}
            {s.file && (
              <Pane file={s.file.name} meta="the club's starter">
                <pre className="st-code"><code>{s.file.code}</code></pre>
              </Pane>
            )}
            {!s.file && links.length === 0 && (
              <Pane file="notes" meta="">
                <div className="pn-b"><p className="d">Follow the steps. There is no starter code for this one.</p></div>
              </Pane>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
