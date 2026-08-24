/**
 * First-run seed data.
 *
 * Pure data, no database code -- scripts/build-seed-sql.mjs turns this into
 * worker/seed.sql, which is loaded into D1 once when the site is first set up.
 *
 * Deadlines are deliberately left blank where they move year to year. An empty
 * deadline shows as "Rolling / varies" rather than displaying a date that has
 * quietly gone stale. Set real dates from the admin panel each season.
 */
import { milesFromSchool } from '../worker/geo.js';

export const BADGES = [
  { name: 'Hackathon Winner', emoji: '🏆', description: 'Placed at a hackathon', color: 'amber' },
  { name: 'CTF Champ', emoji: '🛡️', description: 'Top finish in a capture-the-flag event', color: 'emerald' },
  { name: 'Open Sourcerer', emoji: '🧙', description: 'Merged a pull request into a real open-source project', color: 'violet' },
  { name: 'Mentor', emoji: '🤝', description: 'Taught or tutored other club members', color: 'sky' },
  { name: 'Competitive Programmer', emoji: '⚡', description: 'Competed in USACO, ACSL, or Codeforces', color: 'rose' },
  { name: 'Shipped It', emoji: '🚀', description: 'Launched a project other people actually use', color: 'orange' },
  { name: 'Perfect Attendance', emoji: '📅', description: 'Attended every meeting this semester', color: 'teal' },
  { name: 'Founder', emoji: '🌱', description: 'Founding member of the club', color: 'lime' },
];

// Demo roster so the leaderboard is not empty on day one.
// Delete these from the admin panel once real members are added.
export const DEMO_STUDENTS = [
  { name: 'Ava Chen', grade: 12, events: [[60, 'Won district hackathon'], [25, 'Led intro-to-Python workshop'], [20, 'USACO Silver promotion'], [15, 'Meeting attendance']], badges: ['Hackathon Winner', 'Mentor', 'Competitive Programmer'] },
  { name: 'Marcus Webb', grade: 11, events: [[50, 'picoCTF top 5% finish'], [30, 'Built club website'], [15, 'Meeting attendance'], [10, 'Brought a guest speaker']], badges: ['CTF Champ', 'Shipped It'] },
  { name: 'Priya Raman', grade: 12, events: [[40, 'Congressional App Challenge submission'], [25, 'Merged PR into open source'], [20, 'Mentored two freshmen'], [10, 'Meeting attendance']], badges: ['Open Sourcerer', 'Mentor'] },
  { name: 'Diego Alvarez', grade: 10, events: [[35, 'Second place, Collin College coding contest'], [20, 'Robotics build team'], [15, 'Meeting attendance']], badges: ['Competitive Programmer'] },
  { name: 'Sofia Nguyen', grade: 11, events: [[30, 'Ran the club Discord bot project'], [20, 'Science fair qualifier'], [12, 'Meeting attendance']], badges: ['Shipped It'] },
  { name: 'Jalen Brooks', grade: 9, events: [[25, 'Completed CS50x problem set 5'], [15, 'Meeting attendance'], [10, 'Helped set up club fair booth']], badges: ['Perfect Attendance'] },
  { name: 'Hana Kim', grade: 10, events: [[22, 'Technovation team submission'], [18, 'Meeting attendance']], badges: [] },
  { name: 'Omar Haddad', grade: 12, events: [[20, 'Taught Git workshop'], [15, 'Meeting attendance']], badges: ['Mentor', 'Founder'] },
  { name: 'Grace Miller', grade: 9, events: [[18, 'First project demo'], [10, 'Meeting attendance']], badges: [] },
  { name: 'Ethan Park', grade: 11, events: [[12, 'Meeting attendance'], [8, 'Club t-shirt design']], badges: [] },
];

/**
 * Verified opportunities. `format` drives the distance rule:
 *   local       -> student commutes; must be within 15 miles of the school
 *   online      -> fully remote, no travel
 *   residential -> national program that houses participants; no commute from Plano
 */
