/**
 * The college plan: a grade-by-grade roadmap for a Plano East student aiming
 * at a top CS or engineering program, what to do each month, and the
 * applying guide. Course names are from the Plano ISD 2026-2027 High School
 * Academic Course Guide; offerings can vary by campus, so the page says to
 * confirm with a counselor.
 */

export const CATALOG_URL = 'https://www.pisd.edu/students-families-a6/course-catalog';

/** School years start in August, so June and July belong to the grade just finished. */
export const schoolYearEnd = (date = new Date()) => (date.getMonth() >= 7 ? date.getFullYear() + 1 : date.getFullYear());
export function gradeOf(classOf, date = new Date()) {
  const g = 12 - (Number(classOf) - schoolYearEnd(date));
  return g >= 9 && g <= 12 ? g : null;
}
export const classOfFor = (grade, date = new Date()) => schoolYearEnd(date) + (12 - Number(grade));

export const ROADMAP = [
  {
    grade: 9,
    focus: 'Try things, start coding for real, and keep your grades clean. Nobody expects a spike yet.',
    courses: [
      'AP Computer Science Principles or Computer Science I. Both are open to 9th graders, and either one unlocks AP Computer Science A next year.',
      'Stay on the fastest math track you can handle well. Math is the prerequisite chain that decides whether you reach AP Calculus BC in 11th grade.',
      'Principles of Applied Engineering if you want the engineering course sequence (Engineering Design and Presentation, Engineering Science, Robotics).',
    ],
    compete: [
      'USACO Bronze. Free, from home, and the best measure of real progress.',
      'AMC 10 in November, picoCTF in March, and Advent of Code in December for fun.',
      'Join the club team for ACSL or UIL Computer Science and learn what contest day feels like.',
    ],
    build: [
      'Ship small things: a Discord bot, a tool for a class, a game your friends actually play. Finishing matters more than size.',
      'Put everything on GitHub with a short README. Future you will thank you.',
    ],
    summer: [
      'Free beats fancy: Girls Who Code Pathways, a Hack Club hackathon, or a summer grinding USACO Silver.',
      'Build one project you care about over the summer. Nobody gets admitted for paying for a camp.',
    ],
  },
  {
    grade: 10,
    focus: 'Pick a direction. Go deeper on one or two things instead of joining everything.',
    courses: [
      'AP Computer Science A (needs Computer Science I or AP Computer Science Principles first).',
      'AP Precalculus if you are accelerated in math. It is the prerequisite for AP Calculus BC.',
      'AP Physics 1, which leads to AP Physics C as a senior. AP Statistics is open from 10th grade too.',
    ],
    compete: [
      'USACO Silver. Most strong CS applicants get here; Gold is what stands out.',
      'AMC 10 or 12 again, aiming for AIME. UIL Computer Science and Lockheed Martin Code Quest with a team.',
      'Start a science fair project you could keep working on next year: campus fair, then DRSEF in February.',
    ],
    build: [
      'Choose one project and make it real: actual users (20 classmates count), a demo video, issues you fixed because someone asked.',
      'If research interests you, read papers in one area and email one professor with a specific question. Most will not answer; one is enough.',
    ],
    summer: [
      'Apply to programs open to sophomores: SSP (with the right coursework), PROMYS, Ross, Mathcamp, the UT Dallas CS research program, NASA SEES and Code@TACC.',
      'A job, an internship at a local company, or a summer of serious building all count. Do one thing with your whole chest.',
    ],
  },
  {
    grade: 11,
    focus: 'The year that counts most: hardest courses, your spike, test scores and the summer program applications.',
    courses: [
      'AP Calculus BC (needs AP Precalculus). This is what top engineering programs expect to see by senior year.',
      'Computer Science III after AP Computer Science A, or a second science AP.',
      'Keep a full, hard schedule. Admissions readers compare you with what your school offers, not with other schools.',
    ],
    compete: [
      'USACO Gold or higher, AIME if you can get there, F=ma for engineering, and the MathWorks Math Modeling Challenge.',
      'Take your research to DRSEF and Texas JSHS. A qualifier from DRSEF goes to the state fair and possibly ISEF.',
      'The PSAT/NMSQT in October is the National Merit qualifier. Prepare for it.',
    ],
    build: [
      'This is the spike year. One project or research question you can talk about for 20 minutes, with numbers: users, accuracy, time saved, money raised.',
      'Write it up. A short paper, a blog post or a polished README turns work into evidence.',
    ],
    summer: [
      'Apply in winter for the big ones: RSI (December), UTSW STARS (January), MITES and SAMS (February 1), Clark (February 15), SIMR and Simons (February), BWSI (spring).',
      'Start your Common App personal statement in July. Visit campuses if you can, including UT Austin, A&M, Rice and UT Dallas, which are a drive away.',
    ],
  },
  {
    grade: 12,
    focus: 'Apply well, keep your grades up (colleges see them), and finish the project that defines you.',
    courses: [
      'AP Physics C, open to seniors after AP Physics 1 or Physics.',
      'Dual Credit Calculus III (MATH 2415) and Dual Credit Differential Equations (MATH 2320) with Collin College, open to seniors with a 4 or 5 on AP Calculus BC.',
      'Do not lighten your schedule. Colleges see your senior courses and your midyear grades.',
    ],
    compete: [
      'Regeneron STS in November if you have a real research project.',
      'Keep doing USACO and UIL. Results that come after you apply can go in a midyear update.',
    ],
    build: [
      'Polish the spike project and make it easy to see: a live link, a demo video, a clear README. Readers do click.',
    ],
    summer: [
      'Admitted students can apply to the Jane Street Academy of Math and Programming. Otherwise, rest, work, and get ahead on the math you will need.',
    ],
  },
];

