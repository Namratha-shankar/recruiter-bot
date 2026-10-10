process.env.DB_PATH = ':memory:'; // must be set before the app/db is loaded

const test = require('node:test');
const assert = require('node:assert');
const { scorePair } = require('../src/services/matchingService');
const app = require('../src/app');

// ---------- unit tests (pure scoring function) ----------
const job = { id: 1, required_skills: ['a', 'b'], min_experience: 4, culture_keywords: ['x', 'y'] };
const base = { id: 1, skills: ['a', 'b'], experience_years: 4, traits: ['x', 'y'], availability: 'Immediate' };

test('perfect candidate scores 100', () => {
  assert.strictEqual(scorePair(base, job).score, 100);
});

test('half the skills lowers skill_score to 0.5', () => {
  const r = scorePair({ ...base, skills: ['a'] }, job);
  assert.strictEqual(r.skill_score, 0.5);
  assert.match(r.reason, /missing b/);
});

test('experience below minimum is scaled linearly', () => {
  assert.strictEqual(scorePair({ ...base, experience_years: 2 }, job).experience_score, 0.5);
});

test('more experience than required does not give extra credit', () => {
  assert.strictEqual(scorePair({ ...base, experience_years: 30 }, job).experience_score, 1);
});

test('"Not looking" ranks below "Immediate" when all else is equal', () => {
  const a = scorePair(base, job).score;
  const b = scorePair({ ...base, availability: 'Not looking' }, job).score;
  assert.ok(a > b);
});

// ---------- integration tests (HTTP, real SQL, in-memory DB) ----------
let server, url;
test.before(async () => {
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  url = `http://127.0.0.1:${server.address().port}`;
  const res = await fetch(`${url}/seed`, { method: 'POST' });
  assert.strictEqual(res.status, 201);
});
test.after(() => server.close());

test('Backend Detective: Sherlock is ranked first', async () => {
  const body = await (await fetch(`${url}/jobs/1/matches`)).json();
  assert.strictEqual(body.matches[0].candidate_name, 'Sherlock H.');
  assert.ok(body.matches[0].score > body.matches[1].score);
});

test('Sales Engineer: Dwight/Michael appear, Sherlock does not', async () => {
  const body = await (await fetch(`${url}/jobs/6/matches`)).json();
  const names = body.matches.map((m) => m.candidate_name);
  assert.ok(names.includes('Michael S.') && names.includes('Dwight S.'));
  assert.ok(!names.includes('Sherlock H.'));
});

test('reverse direction: Rick best matches Rapid Prototyping Engineer', async () => {
  const body = await (await fetch(`${url}/candidates/6/matches`)).json();
  assert.strictEqual(body.matches[0].job_title, 'Rapid Prototyping Engineer');
});

test('404 and 400 handling', async () => {
  assert.strictEqual((await fetch(`${url}/jobs/999/matches`)).status, 404);
  assert.strictEqual((await fetch(`${url}/jobs/abc/matches`)).status, 400);
});

test('POST /candidates validates input and refreshes matches', async () => {
  const bad = await fetch(`${url}/candidates`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  assert.strictEqual(bad.status, 400);

  const ok = await fetch(`${url}/candidates`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Jessica J.', experience_years: 6, availability: 'Immediate',
      skills: ['deduction', 'pattern-recognition', 'forensics'], traits: ['analytical', 'autonomous'] }),
  });
  assert.strictEqual(ok.status, 201);
  const body = await (await fetch(`${url}/jobs/1/matches`)).json();
  assert.ok(body.matches.some((m) => m.candidate_name === 'Jessica J.'));
});