export const OPPORTUNITIES = [
  /* ------------------------------- LOCAL ------------------------------- */
  {
    title: 'UT Dallas Summer Programs for High School Students',
    org: 'The University of Texas at Dallas',
    description:
      'Week-long summer camps in computer science, cybersecurity, engineering, and game design on the UTD campus in Richardson. The closest major research university to Plano East.',
    url: 'https://www.utdallas.edu/k12/',
    type: 'program', cost: 'paid', format: 'local',
    location: 'UT Dallas, 800 W Campbell Rd, Richardson, TX 75080',
    lat: 32.9857, lng: -96.7501, age_min: 14, age_max: 18,
  },
  {
    title: 'Clark Summer Research Program',
    org: 'UT Dallas / Eugene McDermott Foundation',
    description:
      'Paid summer research placement for rising high school seniors, working alongside UT Dallas faculty in science and engineering labs. Highly competitive and fully funded.',
    url: 'https://www.utdallas.edu/clark/',
    type: 'internship', cost: 'stipend', format: 'local',
    location: 'UT Dallas, 800 W Campbell Rd, Richardson, TX 75080',
    lat: 32.9857, lng: -96.7501, age_min: 16, age_max: 18,
  },
  {
    title: 'Collin College Dual Credit — Computer Science',
    org: 'Collin College',
    description:
      'Take real college CS courses while still in high school and earn credit for both. The Plano campus is about two miles from Plano East. Tuition is often covered through Plano ISD.',
    url: 'https://www.collin.edu/gettingstarted/dualcredit/',
    type: 'program', cost: 'free', format: 'local',
    location: 'Collin College Plano Campus, 2800 E Spring Creek Pkwy, Plano, TX 75074',
    lat: 33.0570, lng: -96.6870, age_min: 14, age_max: 18,
  },
  {
    title: 'Collin College Youth & Summer Enrichment Camps',
    org: 'Collin College Continuing Education',
    description:
      'Short, affordable summer camps in coding, robotics, and 3D design across the Plano, Frisco, and McKinney campuses.',
    url: 'https://www.collin.edu/ce/',
    type: 'program', cost: 'paid', format: 'local',
    location: 'Collin College Frisco Campus, 9700 Wade Blvd, Frisco, TX 75035',
    lat: 33.1170, lng: -96.8100, age_min: 14, age_max: 17,
  },
  {
    title: 'Plano Public Library Makerspace & Tech Programs',
    org: 'City of Plano',
    description:
      'Free access to 3D printers, laser cutters, and electronics kits, plus free teen tech workshops. A Plano library card is all you need.',
    url: 'https://library.plano.gov/',
    type: 'resource', cost: 'free', format: 'local',
    location: 'Davis Library, 7501 Independence Pkwy, Plano, TX 75025',
    lat: 33.0570, lng: -96.7500, age_min: 14, age_max: 17,
  },
  {
    title: 'Dallas College Richland — Tech Dual Credit & Camps',
    org: 'Dallas College',
    description:
      'Dual credit pathways and short technology courses in networking, programming, and IT support at the Richland campus in north Dallas.',
    url: 'https://www.dallascollege.edu/',
    type: 'program', cost: 'free', format: 'local',
    location: 'Dallas College Richland Campus, 12800 Abrams Rd, Dallas, TX 75243',
    lat: 32.9270, lng: -96.7200, age_min: 14, age_max: 18,
  },
  {
    title: 'Allen Public Library Teen Tech Programs',
    org: 'City of Allen',
    description:
      'Free teen coding clubs, robotics nights, and maker sessions a short drive north of Plano.',
    url: 'https://www.allentx.gov/234/Library',
    type: 'resource', cost: 'free', format: 'local',
    location: 'Allen Public Library, 300 N Allen Dr, Allen, TX 75013',
    lat: 33.1030, lng: -96.6700, age_min: 14, age_max: 17,
  },

  /* ------------------------------- ONLINE ------------------------------- */
  {
    title: 'USA Computing Olympiad (USACO)',
    org: 'USACO',
    description:
      'Free online competitive programming contests four times a year. Start at Bronze and promote through Silver, Gold, and Platinum. The single best resume line in high school CS.',
    url: 'https://usaco.org/',
    type: 'competition', cost: 'free', format: 'online', age_min: 14, age_max: 18,
  },
  {
    title: 'picoCTF',
    org: 'Carnegie Mellon University',
    description:
      'Free beginner-friendly cybersecurity capture-the-flag competition, with a year-round practice gym of hundreds of challenges. No experience required.',
    url: 'https://picoctf.org/',
    type: 'competition', cost: 'free', format: 'online', age_min: 14, age_max: 18,
  },
  {
    title: 'Congressional App Challenge',
    org: 'U.S. House of Representatives',
    description:
      'Build an app and submit it in your congressional district. Plano is split across TX-03 and TX-32, and district-level fields are small, so the odds are genuinely good. Winners are recognized in Washington.',
    url: 'https://www.congressionalappchallenge.us/',
    type: 'competition', cost: 'free', format: 'online', age_min: 14, age_max: 18,
  },
  {
    title: 'MIT THINK Scholars Program',
    org: 'MIT',
    description:
      'Submit a proposal for a science or engineering project you have not built yet. Finalists get funding, mentorship from MIT students, and a trip to campus.',
    url: 'https://think.mit.edu/',
    type: 'competition', cost: 'free', format: 'online', age_min: 14, age_max: 18,
  },
  {
    title: 'CyberPatriot National Youth Cyber Defense Competition',
    org: 'Air & Space Forces Association',
    description:
      'Team-based cyber defense competition where you harden vulnerable virtual machines against attack. Great fit for a club to enter together.',
    url: 'https://www.uscyberpatriot.org/',
    type: 'competition', cost: 'free', format: 'online', age_min: 14, age_max: 18,
  },
  {
    title: 'Technovation Girls',
    org: 'Technovation',
    description:
      'Free global program where teams of girls build a mobile app or AI project addressing a community problem, supported by industry mentors.',
    url: 'https://www.technovation.org/',
    type: 'competition', cost: 'free', format: 'online', age_min: 14, age_max: 18,
  },
  {
    title: 'American Computer Science League (ACSL)',
    org: 'ACSL',
    description:
      'Short written and programming contests run in rounds throughout the school year. A low-pressure way for a club to start competing together.',
    url: 'https://www.acsl.org/',
    type: 'competition', cost: 'paid', format: 'online', age_min: 14, age_max: 18,
  },
  {
    title: 'Conrad Challenge',
    org: 'Conrad Foundation',
    description:
      'Team innovation competition where you design a product or venture around a real-world problem in areas like cyber-technology, health, and energy.',
    url: 'https://www.conradchallenge.org/',
    type: 'competition', cost: 'free', format: 'online', age_min: 13, age_max: 18,
  },
  {
    title: 'Regeneron International Science and Engineering Fair (ISEF)',
    org: 'Society for Science',
    description:
      'The largest pre-college science competition in the world. Qualify through a regional fair first — the Dallas regional fair is the local entry point.',
    url: 'https://www.societyforscience.org/isef/',
    type: 'competition', cost: 'free', format: 'online', age_min: 14, age_max: 18,
  },
  {
    title: 'NASA High School Internships (OSTEM)',
    org: 'NASA',
    description:
      'Paid NASA internships open to high school students aged 16 and up, including remote placements. Johnson Space Center in Houston also hosts Texas students.',
    url: 'https://www.nasa.gov/learning-resources/internship-programs/',
    type: 'internship', cost: 'stipend', format: 'online', age_min: 16, age_max: 18,
  },
  {
    title: 'Girls Who Code Summer Programs',
    org: 'Girls Who Code',
    description:
      'Free virtual summer programs teaching CS fundamentals, web development, and data science, with no prior experience required.',
    url: 'https://girlswhocode.com/programs',
    type: 'program', cost: 'free', format: 'online', age_min: 14, age_max: 18,
  },
  {
    title: 'Kode With Klossy',
    org: 'Kode With Klossy',
    description:
      'Free two-week coding camps for girls and gender-expansive teens, covering web development, mobile apps, and machine learning.',
    url: 'https://www.kodewithklossy.com/',
    type: 'program', cost: 'free', format: 'online', age_min: 13, age_max: 18,
  },
  {
    title: 'Hack Club',
    org: 'Hack Club',
    description:
      'A worldwide network of high school hackers. Free hardware grants, hackathons, and an extremely active Slack. Useful for running our own club better, too.',
    url: 'https://hackclub.com/',
    type: 'resource', cost: 'free', format: 'online', age_min: 14, age_max: 18,
  },
  {
    title: 'CS50x — Introduction to Computer Science',
    org: 'Harvard University (edX)',
    description:
      "Harvard's flagship CS course, free and self-paced. C, Python, SQL, and web development. The best free foundation you can get before college.",
    url: 'https://cs50.harvard.edu/x/',
    type: 'resource', cost: 'free', format: 'online', age_min: 14, age_max: 18,
  },
  {
    title: 'freeCodeCamp',
    org: 'freeCodeCamp',
    description:
      'Thousands of hours of free, project-based curriculum in web development, data analysis, and machine learning, with free certifications.',
    url: 'https://www.freecodecamp.org/',
    type: 'resource', cost: 'free', format: 'online', age_min: 14, age_max: 18,
  },
  {
    title: 'Codeforces',
    org: 'Codeforces',
    description:
      'Free competitive programming contests roughly twice a week, with an enormous problem archive. The best place to practice between USACO rounds.',
    url: 'https://codeforces.com/',
    type: 'resource', cost: 'free', format: 'online', age_min: 14, age_max: 18,
  },
  {
    title: 'GenCyber Summer Camps',
    org: 'NSA & National Science Foundation',
    description:
      'Free cybersecurity camps funded by the NSA and NSF, hosted at universities nationwide including several in Texas. Free to attend, no cost to students.',
    url: 'https://www.gen-cyber.com/',
    type: 'program', cost: 'free', format: 'online', age_min: 14, age_max: 18,
  },
  {
    title: 'Science Olympiad',
    org: 'Science Olympiad',
    description:
      'Team STEM competition spanning 23 events, including several computing and engineering builds. Texas has a strong regional and state circuit.',
    url: 'https://www.soinc.org/',
    type: 'competition', cost: 'paid', format: 'online', age_min: 14, age_max: 18,
  },
  {
    title: 'FIRST Robotics Competition',
    org: 'FIRST',
    description:
      'Build a competition robot in six weeks with a team. North Texas hosts one of the largest FIRST districts in the country, with events across DFW.',
    url: 'https://www.firstinspires.org/robotics/frc',
    type: 'competition', cost: 'paid', format: 'online', age_min: 14, age_max: 18,
  },

  /* ---------------------------- RESIDENTIAL ---------------------------- */
  {
    title: 'MIT Beaver Works Summer Institute',
    org: 'MIT Lincoln Laboratory',
    description:
      'Free four-week summer program in autonomous racing, machine learning, cybersecurity, and more. Fully funded — MIT covers tuition and housing for accepted students.',
    url: 'https://beaverworks.ll.mit.edu/CMS/bw/bwsi',
    type: 'program', cost: 'free', format: 'residential',
    location: 'MIT, Cambridge, MA', age_min: 16, age_max: 18,
  },
  {
    title: 'MITES Summer',
    org: 'MIT',
    description:
      'Free, rigorous six-week residential STEM program for rising seniors from underrepresented or underserved backgrounds. MIT covers essentially all costs.',
    url: 'https://mites.mit.edu/',
    type: 'program', cost: 'free', format: 'residential',
    location: 'MIT, Cambridge, MA', age_min: 16, age_max: 18,
  },
  {
    title: 'Research Science Institute (RSI)',
    org: 'Center for Excellence in Education & MIT',
    description:
      'Free six-week summer research program for rising seniors, widely regarded as the most selective STEM summer program in the United States. Fully funded.',
    url: 'https://www.cee.org/programs/research-science-institute',
    type: 'internship', cost: 'free', format: 'residential',
    location: 'MIT, Cambridge, MA', age_min: 16, age_max: 18,
  },
  {
    title: 'Summer Science Program (SSP)',
    org: 'Summer Science Program',
    description:
      'Residential research program in astrophysics, biochemistry, or genomics where teams complete an original research project. Need-blind admission with generous financial aid.',
    url: 'https://summerscience.org/',
    type: 'program', cost: 'paid', format: 'residential',
    location: 'Various university campuses, USA', age_min: 15, age_max: 18,
  },
];

