/**
 * Speaker night (Wave 6; v2-spec section 5, research notes on Q&A):
 *
 *   SpeakerConsole  officer laptop: the queue with who asked, hide, answered, the
 *                   projector mode (questions or Zoom), the moderator view, the
 *                   speaker's private link, the Zoom link, the takeaways pad
 *   SpeakerPlay     member phone: ask (no name shown), upvote, report
 *   ModView         `/host/:code/mod` on an officer's phone: the top question in
 *                   large type, Answered and Skip, the next three, live counts
 *
 * Questions are anonymous to members, the projector and the speaker; officers
 * see who asked, to moderate. Seed questions from the plan come first.
 */
import { useState } from 'react';
import { Check, CopySimple, Flag, Eye, EyeSlash, Monitor, VideoCamera, ArrowUp, SkipForward, DeviceMobile } from '@phosphor-icons/react';
import { api } from '../../lib/api.js';
import { Button, Card, Field, Pill, cx } from '../../ui/index.js';
import './live.css';

/** Waiting questions as everyone but officers count them: not answered, not hidden. */
export const waiting = (qs) => qs.filter((q) => !q.answered && !q.hidden);

function speakerOfBlocks(blocks) {
  const sp = (blocks ?? []).filter((b) => b.type === 'speaker' && b.speaker);
  return (sp.find((b) => b.speaker.name) ?? sp[0])?.speaker ?? null;
}

function Tags({ q }) {
  return (
    <>
      {q.seed && <Pill tone="gold">From the officers</Pill>}
      {q.early && <Pill>Asked early</Pill>}
      {q.reports > 0 && <Pill tone="need" icon={Flag}>{q.reports} report{q.reports === 1 ? '' : 's'}</Pill>}
      {q.hidden && <Pill tone="need" icon={EyeSlash}>Hidden</Pill>}
    </>
  );
}

/** Copies the speaker's private link. Asks the server each time, so a closed room says so. */
function SpeakerLink({ code }) {
  const [msg, setMsg] = useState('');
  const [url, setUrl] = useState('');
  const copy = async () => {
    setMsg('');
    try {
      const { path } = await api.get(`/admin/hub/rooms/${code}/speaker-link`);
      const full = `${location.origin}${path}`;
      setUrl(full);
      try {
        await navigator.clipboard.writeText(full);
        setMsg('Copied. Send it to the speaker privately. It stops working when the room closes.');
      } catch {
        setMsg('Copy it from the box. It stops working when the room closes.');
      }
    } catch (e) {
      setMsg(e.message);
    }
  };
  return (
    <div className="ls-link">
      <Button icon={CopySimple} onClick={copy}>Copy the speaker link</Button>
      {url && <input className="ui-input ls-link__url" readOnly value={url} aria-label="Speaker link" onFocus={(e) => e.target.select()} />}
      {msg && <p className="ui-small" role="status">{msg}</p>}
    </div>
  );
}

