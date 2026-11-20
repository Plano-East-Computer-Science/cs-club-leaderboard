/**
 * Forty strong CS and engineering programs, for the college list browser.
 * Checked on the web in November 2026 for the 2026-27 application cycle
 * (students entering fall 2027). Policies change every year, so every record
 * carries `checked` and its sources, and the page tells students to confirm
 * on the school's own site.
 *
 * admit: how you get into CS.
 *   direct  - you are admitted into the CS major (or the CS school) from high school
 *   declare - you are admitted to the university or a college, then must meet
 *             requirements to get into CS later
 *   open    - no admission by major; anyone admitted can choose CS
 *   null    - we could not confirm it; check the school's CS site
 * tests: required | optional | blind (scores not considered) | flexible
 * rate: only where an official source publishes it, with that source.
 *
 * Deadline dates are for the 2026-27 cycle; most schools keep them year to year.
 */

const C = '2026-11';
const TRACKER = 'https://www.deweysmart.com/admissions/test-policy-tracker';
const UC = 'https://admission.universityofcalifornia.edu/how-to-apply/applying-as-a-first-year/filling-out-the-application.html';

export const ADMIT_LABEL = {
  direct: 'Direct admit to CS',
  declare: 'Earn your way into CS',
  open: 'Choose CS after you arrive',
};
export const TEST_LABEL = { required: 'SAT or ACT required', optional: 'Test optional', blind: 'Scores not considered', flexible: 'Test flexible' };