/** What to do each month, by grade. June and July are the summer after that grade. */
export const MONTHLY = {
  9: {
    8: ['Pick AP Computer Science Principles or Computer Science I if you have not already.', 'Come to the first club meeting and make a USACO account.'],
    9: ['Join the club team for ACSL or UIL Computer Science.', 'Start USACO Bronze training problems, one a week.'],
    10: ['Find out if your school offers the AMC 10 in November and sign up.', 'Pick a first small project and finish it this month.'],
    11: ['Take the AMC 10.', 'Look at the Congressional App Challenge rules for next fall and keep a list of app ideas.'],
    12: ['Do Advent of Code with friends.', 'Keep first-semester grades clean; they count.'],
    1: ['Take a USACO contest this season, even if you get stuck. The score is a baseline.'],
    2: ['Plan next year: AP Computer Science A needs Computer Science I or AP CSP first.', 'Ask a teacher about next year\'s math placement.'],
    3: ['Do picoCTF.', 'Pick a summer plan: free programs, a hackathon, or a project.'],
    4: ['Register for course selection and choose the hardest load you can do well.'],
    5: ['Finish strong in finals.', 'Write down what you built this year; you will forget otherwise.'],
    6: ['Start a summer project with a deadline you tell someone about.', 'Work through USACO Silver material.'],
    7: ['Ship the summer project and post it on GitHub with a README.'],
  },
  10: {
    8: ['Take AP Computer Science A.', 'Decide on your one main direction for the year: contests, a project, or research.'],
    9: ['Sign up for the club UIL team.', 'Start reading papers or docs in the area you picked.'],
    10: ['Take the PSAT as practice.', 'Look for a teacher who could sponsor a science fair project.'],
    11: ['Take the AMC 10 or 12.', 'Ask your science teacher how the campus science fair works this year.'],
    12: ['Advent of Code, then plan which summer programs open to sophomores you will apply to.', 'Check deadlines: PROMYS, Ross and Mathcamp are due in February and March.'],
    1: ['Enter USACO contests and aim for Silver.', 'Write applications for summer programs open to sophomores.'],
    2: ['Present at the campus science fair; winners go to DRSEF.', 'Submit SSP (if eligible), PROMYS and Mathcamp applications.'],
    3: ['Submit Ross and the UT Dallas CS research program.', 'Take picoCTF.'],
    4: ['Pick 11th grade courses: AP Calculus BC needs AP Precalculus, AP Physics C comes later.', 'Code@TACC applications are due this month.'],
    5: ['Ask two teachers you like how they would describe you. Their answer tells you where you stand.'],
    6: ['Summer program, job or serious project. Pick one and go deep.'],
    7: ['Write down your project numbers: users, results, what changed.', 'Look at RSI and SAMS eligibility for next year.'],
  },
  11: {
    8: ['Take the hardest schedule you can do well; this is the year colleges weigh most.', 'Make a list of summer program deadlines: RSI is in December.'],
    9: ['Prepare for the PSAT/NMSQT; it is the National Merit qualifier.', 'Pick the research question or project that will be your spike.'],
    10: ['Take the PSAT/NMSQT.', 'If you qualify by income, look at QuestBridge College Prep Scholars (due in March).'],
    11: ['Take the AMC 12.', 'Draft your RSI essays now.'],
    12: ['Submit RSI by mid-December.', 'Start MITES, SAMS and Clark applications over break.'],
    1: ['UTSW STARS is due in late January.', 'Do USACO contests and register for F=ma.'],
    2: ['MITES and SAMS are due February 1; Clark is due February 15; SIMR and Simons too.', 'Present at the science fair and DRSEF.'],
    3: ['Plan SAT or ACT dates for spring and early fall.', 'Ask two junior-year teachers for recommendations before the year ends.'],
    4: ['Take the SAT or ACT.', 'Meet your counselor about your college list and what your recommendation letter should say.'],
    5: ['Finish AP exams strong.', 'Give your recommenders a one-page brag sheet.'],
    6: ['Draft your Common App personal statement.', 'Build a list of about 10 to 15 schools with real reaches, matches and likelies.'],
    7: ['Retake the SAT or ACT if you need to.', 'Write a first draft of your activities list and check UT Austin\'s early action date of October 15.'],
  },
  12: {
    8: ['The Common App is open. Finish the personal statement and start supplements.', 'Ask teachers to confirm recommendations, with your deadlines.'],
    9: ['Coca-Cola Scholars is due September 30 and the Gates Scholarship September 15.', 'Decide on early decision or early action.'],
    10: ['UT Austin early action is October 15.', 'The FAFSA and CSS Profile open October 1. File early.', 'QuestBridge National College Match is due around October 1.'],
    11: ['Most early deadlines are November 1. Regeneron STS is due in early November.', 'UC applications are due November 30.'],
    12: ['UT Austin regular, Texas A&M and UT Dallas priority deadlines are December 1.', 'Early decisions come out; have regular applications ready.'],
    1: ['Most regular deadlines fall between January 1 and January 15.', 'Send midyear grades and any new contest results.'],
    2: ['Check every portal for missing documents.', 'Apply for outside scholarships like Davidson if you have a significant project.'],
    3: ['Decisions arrive. Compare financial aid offers line by line.'],
    4: ['Visit admitted-student days and ask current CS students about getting into classes.'],
    5: ['Commit by May 1. Thank your recommenders.'],
    6: ['Jane Street AMP, a job, or rest. Brush up on the math you will need.'],
    7: ['Get ahead on your college\'s placement exams and orientation.'],
  },
};

