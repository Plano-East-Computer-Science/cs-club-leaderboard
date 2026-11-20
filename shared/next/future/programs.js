/**
 * The curated library: opportunities that actually matter for a CS or
 * engineering student at Plano East. Every record was checked on the web in
 * November 2026 (`checked`). A field we could not confirm is left out (null),
 * never guessed. Months are when the deadline (or the event, for contests you
 * just show up to) usually falls; programs move dates, so the page always
 * says "usually" and links to the official site.
 *
 * type: competition | summer | program | research | internship | scholarship | hackathon
 * cost: free | stipend (they pay you) | aid (a fee, with need-based aid) | paid | school (through your school) | null
 * where: online | dfw | texas | travel
 * selectivity: open (anyone can enter) | selective | very (single-digit percent or invitation)
 */

export const TYPE_LABEL = {
  competition: 'Competition',
  summer: 'Summer program',
  program: 'Year-round program',
  research: 'Research',
  internship: 'Internship',
  scholarship: 'Scholarship',
  hackathon: 'Hackathon',
};

export const COST_LABEL = {
  free: 'Free',
  stipend: 'Pays you',
  aid: 'Fee, aid available',
  paid: 'Costs money',
  school: 'Through your school',
};

export const WHERE_LABEL = { online: 'Online', dfw: 'In DFW', texas: 'In Texas', travel: 'Travel' };
export const SELECT_LABEL = { open: 'Open to all', selective: 'Selective', very: 'Very selective' };
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const ALL = [9, 10, 11, 12];
const C = '2026-11';

