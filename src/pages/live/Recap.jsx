/**
 * `/recap/:code` (Wave 6): what happened at a meeting, once its room closes.
 * Public, first names only: title, date, how many came, the questions the
 * speaker answered, duel champions per division, and what was shown.
 *
 * Officers also get a button that draws a 1080x1350 recap card on a canvas, in
 * the club's fonts and colours, and downloads it as a PNG for Instagram.
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DownloadSimple, Microphone, Sword, Hammer, UsersThree } from '@phosphor-icons/react';
import { api } from '../../lib/api.js';
import { useClub } from '../../lib/club.js';
import { Button, Card, EmptyState, ErrorState, PageHeader, Section, Skeleton, Stat } from '../../ui/index.js';
import { whenLabel } from '../../../shared/planner.js';
import './live.css';

/* ------------------------------- the PNG card ------------------------------- */

const W = 1080;
const H = 1350;
const C = { bg: '#0b0b09', s1: '#131310', line: '#2e2b20', gold: '#ffc20e', t1: '#efeadb', t2: '#b9b29a', t3: '#8f8973' };
const DISP = '"Big Shoulders Display", "Arial Narrow", sans-serif';
const SANS = '"IBM Plex Sans", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

/** Lines of `text` that fit `width` in the context's current font, at most `max` (the last gets an ellipsis). */
export function wrap(ctx, text, width, max = 3) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= width || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > max) {
    const keep = lines.slice(0, max);
    let last = keep[max - 1];
    while (last && ctx.measureText(`${last}...`).width > width) last = last.slice(0, -1);
    keep[max - 1] = `${last.trimEnd()}...`;
    return keep;
  }
  return lines;
}

/** Draws the recap card on a 1080x1350 canvas. */
export async function drawCard(canvas, r, host, tagline = '') {
  await Promise.all([`800 120px ${DISP}`, `400 34px ${SANS}`, `600 34px ${SANS}`, `500 26px ${MONO}`].map((f) => document.fonts.load(f).catch(() => null)));
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const pad = 84;
  const inner = W - pad * 2;
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = C.gold;
  ctx.fillRect(0, 0, W, 14);
  ctx.textBaseline = 'alphabetic';

  let y = pad + 26;
  ctx.font = `500 26px ${MONO}`;
  ctx.fillStyle = C.gold;
  ctx.fillText('PLANO EAST CS CLUB', pad, y);
  ctx.fillStyle = C.t3;
  const when = whenLabel(r.date).toUpperCase();
  ctx.fillText(when, W - pad - ctx.measureText(when).width, y);

  y += 110;
  ctx.font = `800 112px ${DISP}`;
  ctx.fillStyle = C.t1;
  for (const l of wrap(ctx, r.title.toUpperCase(), inner, 3)) {
    ctx.fillText(l, pad, y);
    y += 104;
  }
  y -= 30;
  ctx.font = `400 34px ${SANS}`;
  ctx.fillStyle = C.t2;
  ctx.fillText(r.speaker ? `${r.kind}, with ${r.speaker.name}` : r.kind, pad, y);

  // The turnout, big.
  y += 190;
  ctx.font = `800 150px ${DISP}`;
  ctx.fillStyle = C.gold;
  const n = String(r.came);
  ctx.fillText(n, pad, y);
  const nw = ctx.measureText(n).width;
  ctx.font = `600 38px ${SANS}`;
  ctx.fillStyle = C.t1;
  ctx.fillText(r.came === 1 ? 'member came' : 'members came', pad + nw + 24, y - 14);

  y += 56;
  ctx.fillStyle = C.line;
  ctx.fillRect(pad, y, inner, 2);
  y += 70;

  const label = (t) => {
    ctx.font = `500 26px ${MONO}`;
    ctx.fillStyle = C.t3;
    ctx.fillText(t.toUpperCase(), pad, y);
    y += 56;
  };
  const room = () => y < H - 200;

  if (r.champions.length) {
    label('Duel champions');
    for (const c of r.champions) {
      if (!room()) break;
      ctx.font = `500 26px ${MONO}`;
      ctx.fillStyle = C.t2;
      ctx.fillText(c.division.toUpperCase(), pad, y);
      ctx.font = `800 72px ${DISP}`;
      ctx.fillStyle = C.t1;
      ctx.fillText(c.name.toUpperCase(), pad + 280, y + 6);
      y += 92;
    }
    y += 10;
  }
  if (r.questions.length && room()) {
    label('The speaker answered');
    ctx.font = `400 34px ${SANS}`;
    for (const q of r.questions.slice(0, 3)) {
      if (!room()) break;
      ctx.fillStyle = C.gold;
      ctx.fillRect(pad, y - 28, 4, 34);
      ctx.fillStyle = C.t1;
      for (const l of wrap(ctx, q.text, inner - 28, 2)) {
        ctx.fillText(l, pad + 28, y);
        y += 46;
      }
      y += 22;
    }
  }
  if (r.shown.length && room()) {
    label(r.shown.some((s) => s.shown) ? 'On the screen' : 'Shared');
    for (const s of r.shown.slice(0, 3)) {
      if (!room()) break;
      ctx.font = `600 34px ${SANS}`;
      ctx.fillStyle = C.t1;
      ctx.fillText(s.name, pad, y);
      const off = ctx.measureText(`${s.name}  `).width;
      ctx.font = `400 34px ${SANS}`;
      ctx.fillStyle = C.t2;
      ctx.fillText(wrap(ctx, s.line, inner - off, 1)[0] ?? '', pad + off, y);
      y += 58;
    }
  }

  // Footer.
  ctx.fillStyle = C.line;
  ctx.fillRect(pad, H - 132, inner, 2);
  ctx.font = `500 26px ${MONO}`;
  ctx.fillStyle = C.t2;
  ctx.fillText(`${host}/recap/${r.code}`, pad, H - 76);
  ctx.fillStyle = C.gold;
  const join = tagline.toUpperCase();
  ctx.fillText(join, W - pad - ctx.measureText(join).width, H - 76);
}

