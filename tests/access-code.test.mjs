import test from 'node:test';
import assert from 'node:assert/strict';
import { createTutorHandler, tutorStatus } from '../lib/tutor-server.mjs';
import { createSearchHandler, searchStatus } from '../lib/search-server.mjs';
import { createVoiceHandlers } from '../lib/voice-server.mjs';

const local = 'http://127.0.0.1:3000';
const publicOrigin = 'https://course.example';
const currentCode = 'current-private-access-code';
const legacyCode = 'legacy-private-access-code';
const providerEnv = { OPENROUTER_API_KEY: 'test-chat-credential', GROQ_API_KEY: 'test-voice-credential' };
const endpoints = ['tutor', 'search', 'speak', 'transcribe'];

function jsonRequest(path, body, origin = local) {
  return new Request(`${origin}/api/${path}`, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

function recording(accessCode, origin = local) {
  const body = new FormData();
  body.set('file', new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0])], { type: 'audio/webm' }), 'question.webm');
  body.set('durationMs', '1000'); body.set('language', 'en');
  if (accessCode !== undefined) body.set('accessCode', accessCode);
  return new Request(`${origin}/api/voice/transcribe`, { method: 'POST', headers: { origin }, body });
}

function wave() {
  const data = Buffer.alloc(46);
  data.write('RIFF'); data.writeUInt32LE(38, 4); data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16);
  data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(24000, 24); data.writeUInt32LE(48000, 28);
  data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(2, 40);
  data.writeInt16LE(100, 44);
  return data;
}

// Every provider boundary is injected. These tests never read environment files
// or make a network request, even when exercising successful authorization.
function setup(settings) {
  const configuration = { ...providerEnv, ...settings };
  const calls = Object.fromEntries(endpoints.map(name => [name, 0]));
  const generate = name => async messages => {
    calls[name]++;
    for (const value of [currentCode, legacyCode]) assert.ok(!JSON.stringify(messages).includes(value));
    return { answer: 'The server verifies the payment before changing an order.', provider: 'stub', model: 'stub' };
  };
  const tutor = createTutorHandler({ env: () => configuration, generate: generate('tutor') });
  const search = createSearchHandler({ env: () => configuration, generate: generate('search'), makeIndex: value => value, search: () => ({ results: [] }) });
  const voice = createVoiceHandlers({ env: () => configuration, fetchImpl: async (url, options) => {
    if (url.endsWith('/audio/transcriptions')) {
      calls.transcribe++;
      assert.equal(options.body.get('accessCode'), null);
      return Response.json({ text: 'Why should the server verify a payment?', duration: 1 });
    }
    assert.ok(url.endsWith('/audio/speech'));
    calls.speak++;
    assert.equal(JSON.parse(options.body).accessCode, undefined);
    return new Response(wave(), { headers: { 'content-type': 'audio/wav' } });
  } });
  return {
    calls,
    status: (name, origin = local) => name === 'voice'
      ? voice.status(new Request(`${origin}/api/voice/speak`))
      : (name === 'search' ? searchStatus : tutorStatus)(new Request(`${origin}/api/${name}`), configuration),
    request: (name, accessCode, origin = local) => {
      const access = accessCode === undefined ? {} : { accessCode };
      if (name === 'transcribe') return voice.transcribe(recording(accessCode, origin));
      if (name === 'speak') return voice.speak(jsonRequest('voice/speak', { text: 'The server verifies the payment.', ...access }, origin));
      const body = { question: 'Why must the server verify a payment?', ...access };
      return (name === 'search' ? search : tutor)(jsonRequest(name, body, origin));
    },
  };
}

async function assertDenied(response, status = 401, code = 'ACCESS_REQUIRED') {
  assert.equal(response.status, status);
  const body = await response.json();
  assert.equal(body.code, code);
  for (const value of [currentCode, legacyCode, ...Object.values(providerEnv)]) assert.ok(!JSON.stringify(body).includes(value));
}

