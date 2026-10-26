import test from 'node:test';
import assert from 'node:assert/strict';
import { accessStatus, createAccessHandler } from '../lib/access-server.mjs';

const origin = 'https://course.example';
const password = 'sample-code13';
const request = (body, headers = {}, host = origin) => new Request(`${host}/api/access`, {
  method: 'POST', headers: { origin: host, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
});

test('Settings validates a 13-character code without provider configuration or returning credentials', async () => {
  const env = () => ({ code: ` ${password} ` });
  const handle = createAccessHandler({ env });
  for (const submitted of ['', 'wrong-password', password + 'x']) {
    const response = await handle(request({ accessCode: submitted }));
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.code, 'ACCESS_REQUIRED');
    assert.ok(!JSON.stringify(body).includes(password));
  }
  const response = await handle(request({ accessCode: password }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('set-cookie'), null);
  assert.deepEqual(await response.json(), { verified: true, accessCodeRequired: true, accessCodeConfigured: true });
  assert.deepEqual(await accessStatus(new Request(`${origin}/api/access`), env()).json(), { accessCodeRequired: true, accessCodeConfigured: true });
});

test('Settings validation shares lowercase precedence, legacy fallback and 12–256 length limits', async () => {
  for (const length of [12, 13, 256]) {
    const code = 'x'.repeat(length), env = () => ({ code });
    assert.equal((await createAccessHandler({ env })(request({ accessCode: code }))).status, 200);
  }
  for (const code of ['', 'x'.repeat(11), 'x'.repeat(257)]) {
    const response = await createAccessHandler({ env: () => ({ code }) })(request({ accessCode: code }));
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, 'ACCESS_NOT_CONFIGURED');
  }
  const legacy = 'legacy-test-password';
  assert.equal((await createAccessHandler({ env: () => ({ code: ' ', TUTOR_ACCESS_CODE: legacy }) })(request({ accessCode: legacy }))).status, 200);
  assert.equal((await createAccessHandler({ env: () => ({ code: password, TUTOR_ACCESS_CODE: legacy }) })(request({ accessCode: legacy }))).status, 401);
});

test('Settings distinguishes direct local use from public, Vercel and forwarded requests', async () => {
  const local = 'http://127.0.0.1:3000', env = () => ({});
  assert.equal((await createAccessHandler({ env })(request({ accessCode: '' }, {}, local))).status, 200);
  assert.equal((await createAccessHandler({ env })(request({ accessCode: '' }))).status, 503);
  assert.equal((await createAccessHandler({ env })(request({ accessCode: '' }, { 'x-forwarded-for': '203.0.113.1' }, local))).status, 503);
  assert.equal((await createAccessHandler({ env: () => ({ VERCEL: '1' }) })(request({ accessCode: '' }, {}, local))).status, 503);
  assert.deepEqual(await accessStatus(new Request(`${local}/api/access`), {}).json(), { accessCodeRequired: false, accessCodeConfigured: false });
});

test('Settings rejects cross-origin, malformed and oversized requests', async () => {
  const handle = createAccessHandler({ env: () => ({ code: password }) });
  for (const value of ['https://other.example', 'null', 'file://course.example', '']) assert.equal((await handle(request({ accessCode: password }, { origin: value }))).status, 403);
  assert.equal((await handle(request({ accessCode: password }, { 'content-type': 'text/plain' }))).status, 415);
  for (const body of [null, [], {}, { accessCode: 123 }]) assert.equal((await handle(request(body))).status, 400);
  assert.equal((await handle(request({ accessCode: 'x'.repeat(3000) }))).status, 413);
  const malformed = new Request(`${origin}/api/access`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: '{' });
  assert.equal((await handle(malformed)).status, 400);
});

test('Settings limits repeated checks, ignores forged IPs and permits retry after cooldown', async () => {
  let instant = 100000;
  const handle = createAccessHandler({ env: () => ({ code: password }), now: () => instant });
  for (let index = 0; index < 10; index++) assert.equal((await handle(request({ accessCode: 'wrong' }, { 'x-forwarded-for': `203.0.113.${index}` }))).status, 401);
  const limited = await handle(request({ accessCode: password }));
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get('retry-after'), '60');
  instant += 60000;
  assert.equal((await handle(request({ accessCode: password }))).status, 200);
});
