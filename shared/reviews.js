/**
 * D5: pure rules for code review requests, shared by the Worker and tests.
 * Validation of what a member may ask for and write, nothing that touches the database.
 */
export const LIMITS = {
  snapshotBytes: 20 * 1024, // a workspace file copied into the request; bigger files are refused
  ask: 500,
  comments: 5, // per review
  commentChars: 400,
  reviewMinChars: 40, // total, so "lgtm" cannot be farmed for points
  openRequests: 3, // per member
  acceptedPerRequest: 3,
  paidPerWeek: 3, // mentor payouts per reviewer per 7 days
  reviewsPerDay: 10,
};

const REPO = /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/;

/** https://github.com/owner/repo only (no .git, trailing slash, query or subpage). Returns the clean URL or null. */
export function cleanRepoUrl(input) {
  const m = REPO.exec(String(input ?? '').trim());
  if (!m || m[2] === '.' || m[2] === '..' || m[2].endsWith('.git')) return null;
  return `https://github.com/${m[1]}/${m[2]}`;
}

export const lineCount = (text) => String(text ?? '').split('\n').length;

/** Validates the comments of a review. maxLine is the snapshot's line count, or 0 when lines are not allowed. */
export function cleanComments(input, maxLine) {
  if (!Array.isArray(input) || input.length < 1) return { error: 'Add at least one comment.' };
  if (input.length > LIMITS.comments) return { error: `Keep it to ${LIMITS.comments} comments.` };
  const out = [];
  for (const c of input) {
    const text = String(c?.text ?? '').replace(/[ \t]+/g, ' ').trim();
    if (!text) continue;
    if (text.length > LIMITS.commentChars) return { error: `Each comment must be under ${LIMITS.commentChars} characters.` };
    let line = null;
    if (c?.line !== undefined && c?.line !== null && c?.line !== '') {
      line = Number(c.line);
      if (!maxLine) return { error: 'Line numbers are only for workspace files.' };
      if (!Number.isInteger(line) || line < 1 || line > maxLine) return { error: `Line numbers run from 1 to ${maxLine}.` };
    }
    out.push({ line, text });
  }
  if (!out.length) return { error: 'Add at least one comment.' };
  if (out.reduce((n, c) => n + c.text.length, 0) < LIMITS.reviewMinChars) return { error: `Say a bit more (at least ${LIMITS.reviewMinChars} characters in total).` };
  return { comments: out };
}