test('lowercase code requires access locally and all status responses expose only safe metadata', async () => {
  const app = setup({ code: `  ${currentCode}  `, TUTOR_ACCESS_CODE: legacyCode });
  for (const origin of [local, publicOrigin]) {
    for (const name of ['tutor', 'search', 'voice']) {
      const response = app.status(name, origin);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.configured, true);
      assert.equal(body.accessCodeRequired, true);
      for (const value of [currentCode, legacyCode, ...Object.values(providerEnv)]) assert.ok(!JSON.stringify(body).includes(value));
      assert.deepEqual(Object.keys(body).sort(), (name === 'voice'
        ? ['configured', 'accessCodeRequired', 'maxSeconds', 'maxAudioBytes', 'maxSpeechCharacters']
        : ['configured', 'accessCodeRequired', 'providers']).sort());
    }
  }
});

test('lowercase code denies missing and wrong values before tutor, search and both voice providers', async () => {
  const app = setup({ code: `  ${currentCode}\n` });
  for (const name of endpoints) {
    await assertDenied(await app.request(name));
    await assertDenied(await app.request(name, 'wrong-access-value'));
    assert.equal(app.calls[name], 0, `${name} must not reach a provider before authentication`);
    assert.equal((await app.request(name, currentCode)).status, 200, `${name} accepts the trimmed configured code`);
    assert.equal(app.calls[name], 1, `${name} reaches its injected provider after authentication`);
  }
});

test('a nonempty lowercase code takes precedence over the legacy access code on every endpoint', async () => {
  const app = setup({ code: currentCode, TUTOR_ACCESS_CODE: legacyCode });
  for (const name of endpoints) {
    await assertDenied(await app.request(name, legacyCode));
    assert.equal(app.calls[name], 0);
    assert.equal((await app.request(name, currentCode)).status, 200);
    assert.equal(app.calls[name], 1);
  }
});

for (const [label, settings] of [
  ['absent lowercase code', { TUTOR_ACCESS_CODE: `  ${legacyCode}\n` }],
  ['blank lowercase code', { code: ' \t\n ', TUTOR_ACCESS_CODE: `  ${legacyCode}\n` }],
]) {
  test(`${label} preserves trimmed legacy fallback for status and every endpoint`, async () => {
    const app = setup(settings);
    for (const name of ['tutor', 'search', 'voice']) assert.equal((await app.status(name).json()).accessCodeRequired, true);
    for (const name of endpoints) {
      await assertDenied(await app.request(name));
      await assertDenied(await app.request(name, currentCode));
      assert.equal(app.calls[name], 0);
      assert.equal((await app.request(name, legacyCode)).status, 200);
      assert.equal(app.calls[name], 1);
    }
  });
}

test('a short lowercase code blocks all protected actions instead of falling back to a strong legacy code', async () => {
  const app = setup({ code: ' short ', TUTOR_ACCESS_CODE: legacyCode });
  for (const name of ['tutor', 'search', 'voice']) assert.equal((await app.status(name).json()).accessCodeRequired, true);
  for (const name of endpoints) {
    for (const submitted of [undefined, 'short', legacyCode]) await assertDenied(await app.request(name, submitted), 503, 'ACCESS_NOT_CONFIGURED');
    assert.equal(app.calls[name], 0);
  }
});

test('blank access settings preserve local operation while public requests require owner configuration', async () => {
  const app = setup({ code: '  ', TUTOR_ACCESS_CODE: '\t' });
  for (const name of ['tutor', 'search', 'voice']) {
    assert.equal((await app.status(name).json()).accessCodeRequired, false);
    assert.equal((await app.status(name, publicOrigin).json()).accessCodeRequired, true);
  }
  for (const name of endpoints) {
    await assertDenied(await app.request(name, undefined, publicOrigin), 503, 'ACCESS_NOT_CONFIGURED');
    assert.equal(app.calls[name], 0);
    assert.equal((await app.request(name)).status, 200);
    assert.equal(app.calls[name], 1);
  }
});

test('access code length boundaries work consistently across every AI endpoint', async () => {
  for (const size of [12, 13, 256]) {
    const value = 'a'.repeat(size);
    const app = setup({ code: value });
    for (const name of endpoints) assert.equal((await app.request(name, value)).status, 200);
  }
  const value = 'a'.repeat(257);
  const app = setup({ code: value });
  for (const name of endpoints) {
    await assertDenied(await app.request(name, value), 503, 'ACCESS_NOT_CONFIGURED');
    assert.equal(app.calls[name], 0);
  }
});