export const COLLEGES = [
  {
    id: 'mit', name: 'MIT', state: 'MA', texas: false,
    cs: 'Computer science lives in EECS (Course 6), with several CS degree tracks and huge undergraduate research access.',
    admit: 'open', admitNote: 'Everyone applies for general admission and picks a major at the end of the first year.',
    tests: 'required', deadlines: [['EA', 'Nov 1'], ['RD', 'Jan 4']],
    sources: [TRACKER, 'https://mitadmissions.org/help/faq/majors/'], checked: C,
  },
  {
    id: 'stanford', name: 'Stanford University', state: 'CA', texas: false,
    cs: 'CS is the most popular major, in the School of Engineering, next door to Silicon Valley.',
    admit: 'open', admitNote: 'No admission by major; students declare by the end of sophomore year.',
    tests: 'required', deadlines: [['REA', 'Nov 1'], ['RD', 'Jan 5']],
    sources: [TRACKER, 'https://news.stanford.edu/stories/2023/04/stanford-undergraduates-travel-varied-paths-toward-major-declaration'], checked: C,
  },
  {
    id: 'cmu', name: 'Carnegie Mellon University', state: 'PA', texas: false,
    cs: 'CS is its own college, the School of Computer Science, with separate majors in CS, AI and more.',
    admit: 'direct', admitNote: 'Apply to the School of Computer Science. Transferring in later is possible but has strict course and GPA rules.',
    tests: 'flexible', testsNote: 'The School of Computer Science requires the SAT or ACT; most other colleges are test flexible.',
    deadlines: [['ED', 'Nov 2'], ['RD', 'Jan 4']],
    sources: [TRACKER, 'https://csd.cmu.edu/guidelines-for-internal-transfer-or-dual-degree'], checked: C,
  },
  {
    id: 'berkeley', name: 'UC Berkeley', state: 'CA', texas: false,
    cs: 'Two routes: EECS (B.S., College of Engineering) or the Computer Science major (B.A., College of Computing, Data Science, and Society).',
    admit: 'direct', admitNote: 'Both EECS and the CS major admit first-years directly. Switching in later is a competitive review.',
    tests: 'blind', testsNote: 'UC does not consider SAT or ACT scores.',
    deadlines: [['UC', 'Nov 30']],
    sources: [UC, 'https://orieladmissions.com/uc-berkeley-eecs-vs-computer-science/'], checked: C,
  },
  {
    id: 'caltech', name: 'Caltech', state: 'CA', texas: false,
    cs: 'Tiny and intensely technical; CS sits in the Computing and Mathematical Sciences department.',
    admit: 'open', admitNote: 'You choose an option (major) after you arrive.',
    tests: 'required', deadlines: [['REA', 'Nov 1'], ['RD', 'Jan 4']],
    sources: [TRACKER], checked: C,
  },
  {
    id: 'gatech', name: 'Georgia Tech', state: 'GA', texas: false,
    cs: 'The College of Computing uses "threads", so you build your CS degree from two focus areas.',
    admit: 'direct', admitNote: 'You are admitted into the major you apply for. First-years cannot change majors, and changing into CS later needs an application.',
    tests: 'required', deadlines: [['EA', 'Nov 2'], ['RD', 'Jan 6']],
    sources: [TRACKER, 'https://www.success.gatech.edu/change-of-major/'], checked: C,
  },
  {
    id: 'uiuc', name: 'University of Illinois Urbana-Champaign', state: 'IL', texas: false,
    cs: 'The Siebel School of Computing and Data Science. Also offers more than 17 blended "CS + X" degrees, which are easier to get into.',
    admit: 'direct', admitNote: 'Pick CS on the application. Moving into a Grainger Engineering major later requires a competitive application.',
    tests: 'optional', deadlines: [['EA', 'Nov 1'], ['RD', 'Jan 5']],
    sources: [TRACKER, 'https://siebelschool.illinois.edu/academics/undergraduate/degree-program-options/cs-x-degree-programs', 'https://transferhandbook.illinois.edu/eng/computer-science/'], checked: C,
  },
  {
    id: 'uw', name: 'University of Washington', state: 'WA', texas: false,
    cs: 'The Paul G. Allen School of Computer Science and Engineering, in Seattle.',
    admit: 'direct', admitNote: 'List CS or Computer Engineering as your first-choice major to be considered for Direct to Major admission. If you are not admitted to it, the school itself says to strongly consider another university.',
    tests: 'optional', deadlines: [['RD', 'Nov 15']],
    rate: { value: '8%', what: 'Direct to Major admission for domestic non-residents, 2026', source: 'https://www.cs.washington.edu/academics/undergraduate/admissions/direct-major/' },
    sources: [TRACKER, 'https://www.cs.washington.edu/academics/undergraduate/admissions/direct-major/'], checked: C,
  },
  {
    id: 'cornell', name: 'Cornell University', state: 'NY', texas: false,
    cs: 'CS is in the Bowers College of Computing and Information Science, offered as a B.S. through Engineering or a B.A. through Arts and Sciences.',
    admit: 'declare', admitNote: 'Apply to Cornell Engineering (for the B.S.) or Arts and Sciences (for the B.A.), then affiliate with CS after the intro courses with at least a 2.5 GPA in them.',
    tests: 'required', deadlines: [['ED', 'Nov 1'], ['RD', 'Jan 2']],
    sources: [TRACKER, 'https://www.cs.cornell.edu/bachelor-science-computer-science/apply', 'https://catalog.cornell.edu/programs/computer-science-bs/'], checked: C,
  },
  {
    id: 'princeton', name: 'Princeton University', state: 'NJ', texas: false,
    cs: 'CS is offered as both a B.S.E. and an A.B.; small, theory-strong department.',
    admit: 'open', admitNote: 'No admission by major.',
    tests: 'optional', testsNote: 'Optional for fall 2027 entry; required starting with fall 2028 entry.',
    deadlines: [['SCEA', 'Nov 1'], ['RD', 'Jan 1']],
    sources: [TRACKER, 'https://admission.princeton.edu/apply/standardized-testing'], checked: C,
  },
  {
    id: 'harvard', name: 'Harvard University', state: 'MA', texas: false,
    cs: 'CS sits in the School of Engineering and Applied Sciences; CS50 started here.',
    admit: 'open', admitNote: 'No admission by major; students pick a concentration later.',
    tests: 'required', deadlines: [['REA', 'Nov 1'], ['RD', 'Jan 1']],
    sources: [TRACKER], checked: C,
  },
  {
    id: 'columbia', name: 'Columbia University', state: 'NY', texas: false,
    cs: 'CS in New York City, through Columbia Engineering or Columbia College.',
    admit: null,
    tests: 'optional', testsNote: 'Optional for fall 2027 entry; required starting with fall 2028 entry.',
    deadlines: [['ED', 'Nov 1'], ['RD', 'Jan 1']],
    sources: [TRACKER, 'https://undergrad.admissions.columbia.edu/testing-policy-update'], checked: C,
  },
  {
    id: 'penn', name: 'University of Pennsylvania', state: 'PA', texas: false,
    cs: 'CS is in Penn Engineering, with well-known combined programs that pair engineering with business.',
    admit: null,
    tests: 'required', deadlines: [['ED', 'Nov 1'], ['RD', 'Jan 5']],
    sources: [TRACKER], checked: C,
  },
  {
    id: 'ucla', name: 'UCLA', state: 'CA', texas: false,
    cs: 'Computer Science and Computer Science and Engineering, both in the Samueli School of Engineering.',
    admit: 'direct', admitNote: 'Apply directly to a Samueli major.',
    tests: 'blind', testsNote: 'UC does not consider SAT or ACT scores.',
    deadlines: [['UC', 'Nov 30']],
    rate: { value: '7.3%', what: 'Computer Science first-year admit rate, fall 2025', source: 'https://admission.ucla.edu/apply/first-year/first-year-profile/2025/major' },
    sources: [UC, 'https://catalog.registrar.ucla.edu/browse/College%20and%20Schools/HenrySamueliSchoolofEngineeringandAppliedScience/Undergraduate-Admission'], checked: C,
  },
  {
    id: 'ucsd', name: 'UC San Diego', state: 'CA', texas: false,
    cs: 'Large, research-heavy Computer Science and Engineering department.',
    admit: 'direct', admitNote: 'CSE is a selective major. Admit into it as a first-year; switching in later goes through a limited selective-major process.',
    tests: 'blind', testsNote: 'UC does not consider SAT or ACT scores.',
    deadlines: [['UC', 'Nov 30']],
    sources: [UC, 'https://cse.ucsd.edu/undergraduate/cse-selective-major-process', 'https://undergrad.ucsd.edu/academics/selective-major-process/selective-major-faq.html'], checked: C,
  },
  {
    id: 'umich', name: 'University of Michigan', state: 'MI', texas: false,
    cs: 'CS is run by the CSE division and offered through both the College of Engineering and LSA.',
    admit: 'declare', admitNote: 'Students in Engineering or LSA declare CS after meeting the declaration requirements.',
    tests: 'optional', testsNote: 'Optional, but Michigan lists scores as recommended.',
    deadlines: [['EA', 'Nov 1'], ['RD', 'Feb 1']],
    sources: [TRACKER, 'https://cse.engin.umich.edu/academics/undergraduate/admissions/'], checked: C,
  },
  {
    id: 'utaustin', name: 'UT Austin', state: 'TX', texas: true,
    cs: 'One of the top public CS programs, with the Turing Scholars honors track and a large research department.',
    admit: 'direct', admitNote: 'Put Computer Science as your first-choice major. Automatic admission gets you into UT, not into CS: CS is a separate, competitive review. First-choice CS applicants can also apply to Turing Scholars.',
    tests: 'required', deadlines: [['EA', 'Oct 15'], ['RD', 'Dec 1']],
    sources: [TRACKER, 'https://admissions.utexas.edu/apply/freshman/', 'https://cns.utexas.edu/info-future-students/faqs-undergrad-applicants', 'https://www.cs.utexas.edu/turing-scholars-honors-program'], checked: C,
  },
  {
    id: 'tamu', name: 'Texas A&M University', state: 'TX', texas: true,
    cs: 'CS and Computer Engineering in the College of Engineering, one of the largest engineering colleges in the country.',
    admit: 'declare', admitNote: 'All engineering applicants, Top 10% students included, are reviewed for General Engineering first, and enter a major such as CS later.',
    tests: 'optional', testsNote: 'Optional for fall 2027; A&M intends to require scores again starting in 2028, pending approval.',
    deadlines: [['RD', 'Dec 1']],
    sources: [TRACKER, 'https://admissions.tamu.edu/apply/freshman/index.html'], checked: C,
  },
  {
    id: 'rice', name: 'Rice University', state: 'TX', texas: true,
    cs: 'Small classes and a residential college system in Houston, with a strong CS department in the School of Engineering.',
    admit: null,
    tests: 'optional', testsNote: 'Recommended but not required.',
    deadlines: [['ED', 'Nov 1'], ['ED2', 'Jan 4'], ['RD', 'Jan 4']],
    sources: [TRACKER], checked: C,
  },
  {
    id: 'utd', name: 'UT Dallas', state: 'TX', texas: true,
    cs: 'A large CS program in Richardson, right next to Plano, with strong merit scholarships.',
    admit: null,
    tests: 'optional', deadlines: [['Priority', 'Dec 1'], ['RD', 'May 1']],
    sources: [TRACKER, 'https://enroll.utdallas.edu/freshman/deadlines-and-fees/', 'https://enroll.utdallas.edu/freshman/application-process/'], checked: C,
  },
  {
    id: 'wisc', name: 'University of Wisconsin-Madison', state: 'WI', texas: false,
    cs: 'Strong systems and databases department.',
    admit: 'declare', admitNote: 'Nobody is admitted directly into CS. You declare after COMP SCI 300, MATH 222 and a minimum grade in intro programming.',
    tests: 'optional', deadlines: [['EA', 'Nov 1'], ['RD', 'Jan 15']],
    sources: [TRACKER, 'https://www.cs.wisc.edu/faqs-for-prospective-students-extended-version/'], checked: C,
  },
  {
    id: 'purdue', name: 'Purdue University', state: 'IN', texas: false,
    cs: 'CS in the College of Science, plus a huge College of Engineering.',
    admit: null,
    tests: 'required', testsNote: 'Purdue says it expects SAT, ACT or CLT scores.',
    deadlines: [['EA', 'Nov 1'], ['RD', 'Jan 15']],
    rate: { value: '37.9%', what: 'College of Engineering admit rate, fall 2026', source: 'https://admissions.purdue.edu/become-student/class-profile/' },
    sources: [TRACKER, 'https://admissions.purdue.edu/become-student/guide/', 'https://admissions.purdue.edu/become-student/class-profile/'], checked: C,
  },
  {
    id: 'umd', name: 'University of Maryland', state: 'MD', texas: false,
    cs: 'Large CS program near Washington, DC, with lots of government and industry research.',
    admit: 'direct', admitNote: 'CS is a Limited Enrollment Program. Freshmen admitted to it must pass gateway courses with a minimum GPA to stay in.',
    tests: 'optional', deadlines: [['EA', 'Nov 1'], ['RD', 'Jan 20']],
    sources: [TRACKER, 'https://www.lep.umd.edu/'], checked: C,
  },
  {
    id: 'umass', name: 'UMass Amherst', state: 'MA', texas: false,
    cs: 'The Manning College of Information and Computer Sciences.',
    admit: null,
    tests: 'optional', deadlines: [['EA', 'Nov 5'], ['RD', 'Jan 15']],
    sources: [TRACKER], checked: C,
  },
  {
    id: 'hmc', name: 'Harvey Mudd College', state: 'CA', texas: false,
    cs: 'A small STEM college with a famous undergraduate-only CS department.',
    admit: null,
    tests: 'optional', testsNote: 'A test-optional pilot; confirm with the college.',
    deadlines: [['ED', 'Nov 15'], ['ED2', 'Jan 5'], ['RD', 'Jan 5']],
    sources: [TRACKER], checked: C,
  },
  {
    id: 'brown', name: 'Brown University', state: 'RI', texas: false,
    cs: 'Open Curriculum, so CS students choose almost all of their own courses.',
    admit: 'open', admitNote: 'No admission by concentration.',
    tests: 'required', deadlines: [['ED', 'Nov 1'], ['RD', 'Jan 5']],
    sources: [TRACKER], checked: C,
  },
  {
    id: 'duke', name: 'Duke University', state: 'NC', texas: false,
    cs: 'Growing CS department, with engineering in the Pratt School.',
    admit: null,
    tests: 'optional', deadlines: [['ED', 'Nov 2'], ['RD', 'Jan 4']],
    sources: [TRACKER], checked: C,
  },
  {
    id: 'northwestern', name: 'Northwestern University', state: 'IL', texas: false,
    cs: 'CS offered through the McCormick School of Engineering and Weinberg College.',
    admit: null,
    tests: 'optional', deadlines: [['ED', 'Nov 1'], ['RD', 'Jan 4']],
    sources: [TRACKER], checked: C,
  },
  {
    id: 'jhu', name: 'Johns Hopkins University', state: 'MD', texas: false,
    cs: 'CS in the Whiting School of Engineering, with strong medical and robotics research.',
    admit: null,
    tests: 'required', deadlines: [['ED', 'Nov 1'], ['ED2', 'Jan 2'], ['RD', 'Jan 2']],
    sources: [TRACKER], checked: C,
  },
  {
    id: 'usc', name: 'University of Southern California', state: 'CA', texas: false,
    cs: 'CS in the Viterbi School of Engineering, plus game development programs.',
    admit: null,
    tests: 'optional', testsNote: 'If you submit scores they must be official.',
    deadlines: [['EA', 'Nov 1'], ['ED', 'Nov 1'], ['RD', 'Jan 10']],
    sources: [TRACKER], checked: C,
  },
  {
    id: 'vt', name: 'Virginia Tech', state: 'VA', texas: false,
    cs: 'Large engineering school with a first-year General Engineering program.',
    admit: null,
    tests: 'optional', deadlines: [['EA', 'Nov 15'], ['RD', 'Jan 15']],
    sources: [TRACKER, 'https://enge.vt.edu/undergraduate/generalengineering.html'], checked: C,
  },
  {
    id: 'neu', name: 'Northeastern University', state: 'MA', texas: false,
    cs: 'The Khoury College of Computer Sciences, built around paid co-op semesters.',
    admit: null,
    tests: 'optional', deadlines: [['ED', 'Nov 1'], ['EA', 'Nov 1'], ['ED2', 'Jan 1'], ['RD', 'Jan 1']],
    sources: [TRACKER], checked: C,
  },
  {
    id: 'washu', name: 'Washington University in St. Louis', state: 'MO', texas: false,
    cs: 'CS in the McKelvey School of Engineering.',
    admit: null,
    tests: 'optional', deadlines: [['ED', 'Nov 2'], ['ED2', 'Jan 4'], ['RD', 'Jan 4']],
    sources: [TRACKER], checked: C,
  },
  {
    id: 'yale', name: 'Yale University', state: 'CT', texas: false,
    cs: 'A smaller CS department inside a liberal arts college.',
    admit: 'open', admitNote: 'No admission by major.',
    tests: 'required', testsNote: 'Yale ended test-flexible: an SAT or ACT score is required starting this cycle.',
    deadlines: [['SCEA', 'Nov 1'], ['RD', 'Jan 2']],
    sources: [TRACKER], checked: C,
  },
  {
    id: 'dartmouth', name: 'Dartmouth College', state: 'NH', texas: false,
    cs: 'Small CS department; BASIC was invented here.',
    admit: 'open', admitNote: 'No admission by major.',
    tests: 'required', deadlines: [['ED', 'Nov 1'], ['RD', 'Jan 1']],
    sources: [TRACKER], checked: C,
  },
  {
    id: 'uci', name: 'UC Irvine', state: 'CA', texas: false,
    cs: 'The Donald Bren School of Information and Computer Sciences, a whole school for computing.',
    admit: null,
    tests: 'blind', testsNote: 'UC does not consider SAT or ACT scores.',
    deadlines: [['UC', 'Nov 30']],
    sources: [UC], checked: C,
  },
  {
    id: 'umn', name: 'University of Minnesota Twin Cities', state: 'MN', texas: false,
    cs: 'CS in the College of Science and Engineering.',
    admit: null,
    tests: 'optional', testsNote: 'Optional through fall 2029 entry.',
    deadlines: [['EA', 'Nov 1'], ['EA2', 'Dec 1'], ['RD', 'Jan 1']],
    sources: [TRACKER], checked: C,
  },
  {
    id: 'rpi', name: 'Rensselaer Polytechnic Institute', state: 'NY', texas: false,
    cs: 'One of the oldest technological universities in the US.',
    admit: null,
    tests: 'optional', deadlines: [['ED', 'Nov 1'], ['EA', 'Dec 1'], ['ED2', 'Jan 6'], ['RD', 'Jan 15']],
    sources: [TRACKER], checked: C,
  },
  {
    id: 'nyu', name: 'New York University', state: 'NY', texas: false,
    cs: 'CS through the College of Arts and Science (Courant) or the Tandon School of Engineering.',
    admit: null,
    tests: 'optional', testsNote: 'Test optional through the 2027-28 cycle.',
    deadlines: [['ED', 'Nov 1'], ['ED2', 'Jan 1'], ['RD', 'Jan 5']],
    sources: [TRACKER], checked: C,
  },
  {
    id: 'osu', name: 'Ohio State University', state: 'OH', texas: false,
    cs: 'Large Computer Science and Engineering department in the College of Engineering.',
    admit: null,
    tests: 'required', deadlines: [['EA', 'Nov 1'], ['RD', 'Jan 15']],
    sources: [TRACKER], checked: C,
  },
];
