import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderRouter, readAIConfig } from '../lib/ai-providers.mjs';

const messages = [{ role: 'system', content: 'Use course facts.' }, { role: 'user', content: 'Explain payment verification.' }];
const config = readAIConfig({ OPENROUTER_API_KEYS: 'first,second', GEMINI_API_KEY: 'third', GROQ_API_KEY: 'fourth' });
const ok = () => Response.json({ choices: [{ message: { content: 'The payment is verified by the trusted server before fulfillment. [Lesson 37]' } }] });

test('configuration deduplicates bounded key pools and never accepts inherited provider names', () => {
  const result = readAIConfig({ AI_PROVIDER_ORDER: 'toString,groq,groq,gemini', GROQ_API_KEYS: 'abc,abc,def', GEMINI_API_KEY: 'replace_me', AI_MAX_OUTPUT_TOKENS: '99999' });
  assert.deepEqual(result.providers.map(p => p.name), ['groq']);
  assert.deepEqual(result.providers[0].keys, ['abc', 'def']);
  assert.equal(result.maxTokens, 1600);
});

test('successful keys rotate round robin across requests', async () => {
  const seen = [];
  const generate = createProviderRouter({ fetchImpl: async (_, options) => { seen.push(options.headers.Authorization); return ok(); } });
  await generate(messages, config); await generate(messages, config); await generate(messages, config);
  assert.deepEqual(seen, ['Bearer first', 'Bearer second', 'Bearer first']);
});

test('a quota-limited key is skipped until its Retry-After cooldown expires', async () => {
  let time = 0; const seen = [];
  const generate = createProviderRouter({ now: () => time, fetchImpl: async (_, options) => {
    const key = options.headers.Authorization; seen.push(key);
    return key === 'Bearer first' && time === 0 ? new Response('private provider details', { status: 429, headers: { 'Retry-After': '120' } }) : ok();
  } });
  await generate(messages, config); await generate(messages, config);
  assert.deepEqual(seen, ['Bearer first', 'Bearer second', 'Bearer second']);
  time = 120001; await generate(messages, config);
  assert.equal(seen.at(-1), 'Bearer first');
});

test('provider fallback tries Gemini then Groq without putting credentials in URLs or prompts', async () => {
  const seen = [];
  const generate = createProviderRouter({ fetchImpl: async (url, options) => {
    seen.push({ url, options });
    return url.includes('groq.com') ? ok() : new Response('', { status: 429 });
  } });
  const result = await generate(messages, config);
  assert.equal(result.provider, 'groq'); assert.equal(seen.length, 4);
  assert.ok(seen[2].url.includes('generativelanguage.googleapis.com'));
  assert.equal(seen[2].options.headers['x-goog-api-key'], 'third');
  for (const { url, options } of seen) { assert.ok(!/first|second|third|fourth/.test(url)); assert.ok(!/first|second|third|fourth/.test(options.body)); }
});

test('model configuration errors stop without retrying and never echo upstream bodies', async () => {
  let calls = 0;
  const generate = createProviderRouter({ fetchImpl: async () => { calls++; return new Response('sensitive-provider-details', { status: 400 }); } });
  await assert.rejects(generate(messages, config), e => e.code === 'MODEL_CONFIGURATION' && !e.message.includes('sensitive'));
  assert.equal(calls, 1);
});

test('bad credentials are cooled down and another configured provider can answer', async () => {
  const generate = createProviderRouter({ fetchImpl: async url => url.includes('googleapis.com') ? Response.json({ candidates: [{ content: { parts: [{ thought: true, text: 'hidden' }, { text: 'A grounded answer that explains why server verification matters.' }] } }] }) : new Response('', { status: 401 }) });
  const result = await generate(messages, config);
  assert.equal(result.provider, 'gemini'); assert.equal(result.answer, 'A grounded answer that explains why server verification matters.');
});

test('all unavailable providers fail within four attempts with a safe error', async () => {
  let calls = 0;
  const generate = createProviderRouter({ fetchImpl: async () => { calls++; return new Response('private error', { status: 503 }); } });
  await assert.rejects(generate(messages, config), e => e.code === 'PROVIDER_UNAVAILABLE' && !e.message.includes('private'));
  assert.equal(calls, 4);
  await assert.rejects(generate(messages, config)); assert.equal(calls, 4);
});

test('cancelled and unconfigured requests never call a provider', async () => {
  const generate = createProviderRouter({ fetchImpl: () => { throw new Error('Must not call'); } });
  await assert.rejects(generate(messages, { providers: [] }), e => e.code === 'NOT_CONFIGURED');
  const controller = new AbortController(); controller.abort();
  await assert.rejects(generate(messages, config, controller.signal), e => e.code === 'CANCELLED');
});

test('an empty completion falls through to the next key rather than showing a blank answer', async () => {
  let calls = 0;
  const generate = createProviderRouter({ fetchImpl: async () => ++calls === 1 ? Response.json({ choices: [{ message: { content: '' } }] }) : ok() });
  assert.ok((await generate(messages, config)).answer);
  assert.equal(calls, 2);
});

test('Free.ai uses its documented chat endpoint and bearer authentication', async () => {
  let seen;
  const generate = createProviderRouter({ fetchImpl: async (url, options) => { seen = { url, options }; return ok(); } });
  const result = await generate(messages, readAIConfig({ AI_PROVIDER_ORDER: 'freeai', FREEAI_API_KEY: 'local-test-key' }));
  assert.equal(result.provider, 'freeai'); assert.equal(seen.url, 'https://api.free.ai/v1/chat/');
  assert.equal(seen.options.headers.Authorization, 'Bearer local-test-key');
  assert.equal(JSON.parse(seen.options.body).model, 'qwen7b');
});

test('a classifier label is not accepted as a teaching answer', async () => {
  let calls = 0;
  const generate = createProviderRouter({ fetchImpl: async () => ++calls === 1 ? Response.json({ choices: [{ message: { content: 'User Safety: safe' } }] }) : ok() });
  assert.ok((await generate(messages, config)).answer.includes('trusted server'));
  assert.equal(calls, 2);
});