/**
 * The applying guide. Each section is a few short points. Facts about tests
 * and deadlines match shared/next/future/colleges.js (2026-27 cycle).
 */
export const GUIDE = [
  {
    id: 'spike',
    title: 'Build a spike, not a list',
    points: [
      'Top CS programs see thousands of applicants with straight As and AP Computer Science A. What separates people is one thing they went unusually deep on.',
      'Two or three deep projects, a research result, or real contest placement beats fifteen clubs you attended. Depth reads as curiosity; breadth reads as box-checking.',
      'A spike does not have to be CS. A strong CS applicant who also runs a serious robotics team or tutors 40 kids a week is memorable.',
      'Leadership means you made something happen for other people: you started the UIL team, taught the intro workshop, kept a project running.',
    ],
  },
  {
    id: 'testing',
    title: 'Testing timeline',
    points: [
      'October of 10th grade: take the PSAT as practice.',
      'October of 11th grade: the PSAT/NMSQT. This one is your entry to National Merit, and Texas cutoffs run high.',
      'Spring of 11th grade: the SAT or ACT. Retake in summer or early fall of 12th grade if needed.',
      'Do not skip it. For 2026-27, MIT, Stanford, Harvard, Yale, Penn, Cornell, Brown, Dartmouth, Johns Hopkins, Caltech, Georgia Tech, Purdue and UT Austin require scores, and CMU\'s School of Computer Science does too. Princeton and Columbia return to requiring them for students entering in fall 2028.',
      'The University of California campuses do not consider SAT or ACT scores at all.',
    ],
  },
  {
    id: 'recs',
    title: 'Recommendation letters',
    points: [
      'Most selective schools want two teacher letters and one from your counselor. Pick teachers from core 11th grade classes; for CS and engineering, one should be math or science.',
      'Ask in the spring of junior year, in person, then follow up with your deadlines in August.',
      'Give each teacher a one-page brag sheet: what you did in their class, a project you are proud of, what you want to study and why.',
      'Meet your counselor before senior year. Their letter is better when they actually know you.',
    ],
  },
  {
    id: 'activities',
    title: 'The activities list',
    points: [
      'The Common App gives you 10 activities and 150 characters to describe each. Order them by importance, not by date.',
      'Lead with a verb and a number. Weak: "Member of coding club, worked on projects." Strong: "Built a Java scheduling app for the tutoring center; 300 sessions booked, 25 tutors use it weekly."',
      'For a CS project, say what it does, who uses it, and what you personally built. Link a live demo or repo in the additional information section.',
      'Contest results go in honors when they are awards (USACO Gold, AIME qualifier, DRSEF placement) and in activities when it is the training you did.',
    ],
  },
  {
    id: 'essays',
    title: 'Essays',
    points: [
      'The personal statement is about who you are, not your resume. A small, specific story beats a big, vague one.',
      'Show how you think. CS applicants often write about a bug or a project; that works only if the essay is really about you.',
      'Supplements ask "why us" and "why this major". Name real things: a professor, a lab, a course, a program you would join.',
      'Write early, rewrite a lot, and read it aloud. Get one or two readers, not ten.',
    ],
  },
  {
    id: 'timeline',
    title: 'Application timeline for senior year',
    points: [
      'August: the Common App opens. Texas public universities also take ApplyTexas.',
      'October 1: the FAFSA and the CSS Profile open. October 15: UT Austin early action.',
      'November 1: most early action and early decision deadlines (MIT, Harvard, Stanford, Yale, Princeton, Penn, Rice, Michigan and more). November 30: University of California.',
      'December 1: UT Austin regular, Texas A&M and UT Dallas priority. January 1 to 15: most regular decision deadlines.',
      'Early decision is binding: if admitted, you go. Early action is not. Restrictive early action (Harvard, Stanford, Yale, Princeton) limits other early applications. Read each school\'s rules.',
    ],
  },
  {
    id: 'money',
    title: 'Paying for it',
    points: [
      'File the FAFSA in October of senior year even if you think you will not qualify; many scholarships require it. Texas students who cannot file the FAFSA use the TASFA.',
      'Many private colleges also require the CSS Profile. Check each school\'s financial aid page for its deadline.',
      'Run every school\'s net price calculator with your family before you build your list. Sticker price is not what most people pay.',
      'Big scholarships to know: Coca-Cola Scholars, Gates, QuestBridge, Jack Kent Cooke, Terry Foundation for Texas schools, and National Merit through the PSAT.',
    ],
  },
  {
    id: 'texas',
    title: 'Texas specifics',
    points: [
      'Top 10% automatic admission covers most Texas public universities. UT Austin limits it further: students entering in 2027 had to be in the top 5%, and UT sets the cutoff each year.',
      'Automatic admission gets you into UT, not into CS. UT Computer Science is a separate, competitive review, so list CS as your first-choice major. First-choice CS applicants can also apply to the Turing Scholars honors program.',
      'Texas A&M reviews every engineering applicant, Top 10% included, for General Engineering first; you enter a major like CS later.',
      'Rice is test optional and has early decision. UT Dallas is next door in Richardson with a December 1 priority deadline for admission and scholarships.',
      'TAMS at UNT is an option in 10th grade: you finish high school as a full-time college student in Denton.',
    ],
  },
];
