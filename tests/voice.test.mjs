import test from 'node:test';
import assert from 'node:assert/strict';
import { combineSpeechWav, createVoiceHandlers, MAX_AUDIO_BYTES, readVoiceKeys, splitSpeechText, validateSpeechInput } from '../lib/voice-server.mjs';

const local = 'http://127.0.0.1:3000';
const fakeEnv = { GROQ_API_KEYS: 'test-key-one,test-key-two' };
function speech(body = { text: 'The server validates the request.' }, { origin = local, host, url = local, ...extra } = {}) {
  return new Request(`${url}/api/voice/speak`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...(host ? { host } : {}) }, body: JSON.stringify(body), ...extra });
}
function recording({ data = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]), type = 'audio/webm', duration = 2000, language = 'en', accessCode = '', url = local } = {}) {
  const form = new FormData();
  form.set('file', new Blob([data], { type }), 'my-recording.webm'); form.set('durationMs', String(duration)); form.set('language', language); form.set('accessCode', accessCode);
  return new Request(`${url}/api/voice/transcribe`, { method: 'POST', headers: { Origin: url }, body: form });
}
function wave(samples = [100, -100], rate = 24000) {
  const data = Buffer.alloc(44 + samples.length * 2);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WAVEfmt ', 8); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22); data.writeUInt32LE(rate, 24); data.writeUInt32LE(rate * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34); data.write('data', 36); data.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => data.writeInt16LE(sample, 44 + index * 2)); return data;
}

test('speech splitting preserves readable text and respects provider limits', () => {
  const text = ('Validate each request before changing the order. Keep the event ID to detect duplicates. ').repeat(12).trim();
  const chunks = splitSpeechText(text);
  assert.ok(chunks.length > 1); assert.ok(chunks.every(chunk => chunk.length <= 200 && chunk.length > 0));
  assert.equal(chunks.join(' '), text);
  assert.deepEqual(splitSpeechText('x'.repeat(410)).map(chunk => chunk.length), [200, 200, 10]);
  assert.throws(() => validateSpeechInput(null)); assert.throws(() => validateSpeechInput({ text: 'x'.repeat(2001) })); assert.throws(() => validateSpeechInput({ text: 'Hi', language: 'unknown' }));
  assert.deepEqual(readVoiceKeys({ GROQ_API_KEY: ' alpha, alpha , beta ' }), ['alpha', 'beta']);
});

test('PCM speech chunks combine into a valid WAV and reject incompatible formats', () => {
  const combined = combineSpeechWav([wave([1, -1]), wave([22, -22])]);
  assert.equal(combined.toString('ascii', 0, 4), 'RIFF'); assert.equal(combined.readUInt32LE(4), combined.length - 8); assert.equal(combined.readUInt32LE(40), 8);
  assert.deepEqual([44, 46, 48, 50].map(offset => combined.readInt16LE(offset)), [1, -1, 22, -22]);
  assert.throws(() => combineSpeechWav([wave(), wave([1], 48000)])); assert.throws(() => combineSpeechWav([Buffer.from('not audio')]));
});

test('voice rejects foreign origins, missing public access codes and malformed bodies before providers', async () => {
  let calls = 0;
  const handlers = createVoiceHandlers({ env: () => ({ ...fakeEnv, TUTOR_ACCESS_CODE: 'sixteen-plus-character-code' }), fetchImpl: async () => { calls++; return new Response(wave()); } });
  assert.equal((await handlers.speak(speech({}, { origin: 'https://other.example' }))).status, 403);
  assert.equal((await handlers.speak(speech({}, { origin: 'null' }))).status, 403);
  assert.equal((await handlers.speak(speech({ text: 'A request' }, { url: 'https://course.example', origin: 'https://course.example' }))).status, 401);
  assert.equal((await handlers.speak(speech(null))).status, 400);
  assert.equal((await handlers.speak(speech({ text: 'A request', accessCode: 'wrong' }))).status, 401);
  assert.equal(calls, 0);
  const valid = await handlers.speak(speech({ text: 'A request', accessCode: 'sixteen-plus-character-code' }, { url: local, host: 'course.example', origin: 'https://course.example' }));
  assert.equal(valid.status, 200); assert.equal(calls, 1);
});

