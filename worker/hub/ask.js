/**
 * Ask (`next` site): a coding tutor for signed-in members, on the Claude API.
 *
 * Off unless the Worker has an ANTHROPIC_API_KEY secret; the page asks
 * GET /api/ask/status and shows nothing when it is off. Every request is
 * signed in, capped per member per day (rate_hits), and size-limited, because
 * each answer costs the club money.
 *
 * The tutor teaches rather than solves: hints and questions first, full
 * solutions to exercises only after the student has tried, and never during a
 * live duel or contest (the room page simply does not offer Ask).
 */
import Anthropic from '@anthropic-ai/sdk';
import { Hono } from 'hono';
import { requireUser } from './users.js';
import { hitOrRefuse } from './ratelimit.js';

export const askRouter = new Hono();

export const ASK_LIMITS = { perDay: 40, messages: 12, chars: 6000, codeChars: 8000 };
const DAY = 86_400_000;
const MODEL = 'claude-opus-5-5';

export const SYSTEM = `You are the coding tutor on the Plano East Senior High School CS Club site (Plano, Texas). The people you talk to are high school students, often beginners; the school teaches Java (AP Computer Science A), and many also use Python.

How to help:
- Teach, do not do. Start with a question or a hint that moves the student one step. Give a full solution to an exercise or practice problem only if the student has clearly tried and asks for it, and then explain it line by line.
- When there is an error message, explain in plain English what it means, point to the line, and say what to check. Do not just rewrite the code.
- Keep answers short: a few sentences, then at most one small code example (under 15 lines). Use Java unless the student's code or question is in Python.
- Match the AP CSA Java subset when the topic is AP CSA (no streams or lambdas unless asked).
- For college, competitions, and career questions, be concrete and honest; say when something depends on the school or the year and suggest the official source.
- Stay on computer science, engineering, math, competitions, and college or career planning. For anything else, say briefly that you can only help with those.
- Never ask for or repeat personal information. If a student seems upset or unsafe, tell them kindly to talk to a trusted adult or school counselor.

Plain text with short paragraphs. Use fenced code blocks for code. No emojis.`;

const str = (v, max) => String(v ?? '').slice(0, max);

/** Validates the body. Returns { error } or { messages, context }. */
export function cleanAsk(body) {
  const raw = Array.isArray(body?.messages) ? body.messages.slice(-ASK_LIMITS.messages) : [];
  const messages = raw
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: str(m.content, ASK_LIMITS.chars) }));
  if (!messages.length || messages.at(-1).role !== 'user') return { error: 'Type a question first.' };
  while (messages[0]?.role !== 'user') messages.shift();
  const ctx = body?.context ?? {};
  const context = {
    where: str(ctx.where, 120),
    title: str(ctx.title, 200),
    lang: ctx.lang === 'python' ? 'python' : 'java',
    code: str(ctx.code, ASK_LIMITS.codeChars),
    error: str(ctx.error, 2000),
  };
  return { messages, context };
}

/** The context the student is looking at, as a short system note after the stable prompt. */
export function contextNote(c) {
  const parts = [];
  if (c.where || c.title) parts.push(`The student is on: ${[c.where, c.title].filter(Boolean).join(', ')}.`);
  if (c.code) parts.push(`Their current ${c.lang === 'python' ? 'Python' : 'Java'} code:\n\`\`\`\n${c.code}\n\`\`\``);
  if (c.error) parts.push(`The last run printed this error:\n${c.error}`);
  return parts.join('\n\n');
}

askRouter.get('/ask/status', (c) => c.json({ enabled: Boolean(c.env.ANTHROPIC_API_KEY), perDay: ASK_LIMITS.perDay }));

askRouter.post('/ask', requireUser, async (c) => {
  if (!c.env.ANTHROPIC_API_KEY) return c.json({ error: 'The tutor is not switched on for this site.' }, 503);
  const parsed = cleanAsk(await c.req.json().catch(() => ({})));
  if (parsed.error) return c.json({ error: parsed.error }, 400);
  const user = c.get('user');
  if (await hitOrRefuse(c.env.DB, `ask:${user.id}`, ASK_LIMITS.perDay, DAY)) {
    return c.json({ error: `That is ${ASK_LIMITS.perDay} questions today. The tutor resets tomorrow.` }, 429);
  }

  const client = new Anthropic({ apiKey: c.env.ANTHROPIC_API_KEY });
  const note = contextNote(parsed.context);
  try {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }, ...(note ? [{ type: 'text', text: note }] : [])],
      messages: parsed.messages,
    });
    if (res.stop_reason === 'refusal') return c.json({ answer: 'I cannot help with that one. Try asking it a different way, or ask an officer.' });
    const answer = res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    return c.json({ answer: answer || 'I did not get an answer that time. Try again.' });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return c.json({ error: 'The tutor is busy. Try again in a minute.' }, 503);
    if (e instanceof Anthropic.AuthenticationError) return c.json({ error: 'The tutor is not set up correctly. Tell an officer.' }, 503);
    console.error('[ask]', e?.status, e?.message);
    return c.json({ error: 'The tutor did not answer. Try again.' }, 502);
  }
});
