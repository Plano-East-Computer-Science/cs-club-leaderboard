/**
 * G5: the privacy page, in plain language. Keep it true: when a feature starts
 * storing something new, this page changes in the same commit.
 */
import { Link } from 'react-router-dom';
import { useData } from '../lib/data.jsx';

export default function Privacy() {
  const { settings } = useData();
  const mail = settings.email;
  return (
    <div className="legal mx-auto max-w-2xl">
      <header className="mb-8">
        <p className="eyebrow">Privacy</p>
        <h1 className="display mt-2 text-[clamp(2rem,6vw,3rem)] leading-[0.95] font-extrabold">What this site keeps about you</h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--ink-soft)' }}>
          This is a student club site and many of us are under 18, so it keeps as little as it can. Here is all of it.
        </p>
      </header>

      <section>
        <h2>What we store</h2>
        <ul>
          <li><b>Your account:</b> an email address, a display name, and the date you joined. If you sign in with Google we receive only your name and email address, nothing else from your Google account.</li>
          <li><b>What you do on the site:</b> lessons and problems you have passed (including the code you wrote), meetings you checked in to, projects and ideas you posted, quests, kudos and votes, claims you made for contests, and your answers to the onboarding questions.</li>
          <li><b>Your leaderboard entry:</b> a name, an optional grade that an officer may enter (officers see it; public pages never show it), and the points you earned and why.</li>
          <li><b>If you link them:</b> a Codeforces handle and the problems it has solved.</li>
          <li><b>The weekly email list</b> is separate and needs no account: just an address you confirmed.</li>
          <li><b>Short-lived technical records:</b> counters that slow down password guessing and spam, tied to a network address and deleted within a day, and a log of which approved website a meeting gateway request went to (never the page or what you typed), kept for a week.</li>
        </ul>
      </section>

      <section>
        <h2>Why</h2>
        <p>To run the club: show standings, remember your progress, take attendance, and let officers approve points. We do not use any of it for anything else.</p>
      </section>

      <section>
        <h2>Who sees it</h2>
        <ul>
          <li><b>Everyone on the internet</b> sees your first name, your points, and the projects and ideas you chose to post. Your full name appears only if you tick "Show my full name" on your account page. Names an officer typed in by hand for the leaderboard stay as the officer typed them.</li>
          <li><b>Club members who are signed in</b> see first names in meeting rooms and the club feed.</li>
          <li><b>Officers</b> (students and the sponsor teacher) see your email address and full name so they can run the club and approve claims. Their actions are logged.</li>
          <li><b>Nobody else.</b> Your email address is never shown on a public page.</li>
        </ul>
      </section>

      <section>
        <h2>No ads, no selling, no tracking</h2>
        <p>There are no ads and no advertising or analytics trackers, and we never sell or share your information. The site is hosted on Cloudflare, sign-in emails are sent through an email delivery service, and the optional Google button loads a script from Google. Those services handle data only to do their job. AI features are not enabled; nothing you write is sent to an AI service.</p>
      </section>

      <section>
        <h2>How long</h2>
        <p>Until you delete your account. After that your data is erased within two weeks. Old sign-in links expire in 15 minutes.</p>
      </section>

      <section>
        <h2>Your controls</h2>
        <ul>
          <li><b>Download everything</b> tied to your account as a JSON file, from your <Link to="/signin">account page</Link>.</li>
          <li><b>Delete your account</b> from the same page. You are signed out at once and your name leaves every page. You choose whether your points stay on the leaderboard as "Former member" or are removed with you.</li>
          <li><b>Report</b> anything someone else posted with the report button. Officers review reports.</li>
          <li><b>Ask a person:</b> {mail ? <a href={`mailto:${mail}`}>{mail}</a> : 'email the club address on the About page'}. Parents and guardians can ask too. See <Link to="/parents">information for parents</Link>.</li>
        </ul>
      </section>
    </div>
  );
}
