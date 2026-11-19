/**
 * Per-block payload editors (Wave 6, v2-spec section 5): what each block
 * carries from the plan, so nothing is decided live. Used by the block editor
 * on the planner and on the host console (BlockEditor in Session.jsx).
 *
 * `first` is true for the first speaker block: a speaker night has one
 * speaker, and later speaker blocks (Talk, then Questions) share it.
 */
import SpeakerEditor from './SpeakerEditor.jsx';
import DuelEditor from './DuelEditor.jsx';
import TeachEditor from './TeachEditor.jsx';

export default function BlockPayload({ block, onChange, planId, firstSpeaker }) {
  if (block.type === 'speaker') {
    if (!firstSpeaker) return <p className="ui-small">Uses the speaker details from the first speaker block.</p>;
    return <SpeakerEditor value={block.speaker} onChange={(speaker) => onChange({ speaker })} planId={planId} />;
  }
  if (block.type === 'duel') return <DuelEditor value={block.duel} onChange={(duel) => onChange({ duel })} blockMinutes={block.minutes} />;
  if (block.type === 'teach') return <TeachEditor value={block.teach} onChange={(teach) => onChange({ teach })} />;
  return null;
}