export function SpeakerConsole({ state, code, send }) {
  const sp = state.speaker;
  const info = speakerOfBlocks(state.session.blocks);
  const [pad, setPad] = useState(sp.takeaways);
  const [saved, setSaved] = useState(true);
  const left = waiting(sp.qs).length;
  return (
    <div className="ls-console">
      <Card className="ls-tools" aria-label="Speaker tools">
        <div className="ls-tools__who">
          <p className="ui-label">Speaker</p>
          <p className="ui-heading">{info?.name || 'No speaker name in the plan'}</p>
          {info?.title && <p className="ui-small">{info.title}</p>}
        </div>
        <div className="ls-mode" role="group" aria-label="What the projector shows">
          <span className="ui-small">Projector</span>
          <Button variant={sp.mode === 'questions' ? 'primary' : 'secondary'} icon={Monitor} aria-pressed={sp.mode === 'questions'} onClick={() => send({ t: 'speaker_mode', mode: 'questions' })}>
            Questions
          </Button>
          <Button variant={sp.mode === 'zoom' ? 'primary' : 'secondary'} icon={VideoCamera} aria-pressed={sp.mode === 'zoom'} onClick={() => send({ t: 'speaker_mode', mode: 'zoom' })}>
            Zoom strip
          </Button>
        </div>
        <div className="ls-tools__acts">
          {info?.zoomUrl && <Button href={info.zoomUrl} icon={VideoCamera}>Open Zoom</Button>}
          <Button href={`/host/${code}/mod`} icon={DeviceMobile}>Moderator view</Button>
          <SpeakerLink code={code} />
        </div>
        {info?.intro && (
          <details className="ls-intro">
            <summary className="ui-small">Intro to read</summary>
            <p className="ui-body">{info.intro}</p>
          </details>
        )}
      </Card>

      <section aria-label="Questions" className="ls-queue">
        <p className="ui-label">{left} waiting, {sp.qs.length} in all</p>
        {sp.qs.length === 0 ? (
          <p className="ui-small">No questions yet. Members ask from their phones.</p>
        ) : (
          <ol className="ls-list">
            {sp.qs.map((q) => (
              <li key={q.id} className={cx(q.answered && 'is-done', q.hidden && 'is-hidden')}>
                <b className="ls-votes" aria-label={`${q.votes} votes`}>{q.votes}</b>
                <div className="ls-list__body">
                  <p>{q.text}</p>
                  <p className="ls-meta">
                    <span>{q.name}</span>
                    <Tags q={q} />
                  </p>
                </div>
                <div className="ls-list__acts">
                  <Button variant={q.answered ? 'secondary' : 'ghost'} icon={Check} aria-pressed={q.answered} onClick={() => send({ t: 'sq_answered', id: q.id })}>
                    {q.answered ? 'Answered' : 'Mark answered'}
                  </Button>
                  <Button variant="ghost" icon={q.hidden ? Eye : EyeSlash} onClick={() => send({ t: 'sq_hide', id: q.id, hidden: !q.hidden })}>
                    {q.hidden ? 'Put back' : 'Hide'}
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Field
        as="textarea"
        label="Takeaways (saved with the room)"
        rows={4}
        maxLength={4000}
        value={pad}
        helper={saved ? 'Saved.' : 'Saves when you click away.'}
        onChange={(e) => {
          setPad(e.target.value);
          setSaved(false);
        }}
        onBlur={() => {
          send({ t: 'takeaways', text: pad });
          setSaved(true);
        }}
      />
    </div>
  );
}

/** Member phone: ask without a name, upvote others, report anything that should not be there. */
export function SpeakerPlay({ speaker, block, send }) {
  const [text, setText] = useState('');
  const qs = speaker.qs;
  return (
    <div className="ls-play">
      {block?.speaker?.name && (
        <p className="ui-small">
          <b className="ls-play__who">{block.speaker.name}</b>
          {block.speaker.title ? `, ${block.speaker.title}` : ''}
        </p>
      )}
      <Card as="form" className="ls-ask" onSubmit={(e) => {
        e.preventDefault();
        send({ t: 'sq_ask', text: text.trim() });
        setText('');
      }}>
        <Field label="Ask the speaker (no name shown)" maxLength={200} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a question" />
        <Button type="submit" variant="primary" disabled={text.trim().length < 3}>Send</Button>
      </Card>
      {qs.length > 0 && <QuestionList qs={qs} onVote={(q) => send({ t: 'sq_vote', id: q.id })} onReport={(q) => send({ t: 'sq_report', id: q.id })} />}
      {speaker.takeaways && (
        <Card>
          <p className="ui-label">Takeaways</p>
          <p className="ui-body ls-pre">{speaker.takeaways}</p>
        </Card>
      )}
    </div>
  );
}

/**
 * The member list of questions, shared by the room and the Today card.
 * q: { id, text, votes, voted, mine, seed, answered, reported }.
 */
export function QuestionList({ qs, onVote, onReport, reportSlot }) {
  return (
    <ol className="ls-mlist">
      {qs.map((q) => (
        <li key={q.id} className={cx(q.answered && 'is-done')}>
          <button
            type="button"
            className={cx('ls-up', q.voted && 'is-on')}
            aria-pressed={Boolean(q.voted)}
            disabled={q.mine || q.answered || !onVote || (q.seed && typeof q.id === 'string')}
            aria-label={`${q.mine ? 'Your question' : q.voted ? 'You upvoted this' : 'Upvote'}, ${q.votes} ${q.votes === 1 ? 'vote' : 'votes'}`}
            onClick={() => onVote(q)}
          >
            <ArrowUp size={16} weight={q.voted ? 'bold' : 'regular'} aria-hidden="true" />
            <b>{q.votes}</b>
          </button>
          <div className="ls-mlist__body">
            <p>{q.text}</p>
            <p className="ls-meta">
              {q.seed && <Pill tone="gold">From the officers</Pill>}
              {q.mine && <span>Yours</span>}
              {q.answered && <span>Answered</span>}
              {!q.mine && !q.seed && (reportSlot ? reportSlot(q) : onReport && (
                q.reported ? <span>Reported</span> : (
                  <button type="button" className="ls-report" aria-label={`Report the question: ${q.text.slice(0, 40)}`} onClick={() => window.confirm('Report this question to the officers?') && onReport(q)}>
                    Report
                  </button>
                )
              ))}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/* --------------------------------- moderator phone --------------------------------- */

export function ModView({ state, code, send, status }) {
  const sp = state.speaker;
  const open = waiting(sp.qs);
  const top = open[0];
  const next = open.slice(1, 4);
  const flagged = sp.qs.filter((q) => q.reports > 0 && !q.hidden && !q.answered);
  return (
    <div className="lm">
      <header className="lm-top">
        <p className="lm-top__code">{code}</p>
        <p className="lm-count" aria-live="polite">
          <span><b>{open.length}</b> waiting</span>
          <span><b>{state.here}</b> here</span>
        </p>
        {status !== 'open' && <Pill tone="need">{status === 'connecting' ? 'Connecting' : 'Reconnecting'}</Pill>}
      </header>

      {state.ended ? (
        <p className="lm-empty">The room has ended.</p>
      ) : top ? (
        <section className="lm-now" aria-label="Ask this now">
          <p className="lm-now__k">
            <span>{top.votes} vote{top.votes === 1 ? '' : 's'}</span>
            <span>{top.name}</span>
            {top.seed && <Pill tone="gold">From the officers</Pill>}
          </p>
          <p className="lm-now__q">{top.text}</p>
          <div className="lm-acts">
            <Button variant="primary" size="lg" icon={Check} onClick={() => send({ t: 'sq_answered', id: top.id, value: true })}>Answered</Button>
            <Button size="lg" icon={SkipForward} onClick={() => send({ t: 'sq_skip', id: top.id })}>Skip</Button>
          </div>
          <button type="button" className="lm-hide" onClick={() => window.confirm('Hide this question from every screen?') && send({ t: 'sq_hide', id: top.id, hidden: true })}>
            Hide this question
          </button>
        </section>
      ) : (
        <p className="lm-empty">No questions waiting. Ask the room for one, or read a seed question.</p>
      )}

      {next.length > 0 && (
        <section aria-label="Next up">
          <p className="ui-label">Next</p>
          <ol className="lm-next">
            {next.map((q) => (
              <li key={q.id}>
                <b>{q.votes}</b>
                <span>{q.text}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {flagged.length > 0 && (
        <section aria-label="Reported">
          <p className="ui-label">Reported by members</p>
          <ul className="lm-next">
            {flagged.map((q) => (
              <li key={q.id}>
                <span>{q.text}</span>
                <Button variant="danger" onClick={() => send({ t: 'sq_hide', id: q.id, hidden: true })}>Hide</Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="lm-mode" role="group" aria-label="What the projector shows">
        <span className="ui-small">Projector</span>
        <Button variant={sp.mode === 'questions' ? 'primary' : 'secondary'} aria-pressed={sp.mode === 'questions'} onClick={() => send({ t: 'speaker_mode', mode: 'questions' })}>Questions</Button>
        <Button variant={sp.mode === 'zoom' ? 'primary' : 'secondary'} aria-pressed={sp.mode === 'zoom'} onClick={() => send({ t: 'speaker_mode', mode: 'zoom' })}>Zoom strip</Button>
      </div>
    </div>
  );
}
