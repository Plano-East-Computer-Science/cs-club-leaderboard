/**
 * `/speaker/:code/:token`: the guest speaker's private, read-only screen (Wave 6).
 * No account. Shows the live queue, most upvoted first, in type large enough to
 * read from across a desk. It polls the Worker, which checks the token and
 * refuses once the room closes, so the link dies with the meeting.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import './live.css';

const POLL_MS = 3000;

export default function SpeakerLink() {
  const { code, token } = useParams();
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null); // { text, final }

  useEffect(() => {
    let stop = false;
    let timer = 0;
    const load = async () => {
      try {
        const res = await fetch(`/api/speaker/${encodeURIComponent(code)}/${encodeURIComponent(token)}`, { cache: 'no-store' });
        const body = await res.json().catch(() => ({}));
        if (stop) return;
        if (!res.ok) {
          // 404 and 410 are final: a wrong link, or the room has closed.
          setErr({ text: body.error || 'This link is not working.', final: res.status === 404 || res.status === 410 });
          if (res.status === 404 || res.status === 410) return;
        } else {
          setErr(null);
          setD(body);
          if (body.ended) return;
        }
      } catch {
        if (!stop) setErr({ text: 'Lost the connection. Retrying.', final: false });
      }
      timer = setTimeout(load, POLL_MS);
    };
    load();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [code, token]);

  if (err?.final || d?.ended) {
    return (
      <main className="lg lg--center">
        <h1 className="lg-title">{d?.ended ? 'The meeting has ended. Thank you for speaking.' : err.text}</h1>
      </main>
    );
  }
  if (!d) {
    return (
      <main className="lg lg--center" aria-busy="true">
        <p className="lg-meta">{err?.text ?? 'Loading the questions'}</p>
      </main>
    );
  }
  const [top, ...rest] = d.waiting;
  return (
    <main className="lg">
      <header className="lg-top">
        <p className="lg-who">Questions{d.speaker?.name ? ` for ${d.speaker.name}` : ''}</p>
        <p className="lg-meta" aria-live="polite">
          {d.waiting.length} waiting, {d.answered} answered{err ? `. ${err.text}` : ''}
        </p>
      </header>
      {top ? (
        <>
          <section className="lg-now" aria-label="Most upvoted">
            <p className="lg-votes">{top.votes} vote{top.votes === 1 ? '' : 's'}</p>
            <p className="lg-q">{top.text}</p>
          </section>
          {rest.length > 0 && (
            <ol className="lg-next" aria-label="Next">
              {rest.slice(0, 6).map((q) => (
                <li key={q.id}>
                  <b>{q.votes}</b>
                  <span>{q.text}</span>
                </li>
              ))}
            </ol>
          )}
        </>
      ) : (
        <p className="lg-q lg-q--quiet">No questions waiting yet. The room sends them from their phones.</p>
      )}
    </main>
  );
}