/**
 * Officers, from the Fall 2026 intro deck (slide 4). Real names, real roles --
 * nothing here is placeholder.
 */
export const OFFICERS = [
  { name: 'Elliott Harper', role: 'President', note: 'Also an officer on the Cybersecurity Committee', committee: 'main', sort_order: 0 },
  { name: 'Sujay Gonchigar', role: 'Vice President', note: 'Main CS Club', committee: 'main', sort_order: 1 },
  { name: 'Keshav Anand', role: 'Lead Officer, Cybersecurity', note: 'Runs the Cyber Committee', committee: 'cyber', sort_order: 2 },
  { name: 'Cody Trainer', role: 'Officer', note: 'Main CS Club', committee: 'main', sort_order: 3 },
  { name: 'Marcus Benett Zaens', role: 'Officer', note: 'Main CS Club', committee: 'main', sort_order: 4 },
  { name: 'Zubair Ahmed', role: 'Officer', note: 'Main CS Club', committee: 'main', sort_order: 5 },
];

/** The Java track roadmap, from the intro deck (slide 7). */
export const CURRICULUM = [
  { track: 'fall', title: 'Print statements and data types', sort_order: 0 },
  { track: 'fall', title: 'Conditionals and loops', sort_order: 1 },
  { track: 'fall', title: 'Arrays and strings', sort_order: 2 },
  { track: 'fall', title: 'Object-oriented programming', sort_order: 3 },
  { track: 'fall', title: 'Recursion', sort_order: 4 },
  { track: 'spring', title: 'Searching and sorting', sort_order: 0 },
  { track: 'spring', title: 'Time complexity analysis', sort_order: 1 },
  { track: 'spring', title: 'Data structures', sort_order: 2 },
  { track: 'spring', title: 'Graphs and BFS', sort_order: 3 },
  { track: 'spring', title: 'Dynamic programming', sort_order: 4 },
];

