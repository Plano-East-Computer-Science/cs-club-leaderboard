/**
 * G5: information for parents and the sponsor. The contact is the club email
 * setting, so nothing here needs editing when officers change over.
 */
import { Link } from 'react-router-dom';
import { useData } from '../lib/data.jsx';

export default function Parents() {
  const { settings } = useData();
  const mail = settings.email;
  const school = settings.school_name || 'Plano East Senior High School';
  return (
    <div className="legal mx-auto max-w-2xl">
      <header className="mb-8">
        <p className="eyebrow">For parents and the sponsor</p>
        <h1 className="display mt-2 text-[clamp(2rem,6vw,3rem)] leading-[0.95] font-extrabold">About this site</h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--ink-soft)' }}>
          The {settings.club_name || 'Computer Science Club'} at {school} is run by students with a teacher sponsor. This
          website is where members see standings, take lessons and practice problems, join meeting rooms, and find
          competitions and internships.
        </p>
      </header>

      <section>
        <h2>What it is not</h2>
        <ul>
          <li>No private messages. Members cannot message each other through the site. The only things members write are short public ideas, project descriptions, and questions to the meeting host.</li>
          <li>No ads, no selling of information, no analytics trackers, no AI features.</li>
          <li>No payments or purchases.</li>
        </ul>
      </section>

      <section>
        <h2>Safety measures</h2>
        <ul>
          <li><b>Small amount of data.</b> An email address, a display name and club activity. Public pages show first names only unless the member chooses otherwise. Email addresses are visible only to officers. <Link to="/privacy">Full privacy page</Link>.</li>
          <li><b>Sign-in</b> uses a one-time email link or Google. There are no passwords to leak. The email link refuses school district addresses and asks for a personal one.</li>
          <li><b>Reporting.</b> Anything a member posts has a report button. Officers review reports and can hide content.</li>
          <li><b>Officer access is accountable.</b> Officer actions are logged by name, the shared emergency password is rate limited, and officers cannot approve their own points.</li>
          <li><b>Meeting gateway.</b> At school the club can open a limited path to a short list of approved sites, with sign-in pages blocked and no cookies passed. It is switched on only by an officer for a meeting.</li>
          <li><b>Delete or download at any time.</b> Members can export or delete their account themselves. Deleted data is erased within two weeks.</li>
        </ul>
      </section>

      <section>
        <h2>Verified records</h2>
        <p>A member can ask an officer for a verified record of attendance and approved results, for applications or volunteer hours. It carries a code that can be checked at <span className="mono">/verify</span>, and an officer can revoke it.</p>
      </section>

      <section>
        <h2>Questions, or a request about your child</h2>
        <p>
          {mail ? <>Write to <a href={`mailto:${mail}`}>{mail}</a>.</> : 'Use the contact details on the About page.'} We
          will help with viewing, correcting or deleting a child's information, or with anything on the site that worries you.
        </p>
      </section>
    </div>
  );
}
