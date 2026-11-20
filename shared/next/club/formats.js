/**
 * Meeting formats for the Club door (`next` site): what each kind of meeting is,
 * a 60-minute run of show, the prep timeline, roles, the script officers say,
 * what goes wrong, and the announcement text. Shared by the public Meetings
 * page, the Playbook, and the meeting kit builder, which turns a format and a
 * date into a dated checklist and, for officers, a plan in HQ.
 *
 * A format: {
 *   id, name, line,                one-sentence pitch shown to members
 *   bestFor,                       when to pick it
 *   template,                      the HQ template it is planned on (shared/session-templates.js)
 *   blocks: [{ type, title, minutes, screen, notes?, duel? }]   sums to 60
 *   prep: [{ days, task }],        days before the meeting (0 = the day of, -1 = after)
 *   roles: [{ role, job }],
 *   script: [{ at, say }],         minute mark and the line an officer says
 *   pitfalls: [{ problem, fix }],
 *   bring,                         what members bring
 *   success,                       how you know it worked
 *   announce,                      text with {date}, {time}, {place} placeholders
 * }
 * Pure data and helpers: no DOM, safe in the worker and the browser.
 */

const B = (type, title, minutes, screen, extra = {}) => ({ type, title, minutes, screen, ...extra });

export const FORMATS = [
  {
    id: 'kickoff',
    name: 'First meeting',
    line: 'Meet the club, pick a track, and solve one problem with a partner before you leave.',
    bestFor: 'The first meeting of a semester, or after a long break. Run it twice in the first month.',
    template: 'build',
    blocks: [
      B('poll', 'Check in and warm-up poll', 5, 'Sign in on the site, then answer: what do you want to make this year?'),
      B('hook', 'What this club does', 8, 'Five things you can do here, in five minutes.', { notes: 'One slide per door: Play, Learn, Future, Club, Me. Show a real project a member made.' }),
      B('lab', 'First problem in pairs', 25, 'Pair with someone you have not met. Solve the first rung of any track.', { notes: 'Pair beginners with experienced members on purpose. Walk the room.' }),
      B('show', 'Two pairs show', 7, 'Two pairs show how they solved it, 60 seconds each.'),
      B('teach', 'How the year works', 10, 'Meetings, standings, the prize, competitions this semester.', { notes: 'Dates for USACO, UIL, the first hack sprint. Keep it to three dates.' }),
      B('close', 'Close', 5, 'Play today\'s daily game before you go. Next week: duel night.'),
    ],
    prep: [
      { days: 14, task: 'Book the room and confirm the sponsor teacher can stay until the end.' },
      { days: 10, task: 'Ask two returning members to each bring one project they can show in 60 seconds.' },
      { days: 7, task: 'Post the announcement on Instagram, Classroom and Discord. Ask the CS teachers to read it in class.' },
      { days: 3, task: 'Put flyers with the QR code to the site by the CS classrooms and the library.' },
      { days: 1, task: 'Plan the meeting in HQ from this kit, so the room opens with the agenda loaded.' },
      { days: 1, task: 'Buy snacks. Food is the single cheapest way to double a first meeting.' },
      { days: 0, task: 'Arrive 15 minutes early: projector, wifi, the room code on the board.' },
      { days: -1, task: 'Post the recap with photos and next week\'s format within 24 hours.' },
    ],
    roles: [
      { role: 'Host', job: 'Runs the clock and the projector, says every block transition.' },
      { role: 'Greeter', job: 'Stands at the door, helps people sign in, pairs newcomers.' },
      { role: 'Floater', job: 'Walks the room during the lab and unsticks pairs.' },
    ],
    script: [
      { at: 0, say: 'Grab a seat next to someone. Open the site and sign in, the code is on the board.' },
      { at: 5, say: 'Here is everything you can do here. You do not need to know any code to start.' },
      { at: 13, say: 'Find someone you have not met. Pick any track, solve the first rung together. Raise a hand if you are stuck.' },
      { at: 38, say: 'Two pairs, show us what you did. Sixty seconds, no slides.' },
      { at: 45, say: 'Three dates for this semester, then we are done.' },
      { at: 55, say: 'Same time next week, it is duel night. Bring a friend.' },
    ],
    pitfalls: [
      { problem: 'Half the room has never coded and the other half is bored.', fix: 'Pair across levels and give the experienced member the job of explaining.' },
      { problem: 'Sign-in eats ten minutes.', fix: 'Put the room code and a big QR code on the board before anyone arrives.' },
      { problem: 'Officers talk for 25 minutes.', fix: 'Hard cap: 8 minutes of talking before the first problem.' },
    ],
    bring: 'A laptop or a phone. No experience needed.',
    success: 'At least half of the newcomers solve one problem and come back the next week.',
    announce:
      'First CS Club meeting of the semester: {date}, {time}{place}. Meet the club, pick a track, and solve your first problem with a partner. No experience needed. Snacks provided.',
  },
  {
    id: 'duel',
    name: 'Duel night',
    line: 'Head-to-head coding races by division, with a spotlight on a winning solution after every round.',
    bestFor: 'The meeting after a teach-in, or any week the room needs energy. Do not run it three weeks in a row.',
    template: 'duel',
    blocks: [
      B('poll', 'Check in and pick a division', 5, 'Check in and choose Starter, Regular or Pro.'),
      B('hook', 'Warm-up problem', 7, 'Everyone solves the warm-up. It is not scored.', { notes: 'Use it to check that everyone\'s editor runs Java.' }),
      B('duel', 'Three rounds', 36, 'Rounds of 9 minutes, a 3-minute spotlight after each.', { notes: 'Spotlight one solver after each round, not always the fastest.', duel: { minutes: 9, rounds: 3, spotlight: true } }),
      B('show', 'Fastest clean solution', 7, 'The top solver of the last round walks us through it.'),
      B('close', 'Close', 5, 'Standings are updated. Next week: a build lab.'),
    ],
    prep: [
      { days: 7, task: 'Pick a duel pack in HQ Library. Check every problem has a Java and a Python solution.' },
      { days: 3, task: 'Post the announcement. Say the divisions out loud: nobody wants to lose to a senior on day one.' },
      { days: 1, task: 'Solve the pack yourself and time it. Cut any problem that took you more than 6 minutes for a 9-minute round.' },
      { days: 1, task: 'Plan the meeting in HQ with the pack attached.' },
      { days: 0, task: 'Open the room 10 minutes early and test the projector board.' },
      { days: -1, task: 'Post the top three per division and one spotlight solution in the recap.' },
    ],
    roles: [
      { role: 'Host', job: 'Starts each round from the host console and runs the spotlight.' },
      { role: 'Judge', job: 'Answers "is my output format right?" questions without giving hints.' },
      { role: 'Floater', job: 'Helps anyone whose editor will not run before round one.' },
    ],
    script: [
      { at: 0, say: 'Check in and pick your division honestly. Starter is for anyone in their first year of code.' },
      { at: 5, say: 'Warm-up first, it does not count. Make sure Run works for you.' },
      { at: 12, say: 'Round one, nine minutes, go.' },
      { at: 21, say: 'Time. Spotlight: show us how you did it in under a minute.' },
      { at: 55, say: 'Standings are live on the site. Next week we build.' },
    ],
    pitfalls: [
      { problem: 'The same three people win every round.', fix: 'Divisions, and spotlight the cleanest solution rather than the fastest.' },
      { problem: 'An empty problem bank on the night.', fix: 'Attach the pack in the plan days before, and open the room early to check it loads.' },
      { problem: 'Problems are too hard and the room goes silent.', fix: 'First problem of each round should be solvable by a Starter in 5 minutes.' },
    ],
    bring: 'A laptop. Java or Python both work.',
    success: 'Every division has at least one solve per round, and nobody leaves with zero.',
    announce: 'Duel night: {date}, {time}{place}. Timed coding races in three divisions, so you race people at your level. Points count toward the season standings.',
  },
  {
    id: 'speaker',
    name: 'Speaker night',
    line: 'A working engineer joins over Zoom for a short talk and a long, real question queue.',
    bestFor: 'Once a month. Alumni in college are the easiest yes; parents who work in tech are the second.',
    template: 'speaker',
    blocks: [
      B('poll', 'Check in, drop a question', 5, 'Check in and add one question for tonight\'s speaker.'),
      B('hook', 'Who is joining us', 3, 'Who the speaker is and why we asked them.'),
      B('speaker', 'Talk', 20, 'Questions go in the queue on your laptop. Upvote the ones you want asked.', { speaker: { projector: 'zoom' } }),
      B('speaker', 'Questions', 22, 'The moderator asks the most upvoted questions.'),
      B('close', 'Thank the speaker', 10, 'Write one thing you learned. Next week: duel night.'),
    ],
    prep: [
      { days: 30, task: 'Send the speaker invite (template in the Playbook). Offer three dates.' },
      { days: 14, task: 'Confirm the date, the Zoom or Meet link, and a 20-minute talk length. Ask for a photo and a one-line title.' },
      { days: 7, task: 'Post the announcement with the speaker\'s name and title. Open the early question box.' },
      { days: 2, task: 'Test the call on the room projector with the sponsor teacher. Check the audio, not just the video.' },
      { days: 1, task: 'Send the speaker a reminder with the link, the time in their time zone, and three questions students already asked.' },
      { days: 0, task: 'Join the call 15 minutes early. Have a backup phone hotspot.' },
      { days: -1, task: 'Send a thank-you email within a day, with two or three things students said they learned.' },
    ],
    roles: [
      { role: 'Host', job: 'Introduces the speaker and keeps time.' },
      { role: 'Moderator', job: 'Reads the top questions from the phone moderator view, skips repeats.' },
      { role: 'Tech', job: 'Owns the call, the audio and the projector. Only job tonight.' },
    ],
    script: [
      { at: 0, say: 'Check in and put one question in the box before the speaker joins.' },
      { at: 5, say: 'Tonight\'s speaker works on [what they do]. We asked them because [reason].' },
      { at: 28, say: 'Questions now. The ones with the most votes go first.' },
      { at: 50, say: 'Please thank our speaker. Before you leave, write one thing you learned.' },
    ],
    pitfalls: [
      { problem: 'The talk runs 40 minutes and nobody gets to ask anything.', fix: 'Ask for 20 minutes in writing, and have the host say "five minutes left" in the chat.' },
      { problem: 'Nobody asks the first question.', fix: 'Seed three questions in the plan; the moderator asks one to open.' },
      { problem: 'The audio is unusable.', fix: 'Test with the real room speakers two days before. Bring a cheap USB speaker.' },
    ],
    bring: 'Questions. Anything about their job, college, or how they got started.',
    success: 'Ten or more questions asked, and at least one student emails the speaker afterward.',
    announce: 'Speaker night: {date}, {time}{place}. A working engineer joins live to talk about their job and answer your questions. Send yours in early on the site.',
  },
  {
    id: 'build',
    name: 'Build lab',
    line: 'Make something real in pairs, with three difficulty tiers so nobody is lost or bored.',
    bestFor: 'The steady default. Alternate it with duel and teach-in weeks.',
    template: 'build',
    blocks: [
      B('poll', 'Check in and find a partner', 5, 'Check in, sit with your partner, answer the poll.'),
      B('hook', 'Last week\'s best', 5, 'A member shows what they built.', { notes: 'Ask them two days before. Have a backup.' }),
      B('lab', 'Build in pairs', 35, 'One types, one thinks. Swap every 10 minutes.'),
      B('show', 'Show', 10, 'Three or four pairs, 60 seconds each.'),
      B('close', 'Close', 5, 'Keep building at home. Next week: a teach-in.'),
    ],
    prep: [
      { days: 7, task: 'Pick the three lab tiers (Guided, Build, Stretch). Build the Stretch one yourself first.' },
      { days: 3, task: 'Post the announcement with a screenshot of what you can build tonight.' },
      { days: 2, task: 'Ask one member to show last week\'s project.' },
      { days: 1, task: 'Plan the meeting in HQ with the tiers attached.' },
      { days: -1, task: 'Post the best two projects in the recap and the gallery.' },
    ],
    roles: [
      { role: 'Host', job: 'Runs the timer and calls the role swaps.' },
      { role: 'Floaters (two)', job: 'One for the Guided tier, one for everyone else.' },
    ],
    script: [
      { at: 0, say: 'Find your partner. One laptop per pair: one types, one thinks.' },
      { at: 10, say: 'Three tiers on your screen. Start where you are comfortable, move up when you finish.' },
      { at: 20, say: 'Swap who types.' },
      { at: 45, say: 'Hands off keyboards. Who wants to show?' },
    ],
    pitfalls: [
      { problem: 'Pairs where one person does everything.', fix: 'Call the swap out loud every 10 minutes.' },
      { problem: 'Nobody volunteers to show.', fix: 'Ask two pairs during the lab, before show time.' },
    ],
    bring: 'A laptop. Pairs share one.',
    success: 'Every pair finishes at least the Guided tier; three pairs show.',
    announce: 'Build lab: {date}, {time}{place}. Build something real with a partner. Three levels, so beginners and experts both have something to do.',
  },
  {
    id: 'teach',
    name: 'Teach-in',
    line: 'Twenty minutes on one idea, with live concept checks, then practice that uses it.',
    bestFor: 'Before a competition, or when the standings show the room is stuck on one topic.',
    template: 'build',
    blocks: [
      B('poll', 'Check in and warm-up question', 5, 'Check in and answer the warm-up question.'),
      B('teach', 'The idea', 20, 'Vote, talk to your neighbour, vote again.', { notes: 'One idea only. Three concept checks spaced through the talk.' }),
      B('lab', 'Practice', 25, 'Three problems that use tonight\'s idea, easiest first.'),
      B('show', 'One solution, two ways', 5, 'Two members show different solutions to the same problem.'),
      B('close', 'Close', 5, 'The matching Learn lesson is linked on the site.'),
    ],
    prep: [
      { days: 7, task: 'Pick one idea (for example: two pointers, recursion, ArrayList traps). One.' },
      { days: 5, task: 'Write three concept-check questions where a wrong answer is tempting.' },
      { days: 3, task: 'Pick three practice problems, easiest first, and solve them.' },
      { days: 1, task: 'Plan the meeting in HQ with the checks in the teach block.' },
      { days: -1, task: 'Post the slides and the matching lesson link in the recap.' },
    ],
    roles: [
      { role: 'Teacher', job: 'Gives the 20 minutes. Practise it once out loud.' },
      { role: 'Host', job: 'Runs the votes and the timer.' },
      { role: 'Floater', job: 'Helps during practice.' },
    ],
    script: [
      { at: 5, say: 'Tonight is one idea. By the end you will use it to solve a problem you could not solve before.' },
      { at: 10, say: 'Vote first, no talking. Now talk to your neighbour for one minute. Vote again.' },
      { at: 25, say: 'Three problems on your screen. Start with the first.' },
    ],
    pitfalls: [
      { problem: 'The teach block turns into a 40-minute lecture.', fix: 'Twenty minutes, hard stop, three checks.' },
      { problem: 'The concept checks are too easy.', fix: 'Write each wrong option from a mistake you have actually made.' },
    ],
    bring: 'A laptop.',
    success: 'The second vote on each check is clearly better than the first.',
    announce: 'Teach-in: {date}, {time}{place}. One idea in 20 minutes, then problems that use it. Good prep for USACO and UIL.',
  },
  {
    id: 'contest',
    name: 'Mock contest',
    line: 'Teams of three, a real problem set, a scoreboard that freezes for the last ten minutes, then the reveal.',
    bestFor: 'Two to three weeks before UIL, ACSL or a USACO contest window.',
    template: 'mock',
    blocks: [
      B('poll', 'Check in and form teams', 5, 'Check in. Teams of three: one strong, one middle, one new.'),
      B('contest', 'Contest', 45, 'Any teammate can submit. The board freezes for the last ten minutes.', { contest: { freeze: 10, penalty: 20 } }),
      B('show', 'The reveal', 7, 'Unfreezing the board from the bottom up.'),
      B('close', 'Close', 3, 'Solutions are posted on the site tonight.'),
    ],
    prep: [
      { days: 14, task: 'Pick a problem set that matches the real contest\'s format.' },
      { days: 7, task: 'Post the announcement and ask people to pre-form teams.' },
      { days: 2, task: 'Solve every problem. Write a one-paragraph editorial for each.' },
      { days: 1, task: 'Plan the meeting in HQ. Pre-make teams for anyone who did not form one.' },
      { days: -1, task: 'Post solutions, editorials and the final board.' },
    ],
    roles: [
      { role: 'Host', job: 'Runs the board and the reveal.' },
      { role: 'Judge', job: 'Answers clarification questions publicly, for every team at once.' },
    ],
    script: [
      { at: 0, say: 'Teams of three. If you do not have one, come to the front.' },
      { at: 5, say: 'Forty-five minutes. The board freezes at 35. Go.' },
      { at: 50, say: 'Time. Now we unfreeze from the bottom.' },
    ],
    pitfalls: [
      { problem: 'One team of three seniors wins by an hour.', fix: 'Build balanced teams yourself.' },
      { problem: 'Teams fight over one keyboard.', fix: 'Say it at the start: plan on paper, one person types at a time.' },
    ],
    bring: 'A laptop per team at least, scratch paper.',
    success: 'Every team solves at least one problem; the reveal gets a reaction.',
    announce: 'Mock contest: {date}, {time}{place}. Teams of three, a real problem set, a frozen scoreboard and a live reveal. Practice for UIL and USACO.',
  },
  {
    id: 'ctf',
    name: 'CTF night',
    line: 'Capture-the-flag security puzzles in teams: decode, inspect, crack, submit the flag.',
    bestFor: 'A change of pace once a semester, and before picoCTF or CyberPatriot.',
    template: 'build',
    blocks: [
      B('poll', 'Check in and team up', 5, 'Check in and form teams of two or three.'),
      B('teach', 'Five tools in five minutes', 7, 'Base64, browser dev tools, strings, Caesar, view source.'),
      B('lab', 'Capture flags', 38, 'Solve challenges on the CTF board. Flags look like flag{...}.'),
      B('show', 'Write-ups', 7, 'Two teams explain their favourite solve.'),
      B('close', 'Close', 3, 'The CTF board stays open all week.'),
    ],
    prep: [
      { days: 7, task: 'Check the CTF board has easy challenges in every category.' },
      { days: 3, task: 'Post the announcement. Say no experience is needed.' },
      { days: 1, task: 'Plan the meeting in HQ.' },
    ],
    roles: [
      { role: 'Host', job: 'Runs the five-minute tool tour.' },
      { role: 'Floater', job: 'Gives nudges, never flags.' },
    ],
    script: [
      { at: 5, say: 'Five tools that solve half of every beginner CTF. Watch.' },
      { at: 12, say: 'The board is open. Easy ones first.' },
    ],
    pitfalls: [{ problem: 'Teams get stuck on one challenge for 30 minutes.', fix: 'Rule: stuck for 10 minutes, skip and come back.' }],
    bring: 'A laptop.',
    success: 'Every team captures at least three flags.',
    announce: 'CTF night: {date}, {time}{place}. Security puzzles in teams: decode messages, inspect websites, find the hidden flag. No experience needed.',
  },
  {
    id: 'demo',
    name: 'Demo day',
    line: 'Members show what they built this cycle; everyone votes; the best projects go in the gallery.',
    bestFor: 'The end of a hack sprint or the end of a semester. Invite parents and teachers.',
    template: 'demo',
    blocks: [
      B('poll', 'Check in', 5, 'Check in and get your voting ballot on the site.'),
      B('show', 'Demos, round one', 22, 'Three minutes each: what it does, a live demo, what was hard.'),
      B('break', 'Break', 5, 'Snacks. Try the projects on the demo laptops.'),
      B('show', 'Demos, round two', 18, 'Three minutes each.'),
      B('close', 'Votes and awards', 10, 'Most useful, best built, best first project.'),
    ],
    prep: [
      { days: 21, task: 'Announce the date at the start of the cycle so people build toward it.' },
      { days: 7, task: 'Collect the demo list. Cap it at about 12 teams.' },
      { days: 3, task: 'Invite the CS teachers, the principal and parents.' },
      { days: 1, task: 'Run order, a timer on the projector, the voting categories in HQ.' },
      { days: -1, task: 'Add every project to the gallery and post winners.' },
    ],
    roles: [
      { role: 'Host', job: 'Introduces each team and runs the 3-minute timer strictly.' },
      { role: 'Tech', job: 'Switches laptops on the projector between demos.' },
    ],
    script: [
      { at: 5, say: 'Three minutes each. When the timer hits zero, we clap and the next team comes up.' },
      { at: 50, say: 'Votes are in. Three awards.' },
    ],
    pitfalls: [
      { problem: 'Demos do not run on the projector.', fix: 'Test every demo on the projector laptop the day before, or use a screen recording.' },
      { problem: 'Running long.', fix: 'Strict timer, visible to the presenter.' },
    ],
    bring: 'Your project, or come to watch and vote.',
    success: 'Every project gets applause and at least one gets a teacher\'s attention.',
    announce: 'Demo day: {date}, {time}{place}. See what members built this cycle and vote for the best. Parents and teachers welcome.',
  },
  {
    id: 'sprint',
    name: 'Hack sprint kickoff',
    line: 'Form teams, pick an idea, and ship a first version in two weeks.',
    bestFor: 'The start of a build cycle, three weeks before a demo day.',
    template: 'build',
    blocks: [
      B('poll', 'Check in and vote on themes', 5, 'Vote for this sprint\'s theme.'),
      B('hook', 'Three projects that started here', 5, 'What a two-week project can look like.'),
      B('lab', 'Pitch and team up', 15, 'Anyone with an idea pitches in 30 seconds. Join a team of two to four.'),
      B('lab', 'Plan and start', 30, 'Write the one-sentence goal, the first screen, who does what. Start building.'),
      B('close', 'Close', 5, 'Demo day is in two weeks. Post progress in the team channel.'),
    ],
    prep: [
      { days: 7, task: 'Pick three themes for the vote (for example: tools for Plano East, games, AI helpers).' },
      { days: 3, task: 'Post the announcement and ask people to bring ideas.' },
      { days: 1, task: 'Set up the ship cycle in HQ with the demo date.' },
    ],
    roles: [
      { role: 'Host', job: 'Runs the pitches and the team-up.' },
      { role: 'Mentors', job: 'Each experienced member joins a team as an advisor, not a doer.' },
    ],
    script: [{ at: 10, say: 'Thirty seconds each. Say the problem, not the tech.' }],
    pitfalls: [{ problem: 'Projects too big to finish.', fix: 'The goal must fit one sentence and one screen.' }],
    bring: 'An idea, or a willingness to join one.',
    success: 'Every team leaves with a written goal and a first commit.',
    announce: 'Hack sprint kickoff: {date}, {time}{place}. Pitch an idea or join a team, then build it in two weeks. Demo day at the end.',
  },
  {
    id: 'play',
    name: 'Game night',
    line: 'The daily games on the projector, in teams, plus a code-golf round. Low stakes, high noise.',
    bestFor: 'The week before a break, or to bring back members who drifted away.',
    template: 'build',
    blocks: [
      B('poll', 'Check in and form teams', 5, 'Check in, teams of four.'),
      B('hook', 'Word round', 10, 'Today\'s word puzzle on the projector, teams shout guesses.'),
      B('lab', 'Output prediction relay', 15, 'Each team member predicts one output in turn.'),
      B('lab', 'Code golf', 20, 'Shortest working solution wins. Characters are counted live.'),
      B('close', 'Winners and close', 10, 'Team with the most points picks next week\'s snack.'),
    ],
    prep: [
      { days: 3, task: 'Pick a golf problem with a clear checker. Solve it yourself in as few characters as you can.' },
      { days: 1, task: 'Plan the meeting in HQ.' },
    ],
    roles: [{ role: 'Host', job: 'Game-show host. Be loud.' }],
    script: [{ at: 0, say: 'Teams of four. Name your team something you would not say to a teacher. Actually, do not.' }],
    pitfalls: [{ problem: 'One team runs away with it.', fix: 'Last round worth double.' }],
    bring: 'Just yourself.',
    success: 'Noise, and people who had stopped coming come back.',
    announce: 'Game night: {date}, {time}{place}. Coding games in teams on the big screen. Low stakes, bring a friend.',
  },
];