/** The club's own competitions, from the intro deck (slides 12-13). */
export const COMPETITIONS = [
  {
    name: 'UIL Computer Science',
    description: 'District, region, state. A written test plus a team programming round.',
    result: '', event_date: null, url: '', status: 'upcoming', sort_order: 0,
  },
  {
    name: 'HP CodeWars',
    description: 'One day, dozens of problems, hundreds of students in one room.',
    result: '', event_date: null, url: '', status: 'upcoming', sort_order: 1,
  },
  {
    name: 'Lockheed Martin AI Quest',
    description: 'AI Quest and related challenges, run by Lockheed Martin.',
    result: '2nd place, 2025-26 season', event_date: null, url: '', status: 'upcoming', sort_order: 2,
  },
];

/**
 * The first entry in the Puzzle Archive -- the actual opener from the intro
 * meeting (slide 8). The answer is the standard textbook solution to this
 * classic puzzle, written fresh here rather than copied from anywhere.
 */
export const PUZZLES = [
  {
    title: 'The Twelve Coins',
    prompt: 'You have 12 coins. One is lighter. Find it in three weighings.',
    answer: [
      'Weighing 1: split the 12 coins into three groups of 4 -- A, B, C. Weigh A against B.',
      '  - If they balance, the light coin is among the 4 in C.',
      '  - If they do not, the light coin is in whichever group of 4 was lighter (the side that went up).',
      '',
      'Weighing 2: take those 4 suspect coins and split them into two pairs. Weigh pair 1 against pair 2. The light coin is in whichever pair is lighter.',
      '',
      'Weighing 3: weigh the two coins in that pair against each other. The lighter one is the answer.',
    ].join('\n'),
    source: 'meeting opener',
    posted_at: '2026-08-18',
    revealed: true,
  },
];

