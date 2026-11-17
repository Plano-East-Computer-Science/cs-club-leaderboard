/**
 * The club gateway: an officer-controlled, allowlisted path to GitHub (and
 * PyPI) for school machines, used during meetings.
 *
 * It is deliberately NOT an open proxy:
 *   - every request needs an unexpired gateway code an officer minted;
 *   - only hosts on the allowlist are reachable (anything else gets 403);
 *   - sign-in, sign-up and account-settings paths are blocked, so nobody types
 *     a password into a page served from this domain;
 *   - cookies are never forwarded in either direction;
 *   - writes are limited to git pushes and the GitHub API;
 *   - the audit log keeps only host + time, never paths, queries or headers.
 *
 * URL shape:  /gw/<CODE>/<host>/<path...>
 *   git clone https://peshcompsci.org/gw/<CODE>/github.com/owner/repo.git
 */
import { Hono } from 'hono';

export const gatewayRouter = new Hono(); // public, mounted at /gw
export const gatewayInfoRouter = new Hono(); // public JSON, mounted at /api
export const gatewayAdminRouter = new Hono(); // officers, mounted at /api/admin/hub

/** Overridable from the admin settings table (key: gateway_hosts, comma-separated). */
export const DEFAULT_HOSTS = [
  'github.com',
  'api.github.com',
  'raw.githubusercontent.com',
  'codeload.github.com',
  'objects.githubusercontent.com',
  'github.githubassets.com',
  'avatars.githubusercontent.com',
  'user-images.githubusercontent.com',
  'camo.githubusercontent.com',
  'gist.github.com',
  'gist.githubusercontent.com',
  'pypi.org',
  'files.pythonhosted.org',
  // Search, plus the docs sites programming questions usually land on.
  'www.bing.com',
  'th.bing.com',
  'r.bing.com',
  'docs.python.org',
  'developer.mozilla.org',
  'stackoverflow.com',
  'en.wikipedia.org',
  'docs.github.com',
  'en.cppreference.com',
  'www.w3schools.com',
  'www.geeksforgeeks.org',
  'realpython.com',
  'www.freecodecamp.org',
  'www.programiz.com',
  'www.tutorialspoint.com',
  'learn.microsoft.com',
  'cp-algorithms.com',
];

const MAX_PER_MINUTE = 3000; // per code; a safety valve, not a quota
const MAX_BYTES = 150 * 1024 * 1024;
const GIT_WRITE = /\/(git-upload-pack|git-receive-pack)$/;

// Prefixes that would take a password or change an account.
const BLOCKED_PATH = /^\/(login|logout|session|sessions|signup|join|password_reset|settings|account|sso|users\/[^/]+\/(?:emails|keys)|login\/oauth)(\/|$|\?)/i;