function CardButton({ r }) {
  const m = useClub()?.meeting;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    setBusy(true);
    setErr('');
    try {
      const canvas = document.createElement('canvas');
      await drawCard(canvas, r, location.host, m?.day ? `${m.day}s, ${m.time}` : '');
      const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/png'));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `recap-${r.code.toLowerCase()}-${r.date}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      setErr(e.message || 'Could not draw the card.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="primary" icon={DownloadSimple} onClick={go} disabled={busy}>{busy ? 'Drawing' : 'Instagram card (PNG)'}</Button>
      {err && <p className="ui-field__e" role="alert">{err}</p>}
    </>
  );
}

/* ---------------------------------- the page ---------------------------------- */

export default function Recap() {
  const { code } = useParams();
  const [r, setR] = useState(null);
  const [err, setErr] = useState('');
  const [officer, setOfficer] = useState(false);
  const load = () => {
    setErr('');
    api.get(`/recap/${encodeURIComponent(code)}`).then(setR).catch((e) => setErr(e.message));
  };
  useEffect(load, [code]);
  useEffect(() => {
    api.get('/admin/session').then((s) => setOfficer(Boolean(s?.authed))).catch(() => {});
  }, []);

  if (err) return <div className="ui-page"><ErrorState onRetry={load}>{err}</ErrorState></div>;
  if (!r) return <div className="ui-page" role="status" aria-label="Loading the recap"><Skeleton kind="title" /><Skeleton kind="block" /></div>;

  return (
    <div className="ui-page lr">
      <PageHeader
        title={r.title}
        subtitle={`${r.kind}, ${whenLabel(r.date)}${r.speaker ? `, with ${r.speaker.name}` : ''}`}
        actions={officer ? <CardButton r={r} /> : null}
      />
      <div className="lr-stats">
        <Stat value={r.came} label={r.came === 1 ? 'member came' : 'members came'} />
        {r.questions.length > 0 && <Stat value={r.questions.length} label="questions answered" />}
        {r.shown.length > 0 && <Stat value={r.shown.length} label="things shared" />}
      </div>
      {r.speaker && (
        <Section title="The speaker answered">
          {r.questions.length ? (
            <ol className="lr-qs">
              {r.questions.map((q, i) => (
                <li key={i}>
                  <Microphone size={18} aria-hidden="true" />
                  <span>{q.text}</span>
                  <span className="ui-small">{q.votes} vote{q.votes === 1 ? '' : 's'}</span>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState icon={Microphone}>No questions were marked answered.</EmptyState>
          )}
        </Section>
      )}
      {r.champions.length > 0 && (
        <Section title="Duel champions">
          <div className="lr-champs">
            {r.champions.map((c) => (
              <Card key={c.division} className="lr-champ">
                <p className="ui-label">{c.division}</p>
                <p className="lr-champ__n">{c.name}</p>
                <p className="ui-small">{c.wins} win{c.wins === 1 ? '' : 's'}, {c.solved} solved</p>
              </Card>
            ))}
          </div>
        </Section>
      )}
      {r.shown.length > 0 && (
        <Section title={r.shown.some((s) => s.shown) ? 'Shown on the screen' : 'Shared'}>
          <ul className="lr-shown">
            {r.shown.map((s, i) => (
              <li key={i}>
                <Hammer size={18} aria-hidden="true" />
                <b>{s.name}</b>
                <span>{s.line}</span>
                {s.result && <span className="ui-small">{s.result}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {!r.speaker && !r.champions.length && !r.shown.length && (
        <EmptyState icon={UsersThree}>That was the meeting. See you next week.</EmptyState>
      )}
      {r.champions.length === 0 && r.kind === 'Duel night' && <EmptyState icon={Sword}>No duel rounds were scored.</EmptyState>}
    </div>
  );
}
