import { Link } from 'react-router-dom';
import { TIERS } from '../lib/tiers.js';
import { useData } from '../lib/data.jsx';
import { useApi, useReveal } from '../lib/ui.js';
import { parseSections, slug, paras } from '../lib/md.js';
import { Pane, Paras, PageHead } from '../components/Pane.jsx';
import { useClub, meetingLine } from '../lib/club.js';

const COMMITTEE = { main: 'Main CS Club', cyber: 'Cybersecurity Committee' };

export default function About() {
  const { settings } = useData();
  const { data } = useApi('/officers');
  const club = useClub();
  useReveal();
  const meets = meetingLine(club?.meeting);

  const officers = data?.officers ?? [];
  const secs = parseSections(settings.about_body || '');
  const intro = secs.find((s) => !s.h);
  const named = secs.filter((s) => s.h);
  const pointsSec = named.find((s) => /point/i.test(s.h));
  // The page text's own "Meetings" section joins the day and time from /api/club in one pane.
  const meetSec = named.find((s) => s !== pointsSec && /meeting/i.test(s.h));
  const rest = named.filter((s) => s !== pointsSec && s !== meetSec);

  const heading = (settings.about_heading || 'About the club').replace(/\.$/, '');
  const words = heading.split(' ');
  const last = words.pop();

  return (
    <>
      <PageHead
        one
        eyebrow={settings.school_name || 'Plano East Senior High School'}
        title={<>{words.join(' ')}{words.length ? ' ' : ''}<em>{last}</em>.</>}
      />
      <section className="sec" style={{ border: 0, paddingBottom: 12 }}>
        <div className="wrap">
          <div className="ab">
            <Pane file="about.md" meta="plano east shs" cls="a">
              {intro ? <Paras section={intro} /> : <div className="pn-b"><p className="d">No about text yet. An officer can add it under Officer tools, Page text.</p></div>}
            </Pane>

            {/* V3-A: point values come from /api/club (shared/points.js), never from page text. */}
            <Pane file="points.conf" meta={club ? `${club.points.length} rules` : 'loading'} cls="p">
              <div className="pn-b">
                {pointsSec && paras(pointsSec)[0] && <p className="d">{paras(pointsSec)[0]}</p>}
                <h4 className="k">cat rates</h4>
                {club?.points.map((p) => (
                  <div key={p.kind} className="prow">
                    <span>{p.label}{p.cap && <small className="m"> ({p.cap})</small>}</span>
                    <span className="g">{p.points}</span>
                  </div>
                ))}
                {pointsSec && paras(pointsSec).length > 1 && (
                  <>
                    <h4 className="k">prize</h4>
                    {paras(pointsSec).slice(1).map((p, i) => <p key={i}>{p}</p>)}
                  </>
                )}
              </div>
            </Pane>

            <div className="m" style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
              {(meets || club?.meeting.note || meetSec) && (
                <Pane file={meetSec ? slug(meetSec.h) : 'meetings'} meta="when and where">
                  {(meets || club?.meeting.note) && (
                    <div className="pn-b" style={meetSec ? { paddingBottom: 0 } : undefined}>
                      {meets && <p className="g">{meets}</p>}
                      {club.meeting.note && <p className="d">{club.meeting.note}</p>}
                    </div>
                  )}
                  {meetSec && <Paras section={meetSec} />}
                </Pane>
              )}
              {rest.map((s) => (
                <Pane key={s.h} file={slug(s.h)} meta="read me">
                  <Paras section={s} />
                </Pane>
              ))}
            </div>

            <Pane file="tiers.conf" meta={`${TIERS.length} tiers`} cls="t">
              <ol className="tl">
                {TIERS.map((t) => (
                  <li key={t.name} style={{ '--c': t.color }}><i /><b>{t.name}</b><span>{t.min}+</span></li>
                ))}
              </ol>
            </Pane>

            <Pane file="get_in" meta="contact" cls="gi">
              <div className="pn-b">
                <Link className="btn pri" to="/join">How to join</Link>
                <Link className="btn" to="/cyber">Cybersecurity Committee</Link>
                <Link className="btn" to="/standings">See the standings</Link>
                {settings.discord_url && <a className="btn" href={settings.discord_url} target="_blank" rel="noreferrer noopener">Join the Discord</a>}
                {settings.email && <a className="btn" href={`mailto:${settings.email}`}>Email an officer</a>}
              </div>
            </Pane>
          </div>
        </div>
      </section>

      {officers.length > 0 && (
        <section className="sec" style={{ border: 0, paddingTop: 12 }}>
          <div className="wrap">
            <h2>The officers <small>ls officers/</small></h2>
            <div className="og">
              {officers.map((o, i) => (
                <article key={o.id} className="of sp rv" style={{ '--d': i % 3 }}>
                  <h3>{o.name}</h3>
                  <div className="rl">{o.role}</div>
                  {o.note && <p>{o.note}</p>}
                  {o.note !== COMMITTEE[o.committee] && <span className="cm">{COMMITTEE[o.committee] ?? o.committee}</span>}
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
