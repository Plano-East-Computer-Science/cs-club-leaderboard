/**
 * CTF board (C11), pure parts: categories, points and checking a member's
 * challenge before it is stored. Shared so the form and the Worker agree.
 */
export const CATEGORIES = ['crypto', 'web', 'forensics', 'reversing', 'misc'];

/** Scoreboard points by difficulty (1 easy, 3 hard). Separate from ledger points. */
export const ctfPoints = (difficulty) => ({ 1: 50, 2: 100, 3: 200 })[difficulty] ?? 50;

const MAX = { title: 80, body: 4000, hint: 300, file: 20_000, flag: 100 };

/** Input from the author form -> { error } or { value } (flag still plain here; the route hashes it). */
export function validateChallenge(input) {
  const b = input && typeof input === 'object' ? input : {};
  const str = (v) => (typeof v === 'string' ? v : '');
  const title = str(b.title).trim();
  if (!title || title.length > MAX.title) return { error: `Give it a title (up to ${MAX.title} characters).` };
  const category = str(b.category);
  if (!CATEGORIES.includes(category)) return { error: `Category is one of: ${CATEGORIES.join(', ')}.` };
  const difficulty = Number(b.difficulty);
  if (![1, 2, 3].includes(difficulty)) return { error: 'Difficulty is 1, 2 or 3.' };
  const body = str(b.body).trim();
  if (!body || body.length > MAX.body) return { error: `Write what the player is asked to do (up to ${MAX.body} characters).` };
  const hint = str(b.hint).trim();
  if (hint.length > MAX.hint) return { error: `The hint is limited to ${MAX.hint} characters.` };
  const file_data = str(b.file_data);
  if (file_data.length > MAX.file) return { error: 'The file is limited to 20,000 characters of text.' };
  const file_name = str(b.file_name).trim();
  if (file_name && !/^[\w][\w .-]{0,59}$/.test(file_name)) return { error: 'File name: letters, numbers, dots and dashes, up to 60 characters.' };
  const flag = str(b.flag).trim();
  if (flag.length < 4 || flag.length > MAX.flag) return { error: `The flag must be 4 to ${MAX.flag} characters.` };
  // A flag pasted into the visible text would hand the answer to everyone.
  if (`${title} ${body} ${hint}`.toLowerCase().includes(flag.toLowerCase())) {
    return { error: 'The flag appears in the title, description or hint. Take it out.' };
  }
  return { value: { title, category, difficulty, body, hint, file_data, file_name: file_data ? file_name || 'challenge.txt' : '', flag } };
}