const HOP = new Set(['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'content-length', 'content-encoding']);
// Never relay these from the upstream to the browser.
const DROP_RES = new Set([
  ...HOP,
  'set-cookie',
  'content-security-policy',
  'content-security-policy-report-only',
  'strict-transport-security',
  'x-frame-options',
  'report-to',
  'nel',
]);
// The ONLY request headers sent upstream.
const PASS_REQ = ['accept', 'accept-language', 'content-type', 'git-protocol', 'range', 'if-none-match', 'if-modified-since'];

/* ----------------------------- pure helpers (tested) ---------------------------- */

export function hostsFrom(settingValue) {
  const custom = String(settingValue ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return custom.length ? custom : DEFAULT_HOSTS;
}

/** Validates an officer-entered host list. Returns { hosts } or { error }. */
export function parseHostList(text) {
  const hosts = [...new Set(String(text ?? '').split(/[\s,]+/).map((h) => h.trim().toLowerCase()).filter(Boolean))];
  if (hosts.length > 60) return { error: 'That is a lot of hosts. Keep it under 60.' };
  for (const h of hosts) {
    // Real public hostnames only: a dot, a letter TLD, no ports, paths, wildcards or IPs.
    if (!/^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(h)) return { error: `"${h}" is not a valid hostname.` };
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return { error: `"${h}" is not allowed.` };
  }
  return { hosts };
}

/**
 * Bing result links go through /ck/a?...&u=a1<base64url of the real URL> and
 * then redirect off to the real site, which would leave the gateway. We decode
 * them ourselves. Returns the target URL or null.
 */
export function searchTarget(host, pathname, search) {
  if (host !== 'www.bing.com' || pathname !== '/ck/a') return null;
  const u = new URLSearchParams(search).get('u') ?? '';
  if (!u.startsWith('a1')) return null;
  try {
    const b64 = u.slice(2).replace(/-/g, '+').replace(/_/g, '/');
    const target = new URL(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), 'https://www.bing.com'); // some are Bing-internal, relative
    return target.protocol === 'https:' || target.protocol === 'http:' ? target : null;
  } catch {
    return null;
  }
}

export const isAllowedHost = (hosts, host) => hosts.includes(String(host).toLowerCase());

export const isBlockedPath = (pathname) => BLOCKED_PATH.test(pathname);

/**
 * Turns an upstream URL (possibly relative) into a gateway URL, or null when
 * its host is off the allowlist and should be left alone.
 */
export function toGateway(raw, base, code, hosts) {
  let u;
  try {
    u = new URL(raw, base);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (!isAllowedHost(hosts, u.hostname)) return null;
  return `/gw/${code}/${u.hostname}${u.pathname}${u.search}${u.hash}`;
}

export function methodAllowed(method, host, pathname) {
  if (method === 'GET' || method === 'HEAD') return true;
  if (method === 'POST' && GIT_WRITE.test(pathname)) return true;
  if (host === 'api.github.com') return true; // token-authenticated API calls
  return false;
}

const normCode = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeGatewayCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

async function loadHosts(db) {
  const row = await db.prepare(`SELECT value FROM settings WHERE key = 'gateway_hosts'`).first();
  return hostsFrom(row?.value);
}

const denied = (status, msg) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>Gateway</title>
     <body style="font-family:system-ui;max-width:34rem;margin:4rem auto;padding:0 1rem">
     <h1 style="font-size:1.2rem">Gateway: ${msg}</h1>
     <p>This is the CS Club gateway. It only works with a current code from an officer and only reaches approved sites.</p>
     <p><a href="/gateway">Back to the gateway page</a></p></body>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8' } }
  );

/* --------------------------------- the proxy --------------------------------- */

gatewayRouter.all('/:code', (c) => c.redirect(`/gw/${c.req.param('code')}/github.com/`));

gatewayRouter.all('/:code/:host/*', async (c) => proxy(c, c.req.param('code'), c.req.param('host')));
gatewayRouter.all('/:code/:host', async (c) => proxy(c, c.req.param('code'), c.req.param('host')));

async function proxy(c, rawCode, host) {
  const db = c.env.DB;
  const code = normCode(rawCode);
  host = String(host).toLowerCase();

  const row = await db
    .prepare(
      `SELECT g.expires_at, g.revoked,
              (SELECT COUNT(*) FROM gateway_log l WHERE l.code = g.code AND l.ts > ?) AS recent
       FROM gateway_codes g WHERE g.code = ?`
    )
    .bind(Date.now() - 60_000, code)
    .first();
  if (!row || row.revoked || row.expires_at < Date.now()) return denied(403, 'that code is not active');
  if (row.recent > MAX_PER_MINUTE) return denied(429, 'slow down');

  const hosts = await loadHosts(db);
  if (!isAllowedHost(hosts, host)) return denied(403, `${host} is not on the approved list`);

  const prefix = `/gw/${rawCode}/${c.req.param('host')}`;
  const reqUrl = new URL(c.req.url);
  let path = reqUrl.pathname.slice(prefix.length) || '/';
  if (!path.startsWith('/')) path = `/${path}`;

  if (isBlockedPath(path)) return denied(403, 'sign-in and account pages are blocked here');
  if (!methodAllowed(c.req.method, host, path)) return denied(405, 'that kind of request is not allowed');

  const hit = searchTarget(host, path, reqUrl.search);
  if (hit) {
    const mapped = toGateway(hit.href, hit.href, rawCode, hosts);
    if (!mapped) return denied(403, `${hit.hostname} is not on the approved list. Ask an officer to add it`);
    return c.redirect(mapped);
  }

  const upstream = new URL(`https://${host}${path}${reqUrl.search}`);

  const headers = new Headers();
  for (const h of PASS_REQ) {
    const v = c.req.header(h);
    if (v) headers.set(h, v);
  }
  headers.set('user-agent', c.req.header('user-agent') || 'cs-club-gateway');
  // Credentials pass through ONLY for git and the API, never for page browsing.
  const auth = c.req.header('authorization');
  if (auth && (GIT_WRITE.test(path) || /\/info\/refs$/.test(path) || host === 'api.github.com')) {
    headers.set('authorization', auth);
  }

  let res;
  try {
    res = await fetch(upstream, {
      method: c.req.method,
      headers,
      body: c.req.method === 'GET' || c.req.method === 'HEAD' ? undefined : c.req.raw.body,
      redirect: 'manual',
    });
  } catch {
    return denied(502, `could not reach ${host}`);
  }

  c.executionCtx.waitUntil(
    db
      .prepare('INSERT INTO gateway_log (ts, code, host, status) VALUES (?, ?, ?, ?)')
      .bind(Date.now(), code, host, res.status)
      .run()
      .catch(() => {})
  );

  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_BYTES) return denied(413, 'that file is too large');

  const out = new Headers();
  for (const [k, v] of res.headers) if (!DROP_RES.has(k.toLowerCase())) out.set(k, v);

  const loc = res.headers.get('location');
  if (loc) {
    const mapped = toGateway(loc, upstream, rawCode, hosts);
    if (!mapped) {
      let where = 'another site';
      try { where = new URL(loc, upstream).hostname; } catch { /* keep the generic name */ }
      return denied(403, `${where} is not on the approved list. Ask an officer to add it`);
    }
    out.set('location', mapped);
  }
  // Keep the browser from treating gateway pages as the club site itself.
  out.set('x-robots-tag', 'noindex');
  out.set('referrer-policy', 'no-referrer');

  const type = res.headers.get('content-type') ?? '';
  if (type.includes('text/html')) {
    const rewrite = (name) => ({
      element(el) {
        const v = el.getAttribute(name);
        if (!v) return;
        const m = toGateway(v, upstream, rawCode, hosts);
        if (m) el.setAttribute(name, m);
      },
    });
    const rw = new HTMLRewriter();
    for (const [sel, attr] of [
      ['a[href]', 'href'], ['link[href]', 'href'], ['img[src]', 'src'], ['script[src]', 'src'],
      ['source[src]', 'src'], ['form[action]', 'action'], ['iframe[src]', 'src'], ['video[src]', 'src'],
    ]) rw.on(sel, rewrite(attr));
    rw.on('meta[http-equiv]', {
      element(el) {
        if (/content-security-policy/i.test(el.getAttribute('http-equiv') ?? '')) el.remove();
      },
    });
    rw.on('[integrity]', { element: (el) => el.removeAttribute('integrity') });
    rw.on('head', {
      element(el) {
        el.append(
          `<div style="position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#1b2cc1;color:#fff;font:12px system-ui;padding:4px 10px">` +
            `CS Club gateway &middot; do not enter passwords here &middot; <a style="color:#fff" href="/gateway">help</a></div>`,
          { html: true }
        );
      },
    });
    return rw.transform(new Response(res.body, { status: res.status, headers: out }));
  }

  return new Response(res.body, { status: res.status, headers: out });
}

/* ----------------------------- public info (no secrets) ----------------------------- */

gatewayInfoRouter.get('/gateway/check', async (c) => {
  const code = normCode(c.req.query('code'));
  const row = await c.env.DB
    .prepare('SELECT expires_at, revoked FROM gateway_codes WHERE code = ?')
    .bind(code)
    .first();
  const active = Boolean(row && !row.revoked && row.expires_at > Date.now());
  return c.json({ active, code: active ? code : null, hosts: active ? await loadHosts(c.env.DB) : [] });
});

/* ---------------------------------- officers ---------------------------------- */

gatewayAdminRouter.get('/gateway', async (c) => {
  const now = Date.now();
  const codes = (
    await c.env.DB
      .prepare(
        `SELECT g.code, g.label, g.created_at, g.expires_at, g.revoked,
                (SELECT COUNT(*) FROM gateway_log l WHERE l.code = g.code) AS requests
         FROM gateway_codes g ORDER BY g.created_at DESC LIMIT 20`
      )
      .all()
  ).results.map((r) => ({ ...r, active: !r.revoked && r.expires_at > now }));
  // Housekeeping: the audit log is only useful for a short while.
  c.executionCtx.waitUntil(
    c.env.DB.prepare('DELETE FROM gateway_log WHERE ts < ?').bind(now - 7 * 86_400_000).run().catch(() => {})
  );
  return c.json({ codes, hosts: await loadHosts(c.env.DB) });
});

gatewayAdminRouter.post('/gateway', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const hours = Math.min(Math.max(Number(body?.hours) || 3, 0.25), 12);
  const label = String(body?.label ?? '').trim().slice(0, 60) || 'Meeting';
  const code = makeGatewayCode();
  const now = Date.now();
  await c.env.DB
    .prepare('INSERT INTO gateway_codes (code, label, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .bind(code, label, now, now + hours * 3_600_000)
    .run();
  return c.json({ code, label, expires_at: now + hours * 3_600_000 });
});

/** Replace the approved-host list. An empty list restores the defaults. */
gatewayAdminRouter.put('/gateway/hosts', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = parseHostList(body?.hosts);
  if (parsed.error) return c.json({ error: parsed.error }, 400);
  await c.env.DB
    .prepare(`INSERT INTO settings (key, value) VALUES ('gateway_hosts', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .bind(parsed.hosts.join(','))
    .run();
  return c.json({ hosts: hostsFrom(parsed.hosts.join(',')) });
});

gatewayAdminRouter.post('/gateway/:code/revoke', async (c) => {
  await c.env.DB.prepare('UPDATE gateway_codes SET revoked = 1 WHERE code = ?').bind(normCode(c.req.param('code'))).run();
  return c.json({ ok: true });
});