test('public voice requires configured protection and local missing provider offers fallback', async () => {
  const handlers = createVoiceHandlers({ env: () => ({}), fetchImpl: () => assert.fail('No external request expected') });
  const publicResult = await handlers.speak(speech({ text: 'Question' }, { url: 'https://course.example', origin: 'https://course.example' }));
  assert.equal(publicResult.status, 503); assert.equal((await publicResult.json()).code, 'ACCESS_NOT_CONFIGURED');
  const missing = await handlers.speak(speech()); assert.equal(missing.status, 503); assert.equal((await missing.json()).code, 'VOICE_NOT_CONFIGURED');
  const status = await handlers.status(new Request(`${local}/api/voice/transcribe`));
  const data = await status.json(); assert.equal(data.configured, false); assert.equal(data.maxSeconds, 60); assert.equal(data.maxSpeechCharacters, 2000);
});

test('recording validates MIME, magic, duration and real byte count without trusting Content-Length', async () => {
  let calls = 0;
  const handlers = createVoiceHandlers({ env: () => fakeEnv, fetchImpl: () => { calls++; throw new Error('Should not call provider'); } });
  assert.equal((await handlers.transcribe(recording({ type: 'text/plain' }))).status, 415);
  assert.equal((await handlers.transcribe(recording({ data: 'fake webm' }))).status, 415);
  assert.equal((await handlers.transcribe(recording({ duration: 60001 }))).status, 400);
  assert.equal((await handlers.transcribe(recording({ data: new Uint8Array(MAX_AUDIO_BYTES + 1) }))).status, 413);
  const oversized = speech({ text: 'x'.repeat(17000) }); oversized.headers.set('content-length', '1');
  assert.equal((await handlers.speak(oversized)).status, 413); assert.equal(calls, 0);
});

