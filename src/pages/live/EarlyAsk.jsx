/**
 * The speaker-night question card on Today (Wave 6). From openEarlyHours before
 * a planned speaker night until its room opens, members ask and upvote here;
 * the room picks the questions up, votes and all, when it opens. Seed
 * questions from the officers come first. No names are shown.
 */
import { useEffect, useState } from 'react';
import { Microphone } from '@phosphor-icons/react';
import { api } from '../../lib/api.js';
import { Button, Card, Field, useToast } from '../../ui/index.js';
import ReportButton from '../../components/ReportButton.jsx';
import { QuestionList } from './Speaker.jsx';
import './live.css';

const WEEK = 7 * 86_400_000;
const opensLabel = (ms) =>
  new Date(ms).toLocaleString('en-US', { timeZone: 'America/Chicago', weekday: 'long', hour: 'numeric', minute: '2-digit' });

export default function EarlyAsk() {
  const [d, setD] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    api.get('/speaker-questions').then(setD).catch(() => setD(null));
  }, []);

  const n = d?.night;
  if (!n || d.room) return null; // nothing planned, or the room is open and Today already shows it
  const who = n.speaker.name || 'the speaker';
  if (!d.open) {
    if (d.opensAt - Date.now() > WEEK) return null;
    return (
      <Card className="le le--soon">
        <p className="ui-small">
          <Microphone size={16} aria-hidden="true" /> Questions for {who} open {opensLabel(d.opensAt)}.
        </p>
      </Card>
    );
  }

  const act = async (fn) => {
    setBusy(true);
    try {
      const r = await fn();
      setD((x) => ({ ...x, questions: [...x.questions.filter((q) => q.seed), ...r.questions] }));
      return true;
    } catch (e) {
      toast(e.message, { tone: 'bad' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="le" aria-labelledby="le-t">
      <p className="ui-label">Speaker night questions</p>
      <h2 id="le-t" className="ui-heading">Ask {who}</h2>
      {n.speaker.title && <p className="ui-small">{n.speaker.title}</p>}
      <form
        className="le-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await act(() => api.post('/speaker-questions', { planId: n.id, text: text.trim() }))) {
            setText('');
            toast('Sent. It goes to the room when the meeting starts.');
          }
        }}
      >
        <Field label="Your question (no name shown)" maxLength={200} value={text} onChange={(e) => setText(e.target.value)} placeholder="What do you wish you knew at 16?" />
        <Button type="submit" variant="secondary" disabled={busy || text.trim().length < 3}>Send</Button>
      </form>
      {d.questions.length > 0 && (
        <QuestionList
          qs={d.questions}
          onVote={(q) => act(() => api.post(`/speaker-questions/${q.id}/vote`))}
          reportSlot={(q) => <ReportButton kind="question" id={q.id} what="this question" />}
        />
      )}
    </Card>
  );
}
