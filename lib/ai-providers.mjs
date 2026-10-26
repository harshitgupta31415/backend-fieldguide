import { createHash } from 'node:crypto';

const DEFAULTS = { openrouter: 'openrouter/free', gemini: 'gemini-3.5-flash-lite', groq: 'openai/gpt-oss-20b', freeai: 'qwen7b' };
export class TutorError extends Error {
  constructor(message, code = 'PROVIDER_UNAVAILABLE', status = 503) { super(message); this.code = code; this.status = status; }
}

export function readAIConfig(env = process.env) {
  const order = [...new Set((env.AI_PROVIDER_ORDER || 'openrouter,gemini,groq,freeai').split(',').map(s => s.trim()).filter(s => Object.hasOwn(DEFAULTS, s)))];
  const providers = order.map(name => {
    const prefix = name.toUpperCase();
    const keys = [...new Set((env[`${prefix}_API_KEYS`] || env[`${prefix}_API_KEY`] || '').split(',').map(s => s.trim()).filter(s => s && !/replace|your[_-]|example|placeholder/i.test(s)))].slice(0, 6);
    const model = (env[`${prefix}_MODEL`] || DEFAULTS[name]).trim();
    return { name, keys, model };
  }).filter(p => p.keys.length);
  const parsed = Number(env.AI_MAX_OUTPUT_TOKENS || 1000);
  return { providers, maxTokens: Number.isFinite(parsed) ? Math.min(1600, Math.max(128, Math.floor(parsed))) : 1000 };
}

function fingerprint(provider, key) { return createHash('sha256').update(`${provider}:${key}`).digest('hex'); }
function retryDelay(response, now) {
  const value = response.headers?.get('retry-after');
  const seconds = Number(value);
  const ms = value ? (Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now) : 60000;
  return Math.max(60000, Number.isFinite(ms) ? ms : 60000);
}

function makeRequest(provider, key, messages, maxTokens) {
  if (provider.name !== 'gemini') return {
    url: { openrouter: 'https://openrouter.ai/api/v1/chat/completions', groq: 'https://api.groq.com/openai/v1/chat/completions', freeai: 'https://api.free.ai/v1/chat/' }[provider.name],
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'X-Title': 'Backend Fieldguide' },
    body: { model: provider.model, messages, max_tokens: maxTokens, stream: false },
  };
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent`,
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: {
      systemInstruction: { parts: [{ text: messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n') }] },
      contents: messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { maxOutputTokens: maxTokens },
    },
  };
}

// In-process rotation/cooldowns are deliberately best effort, not a distributed quota service.
export function createProviderRouter({ fetchImpl = fetch, now = Date.now, timeoutMs = 12000 } = {}) {
  const cursors = new Map();
  const cooldowns = new Map();
  return async function generate(messages, config = readAIConfig(), signal) {
    if (!config.providers.length) throw new TutorError('Add a provider key to .env.local, then restart the server.', 'NOT_CONFIGURED');
    const began = now();
    let attempts = 0;
    let lastCode = 'PROVIDER_UNAVAILABLE';
    for (const [id, until] of cooldowns) if (until <= began) cooldowns.delete(id);
    for (const provider of config.providers) {
      if (!/^[a-zA-Z0-9._:/-]{1,160}$/.test(provider.model)) throw new TutorError('Check the configured AI model name.', 'MODEL_CONFIGURATION', 503);
      const start = (cursors.get(provider.name) || 0) % provider.keys.length;
      for (let offset = 0; offset < provider.keys.length; offset++) {
        if (signal?.aborted) throw new TutorError('The request was cancelled.', 'CANCELLED', 499);
        if (attempts >= 4 || now() - began >= 45000) break;
        const index = (start + offset) % provider.keys.length;
        const key = provider.keys[index];
        const id = fingerprint(provider.name, key);
        if ((cooldowns.get(id) || 0) > now()) { lastCode = 'RATE_LIMITED'; continue; }
        cursors.set(provider.name, (index + 1) % provider.keys.length);
        attempts++;
        const request = makeRequest(provider, key, messages, config.maxTokens);
        const timeout = AbortSignal.timeout(Math.min(timeoutMs, Math.max(1, 45000 - (now() - began))));
        let response;
        try {
          response = await fetchImpl(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify(request.body), cache: 'no-store', redirect: 'error', signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
          if (!response.ok) {
            // Never relay provider error bodies, headers or keys to the browser/logs.
            await response.body?.cancel();
            if ([400, 404, 422].includes(response.status)) throw new TutorError('The AI provider rejected the model or request settings. Check the server configuration.', 'MODEL_CONFIGURATION', 503);
            if (response.status === 429) {
              cooldowns.set(id, now() + retryDelay(response, now())); lastCode = 'RATE_LIMITED'; continue;
            }
            if ([401, 403, 402].includes(response.status)) {
              cooldowns.set(id, now() + 300000); lastCode = 'PROVIDER_CREDENTIALS'; continue;
            }
            if ([408, 500, 502, 503, 504].includes(response.status)) {
              cooldowns.set(id, now() + 30000); lastCode = 'PROVIDER_UNAVAILABLE'; continue;
            }
            throw new TutorError('The AI provider could not complete this request. Please try again later.');
          }
          const payload = await response.json();
          if (payload?.error) { cooldowns.set(id, now() + 30000); continue; }
          const answer = provider.name !== 'gemini'
            ? payload?.choices?.[0]?.message?.content
            : payload?.candidates?.[0]?.content?.parts?.filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('\n');
          if (typeof answer !== 'string' || answer.trim().length < 40 || /^(?:user\s+)?safety\s*:|^(?:safe|unsafe)\s*$/i.test(answer.trim())) { cooldowns.set(id, now() + 30000); lastCode = 'PROVIDER_UNAVAILABLE'; continue; }
          return { answer: answer.trim().slice(0, 12000), provider: provider.name, model: provider.model };
        } catch (error) {
          if (error instanceof TutorError) throw error;
          if (signal?.aborted) throw new TutorError('The request was cancelled.', 'CANCELLED', 499);
          cooldowns.set(id, now() + 30000);
          lastCode = 'PROVIDER_UNAVAILABLE';
        }
      }
    }
    const message = lastCode === 'PROVIDER_CREDENTIALS'
      ? 'The configured providers could not authenticate or have no available credit. Check or replace the server-side keys.'
      : lastCode === 'RATE_LIMITED'
        ? 'The configured keys are cooling down or have reached their quota. Wait a minute and try again; daily limits may take longer.'
        : 'The configured AI providers are temporarily unavailable. Please try again shortly.';
    throw new TutorError(message, lastCode, lastCode === 'RATE_LIMITED' ? 429 : 503);
  };
}

export const generateCourseAnswer = createProviderRouter();