export const formatById = (id) => FORMATS.find((f) => f.id === id) ?? null;

/** Minutes a format's blocks add up to. */
export const formatMinutes = (f) => f.blocks.reduce((n, b) => n + b.minutes, 0);

/** The date n days before YYYY-MM-DD (negative n is after), in plain calendar arithmetic. */
export function daysBefore(date, n) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * The prep timeline for a meeting on `date`: each task with its due date,
 * sorted by due date. `days` counts back from the meeting; -1 is the day after.
 */
export function prepSchedule(format, date) {
  return format.prep
    .map((p) => ({ ...p, due: daysBefore(date, p.days) }))
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0));
}

/** The announcement with the date, time and place filled in. */
export function announcement(format, { date, time = '', place = '' }) {
  const when = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
  return format.announce
    .replace('{date}', when)
    .replace('{time}', time || 'after school')
    .replace('{place}', place ? ` in ${place}` : '');
}

/** Clock times for each block, from a start like "4:30 PM". */
export function blockClock(format, start = '4:30 PM') {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(start.trim());
  let t = m ? ((Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(m[2]) : 16 * 60 + 30;
  const fmt = (x) => {
    const h = Math.floor(x / 60) % 24;
    return `${((h + 11) % 12) + 1}:${String(x % 60).padStart(2, '0')}`;
  };
  return format.blocks.map((b) => {
    const at = fmt(t);
    t += b.minutes;
    return { ...b, at };
  });
}