test('transcription sends only audio plus model hints, returns a reviewable bounded transcript', async () => {
  let called = false;
  const handlers = createVoiceHandlers({ env: () => ({ ...fakeEnv, TUTOR_ACCESS_CODE: 'sixteen-plus-character-code' }), fetchImpl: async (url, options) => {
    called = true; assert.equal(url, 'https://api.groq.com/openai/v1/audio/transcriptions');
    assert.equal(options.headers.Authorization, 'Bearer test-key-one'); assert.equal(options.redirect, 'error'); assert.equal(options.body.get('model'), 'whisper-large-v3-turbo'); assert.equal(options.body.get('response_format'), 'verbose_json');
    assert.equal(options.body.get('accessCode'), null); assert.equal(options.body.get('language'), null); assert.equal(options.body.get('file').name, 'question.webm');
    return Response.json({ text: `  ${'a'.repeat(2010)}  `, duration: 2 });
  } });
  const response = await handlers.transcribe(recording({ language: 'hinglish', accessCode: 'sixteen-plus-character-code' }));
  const result = await response.json(); assert.equal(response.status, 200); assert.equal(result.text.length, 2000); assert.equal(result.truncated, true); assert.equal(called, true); assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('provider-reported long recording is rejected and provider error bodies are never exposed', async () => {
  const long = createVoiceHandlers({ env: () => fakeEnv, fetchImpl: async () => Response.json({ text: 'Question', duration: 70 }) });
  assert.equal((await long.transcribe(recording())).status, 422);
  let calls = 0;
  const invalid = createVoiceHandlers({ env: () => fakeEnv, fetchImpl: async () => { calls++; return new Response('private upstream detail test-key-one', { status: 400 }); } });
  const response = await invalid.speak(speech()); assert.equal(response.status, 503); assert.equal(calls, 1); assert.doesNotMatch(await response.text(), /private upstream|test-key/);
});

test('natural speech chunks use the documented voice and combine sequential WAV results', async () => {
  const calls = [];
  const handlers = createVoiceHandlers({ env: () => fakeEnv, fetchImpl: async (url, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    assert.equal(url, 'https://api.groq.com/openai/v1/audio/speech'); assert.equal(body.model, 'canopylabs/orpheus-v1-english'); assert.equal(body.voice, 'hannah'); assert.equal(body.response_format, 'wav'); assert.ok(body.input.length <= 200); assert.equal(body.accessCode, undefined);
    return new Response(wave([calls.length]));
  } });
  const response = await handlers.speak(speech({ text: 'Keep an event ID so duplicates are handled once. '.repeat(14) }));
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'audio/wav'); assert.ok(calls.length > 1);
  const data = Buffer.from(await response.arrayBuffer()); assert.equal(data.readUInt32LE(40), calls.length * 2);
});

test('model terms errors produce a safe setup message without accepting terms or retrying keys', async () => {
  let calls = 0;
  const handlers = createVoiceHandlers({ env: () => fakeEnv, fetchImpl: async () => {
    calls++; return Response.json({ error: { code: 'model_terms_required', message: 'private upstream detail test-key-one https://untrusted.example/terms' } }, { status: 400 });
  } });
  const response = await handlers.speak(speech());
  const result = await response.json();
  assert.equal(response.status, 503); assert.equal(result.code, 'VOICE_TERMS_REQUIRED'); assert.match(result.error, /organization administrator/); assert.doesNotMatch(result.error, /test-key|private upstream|untrusted/); assert.equal(calls, 1);
  const oversized = createVoiceHandlers({ env: () => fakeEnv, fetchImpl: async () => new Response(JSON.stringify({ error: { code: 'model_terms_required', message: 'x'.repeat(9000) } }), { status: 400 }) });
  const bounded = await oversized.speak(speech()); assert.equal((await bounded.json()).code, 'VOICE_PROVIDER_SETUP');
});

test('voice keys fail over on limits, honor cooldowns and never claim additional quota', async () => {
  let clock = 1000000; const attempts = [];
  const handlers = createVoiceHandlers({ env: () => fakeEnv, now: () => clock, fetchImpl: async (_url, options) => {
    attempts.push(options.headers.Authorization);
    if (options.headers.Authorization.endsWith('one')) return new Response('private rate detail', { status: 429, headers: { 'Retry-After': '120' } });
    return new Response(wave());
  } });
  assert.equal((await handlers.speak(speech())).status, 200);
  assert.deepEqual(attempts, ['Bearer test-key-one', 'Bearer test-key-two']);
  clock += 61000;
  assert.equal((await handlers.speak(speech())).status, 200); assert.equal(attempts.at(-1), 'Bearer test-key-two'); assert.equal(attempts.length, 3);
  clock += 60000;
  assert.equal((await handlers.speak(speech())).status, 200); assert.equal(attempts.length, 5);
});

test('voice has shared in-process action limits and frees concurrent slots after failure', async () => {
  let calls = 0;
  const handlers = createVoiceHandlers({ env: () => fakeEnv, now: () => 1000000, fetchImpl: async () => { calls++; return new Response(wave()); } });
  for (let index = 0; index < 8; index++) assert.equal((await handlers.speak(speech())).status, 200);
  const limited = await handlers.speak(speech()); assert.equal(limited.status, 429); assert.equal(limited.headers.get('retry-after'), '60'); assert.equal(calls, 8);

  const releases = [];
  const concurrent = createVoiceHandlers({ env: () => fakeEnv, fetchImpl: () => new Promise(resolve => releases.push(() => resolve(new Response(wave())))) });
  const first = concurrent.speak(speech()), second = concurrent.speak(speech());
  while (releases.length < 2) await new Promise(resolve => setImmediate(resolve));
  assert.equal((await concurrent.speak(speech())).status, 429);
  releases.splice(0).forEach(release => release());
  assert.equal((await first).status, 200); assert.equal((await second).status, 200);
  const third = concurrent.speak(speech());
  while (!releases.length) await new Promise(resolve => setImmediate(resolve));
  releases.shift()(); assert.equal((await third).status, 200);
});
