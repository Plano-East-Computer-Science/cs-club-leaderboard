/**
 * /club/playbook: how to run the club. Chapters from shared/next/club/playbook.js
 * with a contents list that follows the reader, and the meeting kits at the end.
 */
import { Link } from 'react-router-dom';
import { CHAPTERS } from '../../../shared/next/club/playbook.js';
import { FORMATS } from '../../../shared/next/club/formats.js';
import Prose from './Prose.jsx';
import './club.css';

export default function Playbook() {
  return (
    <div className="ui-page cl-page cl-pb">
      <header className="cl-pb__h">
        <h1 className="ui-display-l">The playbook</h1>
        <p className="cl-kit__line">How to run a CS club people want to come back to. Written for officers, open to everyone.</p>
      </header>
      <div className="cl-pb__grid">
        <nav className="cl-toc" aria-label="Chapters">
          <ol>
            {CHAPTERS.map((c) => (
              <li key={c.id}>
                <a href={`#${c.id}`}>{c.title}</a>
              </li>
            ))}
            <li>
              <a href="#kits">Meeting kits</a>
            </li>
          </ol>
        </nav>
        <div className="cl-pb__body">
          {CHAPTERS.map((c) => (
            <section key={c.id} id={c.id} className="cl-chap" aria-labelledby={`h-${c.id}`}>
              <h2 className="cl-chap__t" id={`h-${c.id}`}>{c.title}</h2>
              <p className="cl-chap__l">{c.line}</p>
              <Prose text={c.body} />
            </section>
          ))}
          <section id="kits" className="cl-chap" aria-labelledby="h-kits">
            <h2 className="cl-chap__t" id="h-kits">Meeting kits</h2>
            <p className="cl-chap__l">Ten formats, each with timing, script, prep dates and the announcement.</p>
            <ul className="cl-kinds">
              {FORMATS.map((f) => (
                <li key={f.id}>
                  <Link to={`/club/kits/${f.id}`} className="cl-kind">
                    <span className="cl-kind__n">{f.name}</span>
                    <span className="cl-kind__l">{f.bestFor}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