export const PROGRAMS = [
  /* ------------------------------ competitions ------------------------------ */
  {
    id: 'usaco', name: 'USACO', org: 'USA Computing Olympiad', type: 'competition', url: 'https://usaco.org/',
    grades: ALL, cost: 'free', month: 1, monthNote: 'Online contests run in winter; check the season schedule.', where: 'online', selectivity: 'open',
    eligibility: 'Pre-college students in the US. Free, solo, no team or sponsor needed.',
    why: 'The yardstick for algorithmic programming in the US. "Gold" or "Platinum" tells an admissions reader exactly how good you are without a single adjective.',
    checked: C,
  },
  {
    id: 'acsl', name: 'ACSL', org: 'American Computer Science League', type: 'competition', url: 'https://www.acsl.org/',
    grades: ALL, cost: 'school', costNote: 'A school or club registers a team ($175 per team for the Senior division).', month: null, where: 'online', selectivity: 'open',
    eligibility: 'Students on a registered school or organization team.',
    why: 'Contests spread across the school year that test CS theory as well as code. A gentle on-ramp before USACO, and a natural thing for the club to enter together.',
    checked: C,
  },
  {
    id: 'amc', name: 'AMC 10 and AMC 12', org: 'Mathematical Association of America', type: 'competition', url: 'https://maa.org/student-programs/amc/',
    grades: ALL, cost: 'school', costNote: 'Taken through a school or host site.', month: 11, where: 'dfw', selectivity: 'open',
    eligibility: 'AMC 10 for grade 10 and below, AMC 12 for grade 12 and below.',
    why: 'The standard math contest, and a strong score is the gate to AIME. Contest math is also the best training for algorithm problems.',
    checked: C,
  },
  {
    id: 'aime', name: 'AIME', org: 'Mathematical Association of America', type: 'competition', url: 'https://maa.org/maa-invitational-competitions/',
    grades: ALL, cost: 'school', month: null, monthNote: 'Invitation only, based on your AMC score.', where: 'dfw', selectivity: 'very',
    eligibility: 'Invited from the top AMC 10 and AMC 12 scores.',
    why: 'Qualifying is a recognized signal of real math talent, and it is the path to USAMO and USAJMO.',
    checked: C,
  },
  {
    id: 'cac', name: 'Congressional App Challenge', org: 'US House of Representatives', type: 'competition', url: 'https://www.congressionalappchallenge.us/',
    grades: ALL, cost: 'free', month: 10, where: 'online', selectivity: 'open',
    eligibility: 'Middle and high school students. Judged by congressional district.',
    why: 'Build and submit a real app. You compete only against your district, so the field is far smaller than a national contest.',
    checked: C,
  },
  {
    id: 'picoctf', name: 'picoCTF', org: 'Carnegie Mellon University', type: 'competition', url: 'https://picoctf.org/',
    grades: ALL, cost: 'free', month: 3, where: 'online', selectivity: 'open',
    eligibility: 'Middle school, high school and college students. Free account.',
    why: 'The best first capture-the-flag. Beginner-friendly security puzzles, and the practice problems stay up all year.',
    checked: C,
  },
  {
    id: 'cyberpatriot', name: 'CyberPatriot', org: 'Air & Space Forces Association', type: 'competition', url: 'https://www.uscyberpatriot.org/',
    grades: ALL, cost: 'paid', costNote: '$225 per team in the Open Division; a team needs an adult coach.', month: 10, monthNote: 'Teams are created by October 1.', where: 'online', selectivity: 'open',
    eligibility: 'Middle and high school teams with an approved adult coach.',
    why: 'Teams secure real Windows and Linux machines against the clock. It builds hands-on security skill that puzzle CTFs do not.',
    checked: C,
  },
  {
    id: 'uil-cs', name: 'UIL Computer Science', org: 'University Interscholastic League', type: 'competition', url: 'https://www.uiltexas.org/academics/stem/computer-science',
    grades: ALL, cost: 'school', month: null, monthNote: 'Spring meets: district, then region, then state.', where: 'texas', selectivity: 'open',
    eligibility: 'Texas public high school students, entered by their school.',
    why: "Texas's own CS contest: a 45-minute written exam, plus a two-hour programming contest for teams of three or four.",
    checked: C,
  },
  {
    id: 'uil-calc', name: 'UIL Calculator Applications', org: 'University Interscholastic League', type: 'competition', url: 'https://www.uiltexas.org/academics/stem/calculator-applications',
    grades: ALL, cost: 'school', month: null, monthNote: 'Spring meets.', where: 'texas', selectivity: 'open',
    eligibility: 'Texas public high school students, entered by their school.',
    why: 'A 30-minute, 70-problem test solved with a calculator. Speed and precision under pressure, and an easy second UIL event next to Computer Science.',
    checked: C,
  },
  {
    id: 'uil-ns', name: 'UIL Number Sense', org: 'University Interscholastic League', type: 'competition', url: 'https://www.uiltexas.org/academics/stem/number-sense',
    grades: ALL, cost: 'school', month: null, monthNote: 'Spring meets.', where: 'texas', selectivity: 'open',
    eligibility: 'Texas public high school students, entered by their school.',
    why: 'Ten minutes, 80 mental math questions. Pure practice in tricks and pattern-spotting; pairs well with Calculator Applications.',
    checked: C,
  },
  {
    id: 'tsa', name: 'Texas TSA', org: 'Technology Student Association', type: 'competition', url: 'https://texastsa.org/',
    grades: ALL, cost: 'school', costNote: 'Through your school chapter.', month: null, where: 'texas', selectivity: 'open',
    eligibility: 'Members of a school TSA chapter.',
    why: 'About 40 high school events, eight of them in computer science, from software development to coding. Good if you like presenting what you build.',
    checked: C,
  },
  {
    id: 'scioly', name: 'Science Olympiad', org: 'Science Olympiad', type: 'competition', url: 'https://www.soinc.org/',
    grades: ALL, cost: 'school', month: null, where: 'dfw', selectivity: 'selective',
    eligibility: 'Up to 15 students per Division C team, at most 7 seniors.',
    why: 'A 15-person team covers 23 events in one Saturday, including build events where you design and test a device. Real engineering with a hard deadline.',
    checked: C,
  },
  {
    id: 'frc', name: 'FIRST Robotics Competition', org: 'FIRST', type: 'competition', url: 'https://www.firstinspires.org/programs/frc/',
    grades: ALL, cost: 'school', costNote: 'Join a team; teams raise their own funds.', month: 1, monthNote: 'The new game is revealed each January.', where: 'dfw', selectivity: 'open',
    eligibility: 'Grades 9 to 12 on a registered team.',
    why: 'A full-size robot, a team, mentors and a brutal build season. The closest high school gets to working as an engineer, and the programming subteam is real software.',
    checked: C,
  },
  {
    id: 'ftc', name: 'FIRST Tech Challenge', org: 'FIRST', type: 'competition', url: 'https://www.firstinspires.org/programs/ftc/',
    grades: ALL, cost: 'school', month: null, where: 'dfw', selectivity: 'open',
    eligibility: 'Grades 7 to 12 on a registered team.',
    why: 'Smaller robots and smaller teams than FRC, so each person writes more of the code and owns more of the design.',
    checked: C,
  },
  {
    id: 'drsef', name: 'Dallas Regional Science and Engineering Fair', org: 'DRSEF', type: 'competition', url: 'https://dallassciencefair.org/',
    grades: ALL, cost: 'school', costNote: 'Place at your campus fair first.', month: 1, monthNote: 'Entries close in January; the fair is in February at Fair Park.', where: 'dfw', selectivity: 'selective',
    eligibility: 'Plano ISD students who place at their campus fair advance here.',
    why: 'The ISEF-affiliated fair Plano ISD feeds into. Plano East students qualified for ISEF from here in 2026, and a CS or engineering project is a legitimate entry.',
    checked: C,
  },
  {
    id: 'txsef', name: 'Texas Science and Engineering Fair', org: 'Texas A&M University', type: 'competition', url: 'https://txsef.tamu.edu/',
    grades: ALL, cost: null, month: 4, monthNote: 'Qualify at your regional fair first.', where: 'texas', selectivity: 'selective',
    eligibility: 'Grades 6 to 12 who qualify through an ISEF-affiliated regional fair.',
    why: 'The state round between your regional fair and ISEF.',
    checked: C,
  },
  {
    id: 'isef', name: 'Regeneron ISEF', org: 'Society for Science', type: 'competition', url: 'https://www.societyforscience.org/isef/',
    grades: ALL, cost: null, month: 5, monthNote: 'Held in May; you qualify through an affiliated fair.', where: 'travel', selectivity: 'very',
    eligibility: 'Winners of affiliated regional and state fairs.',
    why: 'The biggest high school research fair in the world. You do not apply; you win your way there through DRSEF or the state fair.',
    checked: C,
  },
  {
    id: 'sts', name: 'Regeneron Science Talent Search', org: 'Society for Science', type: 'competition', url: 'https://www.societyforscience.org/regeneron-sts/',
    grades: [12], cost: 'free', month: 11, where: 'online', selectivity: 'very',
    eligibility: 'High school seniors with an original research project.',
    why: 'The senior-year research competition, with a $250,000 top prize. It rewards a project you have been doing for a year or more, so plan it in 10th or 11th grade.',
    checked: C,
  },
  {
    id: 'think', name: 'MIT THINK Scholars', org: 'MIT', type: 'competition', url: 'https://think.mit.edu/',
    grades: ALL, cost: 'free', month: 1, monthNote: 'Proposals are due January 1.', where: 'online', selectivity: 'very',
    eligibility: 'High school students with a project idea.',
    why: 'You submit a proposal, not a finished project. Finalists get weekly mentorship and up to $1,000 to build it. Great for a project you cannot afford to start alone.',
    checked: C,
  },
  {
    id: 'technovation', name: 'Technovation Girls', org: 'Technovation', type: 'competition', url: 'https://technovationchallenge.org/',
    grades: ALL, cost: 'free', month: 5, monthNote: 'Season starts in the fall; submissions are due in May.', where: 'online', selectivity: 'open',
    eligibility: 'Girls ages 8 to 18, in teams with a mentor.',
    why: 'A whole season building an app or AI project that solves a real problem in your community. The finished product is a strong portfolio piece.',
    checked: C,
  },
  {
    id: 'codequest', name: 'Lockheed Martin Code Quest', org: 'Lockheed Martin', type: 'competition', url: 'https://www.lockheedmartin.com/en-us/who-we-are/communities/codequest.html',
    grades: ALL, cost: null, month: 2, monthNote: 'Held in late February.', where: 'dfw', selectivity: 'open',
    eligibility: 'High school teams of two or three.',
    why: 'Two and a half hours, 20 to 30 problems in Java, Python, C# or C++, at Lockheed sites in Fort Worth and Grand Prairie. Perfect practice for UIL team programming.',
    checked: C,
  },
  {
    id: 'naclo', name: 'NACLO', org: 'North American Computational Linguistics Open', type: 'competition', url: 'https://naclo.org/',
    grades: ALL, cost: 'free', month: 1, monthNote: 'Open Round in late January.', where: 'online', selectivity: 'open',
    eligibility: 'Middle and high school students in North America.',
    why: 'Decode languages you have never seen from a few examples. It is pattern-finding and logic, CS students tend to be good at it, and it shows range.',
    checked: C,
  },
  {
    id: 'fma', name: 'F=ma and USAPhO', org: 'American Association of Physics Teachers', type: 'competition', url: 'https://aapt.org/physicsteam/PT-landing.cfm',
    grades: ALL, cost: 'paid', costNote: 'Registered and paid through a school.', month: 1, monthNote: 'Register by mid-January; the exam is in February.', where: 'dfw', selectivity: 'open',
    eligibility: 'High school students registered through their school.',
    why: 'The physics olympiad path. For engineering applicants it plays the role AMC and AIME play for math.',
    checked: C,
  },
  {
    id: 'm3', name: 'MathWorks Math Modeling Challenge', org: 'SIAM', type: 'competition', url: 'https://m3challenge.siam.org/',
    grades: [11, 12], cost: 'free', month: 2, monthNote: 'Register by mid-February; the challenge is one weekend.', where: 'online', selectivity: 'open',
    eligibility: 'Teams of high school juniors and seniors with a teacher coach.',
    why: 'One weekend, one open-ended real-world problem, a written model. It looks a lot like actual data science work.',
    checked: C,
  },
  {
    id: 'jshs', name: 'Texas JSHS', org: 'Junior Science and Humanities Symposium', type: 'competition', url: 'https://www.jshs.org/region/texas/',
    grades: ALL, cost: null, month: 1, monthNote: 'Abstract in fall, paper in January; confirm on the regional page.', where: 'texas', selectivity: 'selective',
    eligibility: 'High school students with original STEM research.',
    why: 'Present your research as a paper and talk and compete for scholarships. A second outlet for the same project you take to the science fair.',
    checked: C,
  },
  {
    id: 'codeforces', name: 'Codeforces rounds', org: 'Codeforces', type: 'competition', url: 'https://codeforces.com/',
    grades: ALL, cost: 'free', month: null, monthNote: 'Rated rounds every week.', where: 'online', selectivity: 'open',
    eligibility: 'Anyone with an account.',
    why: 'Frequent rated contests and an endless problem archive. The fastest way to improve between USACO contests.',
    checked: C,
  },
  {
    id: 'atcoder', name: 'AtCoder Beginner Contests', org: 'AtCoder', type: 'competition', url: 'https://atcoder.jp/',
    grades: ALL, cost: 'free', month: null, monthNote: 'Weekly.', where: 'online', selectivity: 'open',
    eligibility: 'Anyone with an account.',
    why: 'Weekly contests with clean statements and well-graded difficulty. The ideal ladder from USACO Bronze to Silver.',
    checked: C,
  },
  {
    id: 'aoc', name: 'Advent of Code', org: 'Advent of Code', type: 'competition', url: 'https://adventofcode.com/',
    grades: ALL, cost: 'free', month: 12, monthNote: 'Puzzles unlock daily from December 1.', where: 'online', selectivity: 'open',
    eligibility: 'Anyone.',
    why: 'A daily puzzle every December. A fun way to learn a new language, and a good thing to do as a club.',
    checked: C,
  },
  {
    id: 'hackclub', name: 'High school hackathons', org: 'Hack Club', type: 'hackathon', url: 'https://hackathons.hackclub.com/',
    grades: ALL, cost: 'free', month: null, monthNote: 'Events all year.', where: 'online', selectivity: 'open',
    eligibility: 'Teenagers. Hack Club programs are free.',
    why: 'A maintained list of high school hackathons, online and in person. Go to one with friends and ship something in a weekend.',
    checked: C,
  },

  /* ---------------------------- summer programs ---------------------------- */
  {
    id: 'rsi', name: 'Research Science Institute (RSI)', org: 'Center for Excellence in Education', type: 'summer', url: 'https://www.cee.org/programs/research-science-institute',
    grades: [11], cost: 'free', month: 12, monthNote: 'Due in mid-December of junior year.', where: 'travel', selectivity: 'very',
    eligibility: 'Juniors, 16 by July 1. US citizens, permanent residents and some international students.',
    why: 'Free, six weeks of real research with a mentor. One of the hardest programs in the country to get into, and about 10% of admits had no prior research.',
    checked: C,
  },
  {
    id: 'ssp', name: 'Summer Science Program (SSP)', org: 'Summer Science Program', type: 'summer', url: 'https://ssp.org/',
    grades: [10, 11], cost: 'aid', costNote: 'Free to apply; the fee scales to what your family can afford, and many families pay nothing.', month: 2, monthNote: 'Opens in early January, closes in February.', where: 'travel', selectivity: 'very',
    eligibility: 'Mostly juniors; some tracks admit sophomores with the right coursework.',
    why: 'Small teams run one real research project start to finish. The aid is unusually generous.',
    checked: C,
  },
  {
    id: 'promys', name: 'PROMYS', org: 'Boston University', type: 'summer', url: 'https://promys.org/',
    grades: [10, 11, 12], cost: 'aid', costNote: 'Awards can cover the full cost.', month: 2, monthNote: 'Due at the end of February.', where: 'travel', selectivity: 'very',
    eligibility: 'Students who have finished at least 9th grade.',
    why: 'Six weeks of proving number theory from scratch. It changes how you think, which pays off in every algorithms class later.',
    checked: C,
  },
  {
    id: 'ross', name: 'Ross Mathematics Program', org: 'Ross Program', type: 'summer', url: 'https://rossprogram.org/',
    grades: [10, 11, 12], cost: 'aid', costNote: '$7,500, with financial aid for families with need.', month: 3, monthNote: 'Due March 8.', where: 'travel', selectivity: 'very',
    eligibility: 'High school students; check the site for ages.',
    why: 'Six weeks of deep, slow, proof-based number theory. Same idea as PROMYS; apply to both.',
    checked: C,
  },
  {
    id: 'mathcamp', name: 'Canada/USA Mathcamp', org: 'Mathcamp', type: 'summer', url: 'https://www.mathcamp.org/',
    grades: ALL, cost: 'aid', costNote: 'Fee varies with aid; check the site.', month: 2, monthNote: 'The Qualifying Quiz is due in late February.', where: 'travel', selectivity: 'very',
    eligibility: 'Ages 13 to 18.',
    why: 'Five weeks of serious math with students from around the world. You get in by solving the Qualifying Quiz, which is worth doing on its own.',
    checked: C,
  },
  {
    id: 'sumac', name: 'Stanford University Mathematics Camp (SUMaC)', org: 'Stanford Pre-Collegiate Studies', type: 'summer', url: 'https://sumac.spcs.stanford.edu/',
    grades: ALL, cost: null, month: 1, monthNote: 'Due in early January.', where: 'travel', selectivity: 'very',
    eligibility: 'Check the site for grades; online and residential options.',
    why: 'Advanced math with an online option, so you do not have to fly to California.',
    checked: C,
  },
  {
    id: 'mites-summer', name: 'MITES Summer', org: 'MIT', type: 'summer', url: 'https://mites.mit.edu/discover-mites/mites-summer/',
    grades: [11], cost: 'free', costNote: 'No cost to students apart from travel.', month: 2, monthNote: 'Due February 1 of junior year.', where: 'travel', selectivity: 'very',
    eligibility: 'Juniors, applying in the fall and winter of 11th grade.',
    why: 'A residential summer at MIT in math, science and engineering, at no cost. Aimed at students from communities underrepresented in STEM.',
    checked: C,
  },
  {
    id: 'mites-semester', name: 'MITES Semester', org: 'MIT', type: 'program', url: 'https://mites.mit.edu/discover-mites/apply-to-mites/prepare-your-application-mites-summer-and-mites-semester/',
    grades: [11], cost: 'free', month: 2, monthNote: 'Same application as MITES Summer, due February 1.', where: 'online', selectivity: 'selective',
    eligibility: 'Juniors.',
    why: 'The online MITES. Same application, more spots, and you stay home.',
    checked: C,
  },
  {
    id: 'sams', name: 'CMU Summer Academy for Math and Science (SAMS)', org: 'Carnegie Mellon University', type: 'summer', url: 'https://www.cmu.edu/pre-college/academic-programs/sams.html',
    grades: [11], cost: 'free', costNote: 'Fully funded except travel to Pittsburgh.', month: 2, monthNote: 'Due February 1.', where: 'travel', selectivity: 'very',
    eligibility: 'Juniors, 16 by the program start.',
    why: 'A fully funded summer at one of the best CS schools in the country.',
    checked: C,
  },
  {
    id: 'bwsi', name: 'MIT Beaver Works Summer Institute', org: 'MIT Lincoln Laboratory', type: 'summer', url: 'https://bwsi.mit.edu/',
    grades: [11], cost: 'aid', costNote: 'Tuition-free for families under $200,000 income; housing is extra.', month: 3, monthNote: 'Starts with an online prerequisite course in the spring.', where: 'travel', selectivity: 'selective',
    eligibility: 'Rising seniors who finish the online prerequisite course.',
    why: 'Project-based engineering at MIT that starts with an online prerequisite course. The course is worth doing even if you never go.',
    checked: C,
  },
  {
    id: 'clark', name: 'Clark Scholars Program', org: 'Texas Tech University', type: 'research', url: 'https://www.depts.ttu.edu/clarkscholars/',
    grades: [11, 12], cost: 'stipend', costNote: '$750 stipend.', month: 2, monthNote: 'Due February 15.', where: 'texas', selectivity: 'very',
    eligibility: 'At least 17 by the start date; rising seniors and just-graduated seniors. US citizens or permanent residents.',
    why: 'Paid summer research with a faculty mentor in Lubbock. One of the most selective research programs in Texas.',
    checked: C,
  },
  {
    id: 'hsmc', name: 'Honors Summer Math Camp', org: 'Texas State University', type: 'summer', url: 'https://www.txst.edu/mathworks/mathworks-camps/hsmc.html',
    grades: ALL, cost: 'aid', costNote: '$6,600, scholarships available.', month: 2, monthNote: 'Opens in December; acceptances start mid-February and fill.', where: 'texas', selectivity: 'selective',
    eligibility: 'Check the site for ages and prerequisites.',
    why: 'Six weeks of proof-based math in San Marcos. The Texas answer to Ross and PROMYS.',
    checked: C,
  },
  {
    id: 'code-tacc', name: 'Code@TACC Cybersecurity AI', org: 'Texas Advanced Computing Center, UT Austin', type: 'summer', url: 'https://tacc.utexas.edu/education/k-12-students/high-school-camps/cybersecurity/',
    grades: [10, 11], cost: 'free', month: 4, where: 'texas', selectivity: 'selective',
    eligibility: 'Current 10th and 11th graders.',
    why: 'A free week at UT Austin learning networking, cryptography and security, living in a campus dorm. A cheap way to see UT up close.',
    checked: C,
  },
  {
    id: 'amp', name: 'Jane Street Academy of Math and Programming', org: 'Jane Street', type: 'summer', url: 'https://www.janestreet.com/join-jane-street/programs-and-events/amp/',
    grades: [12], cost: 'free', costNote: 'Tuition, housing, meals and travel are covered.', month: null, monthNote: 'Applications open early in the year.', where: 'travel', selectivity: 'very',
    eligibility: 'Graduating seniors, the summer before college.',
    why: 'Five weeks of math and programming in New York, fully paid, the summer after you are admitted. A strong bridge into a college CS program.',
    checked: C,
  },
  {
    id: 'gwc', name: 'Girls Who Code Pathways', org: 'Girls Who Code', type: 'summer', url: 'https://girlswhocode.com/programs/pathways',
    grades: ALL, cost: 'free', month: null, where: 'online', selectivity: 'open',
    eligibility: 'Girls and non-binary students in grades 9 to 12.',
    why: 'A free, self-paced virtual summer program. Low pressure, real projects, and a network worth having.',
    checked: C,
  },
  {
    id: 'kwk', name: 'Kode With Klossy Camp', org: 'Kode With Klossy', type: 'summer', url: 'https://www.kodewithklossy.com/camp',
    grades: ALL, cost: 'free', month: 2, monthNote: 'Applications open in February.', where: 'travel', selectivity: 'selective',
    eligibility: 'Young women and gender-expansive people ages 13 to 18.',
    why: 'Free two-week camps in web development, AI and machine learning and more, ending with a project you can show.',
    checked: C,
  },
  {
    id: 'cosmos', name: 'COSMOS', org: 'University of California', type: 'summer', url: 'https://cosmos-ucop.ucdavis.edu/',
    grades: ALL, cost: 'paid', costNote: '$5,793, with optional financial aid.', month: 2, where: 'travel', selectivity: 'selective',
    eligibility: 'California students only.',
    why: 'Listed because people ask: COSMOS is for California students only, so Plano students cannot apply. Look at SAMS, MITES or Clark instead.',
    checked: C,
  },
  {
    id: 'tams', name: 'Texas Academy of Mathematics and Science (TAMS)', org: 'University of North Texas', type: 'program', url: 'https://tams.unt.edu/',
    grades: [10], cost: 'paid', costNote: 'About $28,000 a year before scholarships; every student gets a $9,000 TAMS scholarship and more is need-based.', month: 1, monthNote: 'Apply in 10th grade; all materials due mid-January.', where: 'dfw', selectivity: 'selective',
    eligibility: 'Usually 10th graders, who enter TAMS for 11th and 12th grade.',
    why: 'Spend your last two years of high school as a full-time student at UNT in Denton, taking real college math and CS. A big decision; talk to someone who did it.',
    checked: C,
  },

  /* ------------------------- research and internships ------------------------ */
  {
    id: 'primes-usa', name: 'MIT PRIMES-USA', org: 'MIT Mathematics', type: 'research', url: 'https://math.mit.edu/research/highschool/primes/usa/',
    grades: [10, 11], cost: 'free', month: 11, monthNote: 'Due in early November.', where: 'online', selectivity: 'very',
    eligibility: 'Sophomores and juniors in the US outside the Boston area.',
    why: 'A free year of remote research in math or bioinformatics with MIT mentors.',
    checked: C,
  },
  {
    id: 'simons', name: 'Simons Summer Research Program', org: 'Stony Brook University', type: 'research', url: 'https://www.stonybrook.edu/simons/',
    grades: [11], cost: null, month: 2, monthNote: 'School nomination in January, application due in early February.', where: 'travel', selectivity: 'very',
    eligibility: 'Juniors, nominated by their school.',
    why: 'Six weeks in a Stony Brook research lab. You need your school to nominate you, so ask your counselor early.',
    checked: C,
  },
  {
    id: 'simr', name: 'Stanford Institutes of Medicine Summer Research Program (SIMR)', org: 'Stanford Medicine', type: 'research', url: 'https://med.stanford.edu/simr.html',
    grades: [11, 12], cost: 'free', costNote: 'No cost if selected; $50 application fee with waivers.', month: 2, monthNote: 'Due in late February.', where: 'travel', selectivity: 'very',
    eligibility: 'Juniors and seniors who are at least 16 by the June start.',
    why: 'Eight weeks in a Stanford lab. Biology-heavy, with bioinformatics work for students who can code.',
    checked: C,
  },
  {
    id: 'garcia', name: 'Garcia Summer Research Program', org: 'Stony Brook University', type: 'research', url: 'https://www.stonybrook.edu/garcia/summer-program/',
    grades: [11, 12], cost: 'paid', costNote: '$4,000 lab fee before room and board.', month: null, where: 'travel', selectivity: 'selective',
    eligibility: 'At least 16, about a 3.8 unweighted GPA.',
    why: 'Materials science and polymer research. It costs real money, so compare it with the free programs first.',
    checked: C,
  },
  {
    id: 'rise', name: 'BU RISE Internship and Practicum', org: 'Boston University', type: 'research', url: 'https://www.bu.edu/summer/high-school-programs/rise-internship-practicum/',
    grades: [11], cost: 'paid', month: 2, monthNote: 'Opens December 15, due in early February.', where: 'travel', selectivity: 'selective',
    eligibility: 'Domestic juniors.',
    why: 'Six weeks, 40 hours a week on a mentor\'s research project, ending in a poster. It costs money; the internship track is the one that counts.',
    checked: C,
  },
  {
    id: 'utsw-stars', name: 'UT Southwestern STARS Summer Research', org: 'UT Southwestern Medical Center', type: 'research', url: 'https://www.utsouthwestern.edu/education/nondegree-programs/stars/programs/summer-research-opportunities.html',
    grades: [11], cost: 'stipend', costNote: 'Students are paid a stipend.', month: 1, monthNote: 'Due in late January.', where: 'dfw', selectivity: 'very',
    eligibility: 'Juniors with no prior research experience, 16 by June 1, North Texas students encouraged.',
    why: 'Eight paid weeks in a research lab in Dallas, built for students who have never done research. Labs increasingly want people who can code.',
    checked: C,
  },
  {
    id: 'utd-research', name: 'UT Dallas CS Research Program for High School Students', org: 'UT Dallas Computer Science', type: 'research', url: 'https://k12.utdallas.edu/research/',
    grades: [10, 11], cost: 'paid', costNote: '$900 to $2,000 depending on track; discounts for low-income families.', month: 3, monthNote: 'Priority deadline March 1.', where: 'dfw', selectivity: 'selective',
    eligibility: 'Advanced students, ideally finishing 10th or 11th grade. In person at 15 and up.',
    why: 'Summer research and AI workshops in UT Dallas CS labs in Richardson, right next to Plano. Not free, but local and real.',
    checked: C,
  },
  {
    id: 'nasa-sees', name: 'NASA SEES High School Internship', org: 'UT Austin Center for Space Research', type: 'internship', url: 'https://csr.utexas.edu/education-outreach/high-school-internships/sees/',
    grades: [10, 11], cost: null, month: 2, monthNote: 'Due in late February.', where: 'texas', selectivity: 'very',
    eligibility: '10th and 11th graders, at least 16 by early July.',
    why: 'A NASA-backed Earth and space science internship run from UT Austin, with a lot of data analysis and coding.',
    checked: C,
  },

  /* ------------------------------ scholarships ------------------------------ */
  {
    id: 'coke', name: 'Coca-Cola Scholars', org: 'Coca-Cola Scholars Foundation', type: 'scholarship', url: 'https://www.coca-colascholarsfoundation.org/apply/',
    grades: [12], cost: 'free', month: 9, monthNote: 'Due September 30 of senior year.', where: 'online', selectivity: 'very',
    eligibility: 'High school seniors with at least a 3.0 GPA.',
    why: '150 scholarships of $20,000. Apply the first week of senior year; it takes an evening.',
    checked: C,
  },
  {
    id: 'qb-cps', name: 'QuestBridge College Prep Scholars', org: 'QuestBridge', type: 'scholarship', url: 'https://www.questbridge.org/apply-to-college/programs/college-prep-scholars-program',
    grades: [11], cost: 'free', month: 3, monthNote: 'Due in late March of junior year.', where: 'online', selectivity: 'very',
    eligibility: 'High-achieving juniors from households earning under about $65,000 (family of four).',
    why: 'For high-achieving low-income juniors; it is the warm-up for the National College Match senior year.',
    checked: C,
  },
  {
    id: 'qb-match', name: 'QuestBridge National College Match', org: 'QuestBridge', type: 'scholarship', url: 'https://www.questbridge.org/apply-to-college/programs/national-college-match',
    grades: [12], cost: 'free', month: 10, monthNote: 'Due around October 1 of senior year.', where: 'online', selectivity: 'very',
    eligibility: 'High-achieving seniors from low-income households.',
    why: 'Students who match are admitted early with a full four-year scholarship to a partner college.',
    checked: C,
  },
  {
    id: 'ncwit', name: 'NCWIT Aspirations in Computing Award', org: 'NCWIT', type: 'scholarship', url: 'https://www.aspirations.org/award-programs/aic-high-school-award',
    grades: ALL, cost: 'free', month: 10, monthNote: 'Due in late October.', where: 'online', selectivity: 'selective',
    eligibility: 'High school students who self-identify as women, genderqueer or non-binary.',
    why: 'Recognizes computing work at the regional and national level. The community and scholarships that come with it matter more than the certificate.',
    checked: C,
  },
  {
    id: 'davidson', name: 'Davidson Fellows Scholarship', org: 'Davidson Institute', type: 'scholarship', url: 'https://www.davidsongifted.org/gifted-programs/fellows-scholarship/',
    grades: ALL, cost: 'free', month: 2, monthNote: 'Due in mid-February.', where: 'online', selectivity: 'very',
    eligibility: '18 or younger with a significant completed project.',
    why: 'Awards of $25,000 to $100,000 for one serious project in technology, science or math. Only worth applying with real results.',
    checked: C,
  },
  {
    id: 'jkc', name: 'Cooke College Scholarship', org: 'Jack Kent Cooke Foundation', type: 'scholarship', url: 'https://www.jkcf.org/our-scholarships/college-scholarship-program/',
    grades: [12], cost: 'free', month: 11, monthNote: 'Open September to early November.', where: 'online', selectivity: 'very',
    eligibility: 'High-achieving seniors with financial need.',
    why: 'One of the largest undergraduate scholarships in the country for students with need.',
    checked: C,
  },
  {
    id: 'gates', name: 'The Gates Scholarship', org: 'The Gates Scholarship', type: 'scholarship', url: 'https://www.thegatesscholarship.org/scholarship',
    grades: [12], cost: 'free', month: 9, monthNote: 'Due September 15 of senior year.', where: 'online', selectivity: 'very',
    eligibility: 'Pell-eligible seniors who are US citizens or permanent residents.',
    why: 'A major scholarship for Pell-eligible students. If you qualify, start the application in the summer before senior year.',
    checked: C,
  },
  {
    id: 'terry', name: 'Terry Foundation Scholarship', org: 'Terry Foundation', type: 'scholarship', url: 'https://terryfoundation.org/apply/',
    grades: [12], cost: 'free', month: 12, monthNote: 'Deadlines vary by university (December 1 at Texas A&M).', where: 'texas', selectivity: 'very',
    eligibility: 'Texas high school seniors going to a partner Texas public university such as UT Austin or Texas A&M.',
    why: 'A major scholarship for Texas students staying in state at a partner university.',
    checked: C,
  },
  {
    id: 'national-merit', name: 'National Merit Scholarship (PSAT/NMSQT)', org: 'National Merit Scholarship Corporation', type: 'scholarship', url: 'https://www.nationalmerit.org/',
    grades: [11], cost: 'school', costNote: 'You enter by taking the PSAT/NMSQT at school.', month: 10, monthNote: 'The PSAT/NMSQT is in October of junior year.', where: 'dfw', selectivity: 'selective',
    eligibility: 'Juniors who take the PSAT/NMSQT in the specified year.',
    why: 'Your junior-year PSAT score is your entry. Texas cutoffs are high, but semifinalist status opens real money at many universities.',
    checked: C,
  },
];

/** Required fields every record must have (tests check this). */
export const REQUIRED = ['id', 'name', 'org', 'type', 'url', 'grades', 'where', 'selectivity', 'eligibility', 'why', 'checked'];

/** True when a curated program is open to a student in this grade (or no grade given). */
export const fitsGrade = (p, grade) => !grade || p.grades.includes(Number(grade));
