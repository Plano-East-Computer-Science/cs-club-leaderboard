/**
 * The officer playbook (`next` site, Club door): how to run the club week to
 * week, grow it, and hand it on. Plain data so the page can render it and a
 * test can check it. Text uses a tiny markdown subset rendered by
 * src/next/club/Prose.jsx: paragraphs, **bold**, `code`, "- " lists, and
 * "> " for a template block that gets a Copy button.
 *
 * Kept free of dates that go stale: competitions are given by month with a
 * link to the official page, which is where the exact date always lives.
 */

export const CHAPTERS = [
  {
    id: 'rhythm',
    title: 'The weekly rhythm',
    line: 'Four small jobs, four days. A meeting that is planned on Monday runs itself on Wednesday.',
    body: `The club meets Wednesdays after school for an hour. Everything below fits around that.

- **Monday: plan.** Pick the format from the meeting kits on this page, open the kit builder, and send the plan to HQ. Assign the host, the floater and anyone giving a demo. Ten minutes.
- **Tuesday: announce.** Post the announcement text from the kit on Instagram, Google Classroom and Discord. Ask one CS teacher to read it aloud in class. Teachers reading it out loud beats any post.
- **Wednesday: run.** Arrive 15 minutes early. Open the room from HQ so the agenda, the timer and the check-in code are ready. Put the code on the board. During the meeting the host only reads the next line of the script.
- **Thursday: recap.** Post a three-line recap with one photo: what we did, who won or showed, what is next week. Ending the room on the site already paid attendance points, so the recap is only for people.

If one week slips, do the Wednesday anyway. A short meeting that happens beats a great one that is cancelled.`,
  },
  {
    id: 'roles',
    title: 'Who does what',
    line: 'Five roles, one name each. Shared jobs are jobs nobody does.',
    body: `- **President.** Owns the semester plan and the relationship with the sponsor teacher. Hosts when nobody else can.
- **Programs lead.** Picks every meeting's format and prepares its content: problem sets, lab tiers, concept checks. Solves every problem before the meeting.
- **Outreach lead.** Announcements, flyers, Instagram, speaker invites, teacher relationships. Measures who came and who stopped coming (HQ Members shows "drifting" members).
- **Competitions lead.** Keeps the competition calendar, runs sign-ups for USACO, UIL, ACSL and the Congressional App Challenge, and plans the mock contests before each one.
- **Tech lead.** The site, the projector, the room. Tests the call on speaker nights.

Every meeting also needs a **host** (runs the clock) and a **floater** (walks the room). Rotate the host among officers and, by spring, among members: hosting once is how a member becomes next year's officer.`,
  },
  {
    id: 'grow',
    title: 'Getting people to come back',
    line: 'Attendance falls when meetings feel optional and samey. Fix both.',
    body: `The club went from about 20 people to 5 to 10. That is normal in the first month of any club; what brings people back is specific.

- **Same time, same room, every week.** Never move it unless you must. People come out of habit, not out of reading announcements.
- **Something only happens if you are there.** Duels, live reveals, speakers, game night. A meeting that is "work on the lesson on your laptop" can be done at home, so people do it at home, or not at all.
- **Rotate formats.** HQ warns when the last three meetings were the same kind. Duel, build, teach-in, speaker, repeat.
- **Make newcomers win in the first 20 minutes.** Pair them with an experienced member and give them a problem they will solve.
- **Ask people by name.** A direct "are you coming Wednesday? I need you for the duel" message works far better than any post. The outreach lead should send five of these a week to drifting members.
- **Bring-a-friend weeks.** Once a month, anyone who brings a friend who checks in gets bonus points.
- **Food.** Even cheap snacks. Ask the sponsor teacher about a small budget, or rotate who brings them.
- **Teachers.** The AP CSA and CS Principles teachers can mention the club, offer extra credit for competitions, or send their strongest students. Visit them in the first week of each semester.
- **Show progress.** The standings, the gallery and the recap make the club look like it is going somewhere, which is why people stay.`,
  },
  {
    id: 'year',
    title: 'The year at a glance',
    line: 'Build the semester around the competitions; everything else fills the gaps.',
    body: `Months are typical; always check the official page for this year's dates before you announce one.

- **August to September.** Recruit: two first-meeting kits in the first month, flyers, teacher visits. Start the Congressional App Challenge teams (submissions usually close in the fall: congressionalappchallenge.us).
- **October.** CyberPatriot rounds begin (uscyberpatriot.org). A CTF night. A teach-in on the first USACO Bronze ideas.
- **November.** Mock contest. Hack sprint kickoff.
- **December.** First USACO contest of the season (usaco.org). Demo day before winter break.
- **January to February.** More USACO contests. UIL Computer Science practice: the written test and the programming round, with mock contests every other week (uiltexas.org/academics/stem-events/computer-science).
- **March.** USACO US Open. picoCTF (picoctf.org) usually runs in spring. UIL district.
- **April.** UIL regional and state for teams that advance. A speaker night with seniors talking about college decisions.
- **May.** Final demo day, awards, officer elections, and the handoff (see below).

ACSL contests (acsl.org) run in rounds across the year if the club registers; the competitions lead decides each August.`,
  },
  {
    id: 'site',
    title: 'Running a meeting with the site',
    line: 'The site does the bookkeeping so officers can do the people part.',
    body: `- **Before:** plan the meeting in HQ (or send it from a kit on this page). The plan carries everything: the duel pack, the lab tiers, the speaker's questions, the concept checks.
- **Open the room** from HQ, Meetings. A four-letter code appears. Put it on the board.
- **Projector:** open the room's screen view on the classroom computer. It shows the code, the current block, the timer, the duel board or the question queue.
- **Your phone:** the moderator view lets the host advance blocks and moderate questions without touching the projector computer.
- **Members** check in with the code on their laptop or phone. The Live pill at the top of the site takes them straight to the room.
- **End the room** when you finish. Everyone who checked in is paid attendance points, with a bonus for anyone who did something in the room. Rooms left open are closed and paid automatically after eight hours.
- **School wifi blocks a site you need?** The room's gateway lets checked-in members reach GitHub and approved docs during the meeting only.`,
  },
  {
    id: 'trouble',
    title: 'When something goes wrong',
    line: 'It will. Each of these has happened to a club like ours.',
    body: `- **Nobody shows up.** Run it anyway for whoever is there, and spend the last ten minutes asking them why the others did not come. Then fix that, not the content.
- **The projector or wifi dies.** Every format has a paper version: duels become whiteboard races, a build lab becomes pair design on paper. Keep a printout of this week's problems in the officer folder.
- **The speaker cancels.** Turn it into a game night on the spot. Reschedule the speaker the same day.
- **The problem set is empty or broken.** Never again: attach the set in the plan days before and open the room ten minutes early to check that it loads.
- **One student dominates.** Give them a job: judge, floater, or the person who explains the solution.
- **An officer is missing.** The kit's script is written so anyone can host from it. Hand them the phone with the moderator view.`,
  },
  {
    id: 'templates',
    title: 'Messages you can copy',
    line: 'Edit the brackets, then send.',
    body: `**Speaker invite** (send a month ahead):

> Hi [name], I'm [your name], [role] of the Computer Science Club at Plano East Senior High in Plano, Texas. We meet Wednesdays after school, and once a month a working engineer joins us for 20 minutes over Zoom to talk about their job, then answers students' questions. Would you be willing to join us on [date option 1], [date option 2] or [date option 3], at 4:30 PM Central? It's about 45 minutes in total, and we'll send the questions ahead of time. Thank you for considering it.

**Teacher request** (in person is better; this is the follow-up):

> Hi [teacher], thanks for talking with me. Here is the short version to read in class if you're willing: "The CS Club meets Wednesdays at 4:30 in [room]. This week is [format]. No experience needed, bring a laptop if you have one." The site is next.peshcompsci.org. Thank you.

**Instagram caption:**

> This Wednesday at 4:30: [format]. [One sentence about what happens]. No experience needed. Link in bio.

**Recap:**

> This week: [what we did]. Shout-out to [name] for [thing]. Next Wednesday: [format]. Points from this week are on the standings.

**Sponsor or fundraising ask** (local businesses, parents' employers with matching programs):

> Hi [name], the Plano East CS Club is a student-run club of about [number] students who meet weekly to practise programming, compete in contests like USACO and UIL, and build projects. We're looking for [amount] to cover [snacks for a semester / competition fees / a demo day]. In return we'd thank [company] on our site and at our demo day. Would you be open to it?`,
  },
  {
    id: 'handoff',
    title: 'Handing the club on',
    line: 'A club that only works while you are here is not finished.',
    body: `- **From January,** have juniors and sophomores host meetings. By April every future officer should have hosted twice.
- **Officer applications** open on the site in April (Me, Officer application). Elections at the May demo day.
- **The year archive** in HQ Season freezes this year's standings, projects and recaps so next year starts clean without losing history.
- **Write down what worked.** Before the last meeting, each officer adds three lines to this playbook (ask the tech lead): what to keep, what to drop, one thing they wish they had known.`,
  },
];

export const chapterById = (id) => CHAPTERS.find((c) => c.id === id) ?? null;
