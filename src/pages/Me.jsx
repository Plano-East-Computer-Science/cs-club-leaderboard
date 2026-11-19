/**
 * The Me door (Wave 4): the signed-in member's portfolio, with links to the
 * pages that are theirs. Wave 7 folds these into one page; for now they link out.
 */
import { Files, Flag, Path, Compass, IdentificationBadge, GearSix, SignIn as SignInIcon, UserCircle } from '@phosphor-icons/react';
import Portfolio from './Portfolio.jsx';
import { Button, EmptyState, SkeletonList, useSession } from '../ui/index.js';

export default function Me() {
  const { user, loading } = useSession();
  if (loading)
    return (
      <div className="ui-page">
        <SkeletonList rows={4} label="Loading your page" />
      </div>
    );
  if (!user)
    return (
      <div className="ui-page">
        <EmptyState icon={UserCircle} action={<Button to="/signin" variant="primary" icon={SignInIcon}>Sign in</Button>}>
          Sign in to see your portfolio and points record.
        </EmptyState>
      </div>
    );
  return (
    <>
      <nav className="ui-me" aria-label="Your pages">
        <div className="ui-me__in">
        <Button variant="ghost" icon={Files} to={user.student_id ? `/student/${user.student_id}` : '/compete'}>Points record</Button>
        <Button variant="ghost" icon={Flag} to="/quests">Quests</Button>
        <Button variant="ghost" icon={Path} to="/pathways">Pathways</Button>
        <Button variant="ghost" icon={Compass} to="/compass">Compass</Button>
        <Button variant="ghost" icon={IdentificationBadge} to="/officers/apply">Officer application</Button>
        <Button variant="ghost" icon={GearSix} to="/signin">Account</Button>
        </div>
      </nav>
      <div className="hub">
        <Portfolio id={user.id} />
      </div>
    </>
  );
}
