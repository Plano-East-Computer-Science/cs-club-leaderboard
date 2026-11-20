/**
 * The Me door. Its tabs (Overview, Points, Quests, Goals, Account) come from the
 * door layout, so they stay on screen on every Me page.
 */
import { SignIn as SignInIcon, UserCircle } from '@phosphor-icons/react';
import Portfolio from './Portfolio.jsx';
import Student from './Student.jsx';
import { Button, EmptyState, SkeletonList, useSession } from '../ui/index.js';

function NeedUser({ children }) {
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
          Sign in to see your page.
        </EmptyState>
      </div>
    );
  return children(user);
}

export default function Me() {
  return <NeedUser>{(user) => <div className="hub"><Portfolio id={user.id} /></div>}</NeedUser>;
}

export function MePoints() {
  return (
    <NeedUser>
      {(user) =>
        user.student_id ? (
          <Student id={String(user.student_id)} />
        ) : (
          <div className="ui-page">
            <EmptyState action={<Button to="/compete" variant="secondary">See the standings</Button>}>
              Your points record starts at your first club meeting.
            </EmptyState>
          </div>
        )
      }
    </NeedUser>
  );
}
