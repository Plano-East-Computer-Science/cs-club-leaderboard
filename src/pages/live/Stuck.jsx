/**
 * Who is stuck (Wave 6, officer audit finding 11): during a lab, members who
 * have been on the same checkpoint for ten minutes or more, so an officer can
 * walk over before they give up. Officer console only; the room sends these
 * names to officer sockets and never to the projector.
 */
import { Warning } from '@phosphor-icons/react';
import { Card } from '../../ui/index.js';
import { isStuck, STUCK_MINUTES } from '../../../shared/live.js';
import { useTick } from '../Session.jsx';
import './live.css';

export default function Stuck({ progress, skew }) {
  useTick(15_000);
  const now = Date.now() + skew;
  const stuck = (progress ?? []).filter((p) => isStuck(p, now));
  return (
    <Card className="lk" aria-label="Who is stuck">
      <p className="ui-label">Stuck {STUCK_MINUTES}+ minutes on one checkpoint</p>
      {stuck.length === 0 ? (
        <p className="ui-small">Nobody right now. {progress?.length ?? 0} working in the lab.</p>
      ) : (
        <ul className="lk-list">
          {stuck.map((p) => (
            <li key={`${p.name}-${p.since}`}>
              <Warning size={18} aria-hidden="true" className="lk-i" />
              <b>{p.name}</b>
              <span className="ui-small">{p.tier}, checkpoint {p.at} of {p.of}</span>
              <span className="ui-mono lk-min">{Math.floor((now - p.since) / 60_000)} min</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
