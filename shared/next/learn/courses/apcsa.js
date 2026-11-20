/**
 * AP Computer Science A, following the College Board course framework
 * effective fall 2025: four units (Using Objects and Methods 15-25% of the
 * exam, Selection and Iteration 25-35%, Class Creation 10-18%, Data
 * Collections 30-40%), plus free-response practice in the exam's four
 * question types. One file per lesson under ./apcsa/.
 */
import unit1 from './apcsa/unit1.js';
import unit2 from './apcsa/unit2.js';
import unit3 from './apcsa/unit3.js';
import unit4 from './apcsa/unit4.js';
import exam from './apcsa/exam.js';

export default {
  id: 'apcsa',
  title: 'AP Computer Science A',
  blurb: 'The whole AP CSA course in Java, the way Plano East teaches it: every idea explained, run, tested and practiced, then free-response practice for the exam.',
  lang: 'java',
  level: 'Beginner to AP exam',
  units: [unit1, unit2, unit3, unit4, exam],
};
