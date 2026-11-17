/** Feed parsers run against recorded samples from the live APIs (test/fixtures). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseCtftime, parseHackClubEvents } from '../ingest/sources.js';

const load = (f) => JSON.parse(fs.readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8'));

const raw = load('ctftime-events.json');
const ct = parseCtftime(raw);
assert.ok(ct.length >= 1);
assert.ok(ct.every((o) => o.type === 'competition' && o.format === 'online' && /CTF/.test(o.description)));
assert.ok(ct.every((o) => /^https?:/.test(o.url) && /^\d{4}-\d\d-\d\d$/.test(o.deadline)));
assert.equal(ct.length, raw.filter((e) => !e.onsite).length, 'onsite CTFs are dropped');
assert.deepEqual(parseCtftime(null), []);

const hc = parseHackClubEvents(load('hackclub-events.json'));
assert.ok(hc.length >= 3);
assert.ok(!hc.some((o) => o.title === 'Club Shop'), 'in-person only events are dropped');
assert.ok(hc.every((o) => o.org === 'Hack Club' && o.format === 'online' && o.deadline));
assert.equal(hc.find((o) => o.title === 'Bashed').deadline, '2027-02-28', 'end date is the deadline');
assert.equal(hc.find((o) => o.title === 'Wonders').deadline, '2027-03-01');
assert.deepEqual(parseHackClubEvents({}), []);

console.log('feeds tests passed');
