/**
 * The Cybersecurity Committee. A recruiting page: 8 of 23 people who filled in
 * the interest form said a firm yes to cyber. The listings on the side are the
 * existing opportunity board filtered, not a second copy.
 */
import { Link } from 'react-router-dom';
import { useData } from '../lib/data.jsx';
import { useApi, useReveal } from '../lib/ui.js';
import { parseSections, slug, bullets } from '../lib/md.js';
import { Pane, Paras, PageHead } from '../components/Pane.jsx';

/** Fallback copy from the club's intro deck; Admin > Page text overrides it. */
const DEFAULT_BODY = `The Cybersecurity Committee is the offensive-and-defensive half of the club. You do not need programming experience to start. The first few weeks assume none.

## What we actually do
- Capture the Flag competitions: picoCTF, CyberPatriot, and smaller weekly challenges
- Weekly lectures paired with a hands-on lab, so nothing stays theoretical
- Systems programming in Rust: memory safety from the inside out
- Malware analysis: what a real sample does, in an environment where it cannot do it to you

## Rules of the road
We break into things we are allowed to break into. Everything we practice on is a lab, a competition box, or our own machines. Doing it anywhere else is a felony and gets you removed from the club. Not a metaphor, an actual law.

## Getting started
Show up. Bring a laptop if you have one; if you do not, say so and we will pair you with someone who does.`;

const CYBER_TYPES = /ctf|cyber|security|hack/i;

export default function Cyber() {
  const { settings, opportunities } = useData();
  const { data } = useApi('/officers');
  useReveal();

  const officers = (data?.officers ?? []).filter((o) => o.committee === 'cyber');
  const opps = opportunities.filter((o) => CYBER_TYPES.test(`${o.title} ${o.org ?? ''} ${o.description ?? ''}`));
  const secs = parseSections(settings.cyber_body || DEFAULT_BODY);
  const lead = officers[0];

  return (
    <>
      <PageHead
        eyebrow="cat committees/cyber.md"
        title="Cybersecurity."
        lead={settings.cyber_intro || 'Capture the Flag, systems programming, and taking things apart to find out how they broke.'}
        kv={
          <div className="kv two2">
            <div><span>firm yes to cyber on the interest form</span><strong>8 of 23</strong></div>
            <div><span>lead officer</span><strong>{lead?.name ?? 'TBA'}</strong></div>
          </div>
        }
      />
      <section className="sec" style={{ border: 0 }}>
        <div className="wrap">
          <div className="cy">
            <div className="cygrid">
              {secs.map((s, i) => {
                const ul = bullets(s);
                const onlyList = s.h && ul.length > 1 && s.blocks.length === 1;
                if (!s.h) return <Pane key={i} file="overview.md" meta="committee/cyber" cls="wide"><Paras section={s} /></Pane>;
                if (onlyList)
                  return (
                    <Pane key={i} file={slug(s.h)} meta={`${ul.length} entries`} cls="wide">
                      <ul className="gl">
                        {ul.map((t, k) => (
                          <li key={k}><b>{String(k + 1).padStart(2, '0')}</b><span>{t}</span></li>
                        ))}
                      </ul>
                    </Pane>
                  );
                return (
                  <Pane key={i} file={slug(s.h)} meta="read me" cls={/rules|warn|law/i.test(s.h) ? 'warn' : 'gd'}>
                    <Paras section={s} />
                  </Pane>
                );
              })}
            </div>
            <aside className="side" aria-label="Committee officers and cyber listings">
              {officers.length > 0 && (
                <Pane file="who_runs_it" meta={`${officers.length} officer${officers.length === 1 ? '' : 's'}`}>
                  {officers.map((o) => (
                    <div key={o.id} className="of-row"><b>{o.name}</b><span>{o.role}</span></div>
                  ))}
                </Pane>
              )}
              {opps.length > 0 && (
                <Pane file="cyber_on_the_board" meta={`${opps.length} listings`} delay={1}>
                  <ul className="bd">
                    {opps.map((o) => (
                      <li key={o.id}>
                        <a href={o.url} target="_blank" rel="noreferrer noopener">{o.title}</a>
                        <small>
                          <span className={`ty t-${o.type}`}>{o.type}</span>
                          <span>{o.deadline ? `due ${o.deadline}` : 'rolling'}</span>
                        </small>
                      </li>
                    ))}
                  </ul>
                  <Link className="more" to="/opportunities">The whole board &rarr;</Link>
                </Pane>
              )}
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