export const SETTINGS = {
  club_name: 'Plano East CS Club',
  school_name: 'Plano East Senior High School',
  tagline: 'Build things. Win things. Get better together.',
  prize_title: 'Meta Ray-Ban Display Glasses',
  prize_blurb:
    'First place at the end of the year takes home a pair of Meta Ray-Bans. Points are earned all year — every meeting, every project, every competition counts.',
  about_heading: 'About the club',
  about_body: [
    'We are the computer science club at Plano East Senior High School. We meet to build software, break into things we are allowed to break into, enter competitions, and help each other get good.',
    'You do not need experience to join. Half of the people here started by showing up and asking what a terminal was. The other half are happy to tell you.',
    '',
    '## How points work',
    'Points are awarded by club officers for anything that moves you or the club forward. Every award is logged with a reason, so you can always see exactly where your points came from on your profile page.',
    '',
    '- Showing up to a meeting: 2-5 points',
    '- Finishing a project and demoing it: 15-30 points',
    '- Entering a competition: 20-40 points',
    '- Placing in a competition: 40-60 points',
    '- Teaching a workshop or mentoring someone: 20-25 points',
    '- Helping run a club event: 10-20 points',
    '',
    'The member in first place at the end of the year wins a pair of Meta Ray-Bans.',
    '',
    '## Meetings',
    'Check the club Discord and the school announcements for the current meeting time and room.',
  ].join('\n'),
  discord_url: '',
  email: '',

  // The Join page. join_classroom_code and join_meeting_info are deliberately
  // blank -- the deck itself says the Classroom code is "coming soon", and the
  // meeting day is unconfirmed (the deck says Thursday, the attendance form
  // asks about Wednesday conflicts). Fill both in from Admin -> Page text
  // once they're settled rather than guessing here.
  join_intro:
    'No experience needed. Beginners and returning competitors are both covered -- see the Curriculum page for what that looks like week to week.',
  join_consent_url: 'https://myforms.pisd.edu/Forms/ParentClubConsent',
  join_classroom_code: '',
  join_meeting_info: '',

  // The meetings calendar. Both blank until an officer creates a public
  // Google Calendar and pastes in its two URLs from Admin -> Page text --
  // see LEARN-DATABASE.md or the Calendar page's own empty-state for how.
  meetings_calendar_embed_url: '',
  meetings_calendar_subscribe_url: '',
};
