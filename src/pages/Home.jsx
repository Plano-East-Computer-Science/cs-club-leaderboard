/**
 * `/`: the public front door when signed out, Today when signed in (Wave 4).
 * Reads the shell's session so the page and the top bar never disagree.
 */
import FrontDoor from './FrontDoor.jsx';
import Today from './Today.jsx';
import { Skeleton, useSession } from '../ui/index.js';

export default function Home() {
  const { user, loading } = useSession();
  if (loading)
    return (
      <div className="ui-page" role="status" aria-label="Loading">
        <Skeleton kind="title" />
      </div>
    );
  return user ? <Today user={user} /> : <FrontDoor />;
}
