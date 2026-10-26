import { createHash, timingSafeEqual } from 'node:crypto';
import { accessRequired, readAccessCode } from './tutor-server.mjs';

export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
export const MAX_SPEECH_CHARS = 2000;
const MAX_WAV_BYTES = 12 * 1024 * 1024;
const ENDPOINTS = { transcribe: 'https://api.groq.com/openai/v1/audio/transcriptions', speak: 'https://api.groq.com/openai/v1/audio/speech' };
const MIME = new Map([['audio/webm', 'webm'], ['audio/ogg', 'ogg'], ['audio/mp4', 'mp4'], ['audio/x-m4a', 'm4a'], ['audio/wav', 'wav'], ['audio/x-wav', 'wav'], ['audio/mpeg', 'mp3'], ['audio/flac', 'flac']]);
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (value, status = 200, extra = {}) => Response.json(value, { status, headers: { ...headers, ...extra } });
const digest = value => createHash('sha256').update(value).digest();

class VoiceError extends Error {
  constructor(message, code = 'VOICE_UNAVAILABLE', status = 503) { super(message); this.code = code; this.status = status; }
}

export function readVoiceKeys(env = process.env) {
  return [...new Set((env.GROQ_API_KEYS || env.GROQ_API_KEY || '').split(',').map(value => value.trim()).filter(value => value && !/replace|your[_-]|example|placeholder/i.test(value)))].slice(0, 6);
}

async function bytesWithin(body, limit, status = 413) {
  const reader = body?.getReader();
  if (!reader) throw new VoiceError('The voice request is empty.', 'INVALID_VOICE_REQUEST', 400);
  const parts = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new VoiceError('The audio or request is too large. Use a shorter recording or answer.', 'VOICE_TOO_LARGE', status); }
    parts.push(value);
  }
  return Buffer.concat(parts, size);
}

function authorize(request, accessCode, env) {
  if (!accessRequired(request, env)) return;
  const expected = readAccessCode(env);
  if (expected.length < 16 || expected.length > 256) throw new VoiceError('The owner must set the server environment variable code to an access code of 16–256 characters.', 'ACCESS_NOT_CONFIGURED', 503);
  if (typeof accessCode !== 'string' || accessCode.length > 256 || !timingSafeEqual(digest(expected), digest(accessCode))) throw new VoiceError('Enter the tutor access code before using voice.', 'ACCESS_REQUIRED', 401);
}

function languageValue(value) {
  if (value != null && !['en', 'hinglish'].includes(value)) throw new VoiceError('Choose English or Hinglish.', 'INVALID_VOICE_REQUEST', 400);
  return value || 'en';
}

export function validateSpeechInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.text !== 'string' || !body.text.trim() || body.text.length > MAX_SPEECH_CHARS) throw new VoiceError('Read aloud accepts 1–2,000 characters.', 'INVALID_VOICE_REQUEST', 400);
  return { text: body.text.trim(), language: languageValue(body.language) };
}

async function validateRecording(form) {
  const file = form.get('file');
  if (form.getAll('file').length !== 1 || !(file instanceof Blob) || !file.size) throw new VoiceError('Include one microphone recording.', 'INVALID_VOICE_REQUEST', 400);
  if (file.size > MAX_AUDIO_BYTES) throw new VoiceError('Recordings must be 5 MB or smaller.', 'VOICE_TOO_LARGE', 413);
  const mime = file.type.split(';')[0].trim().toLowerCase();
  if (!MIME.has(mime)) throw new VoiceError('Use a supported WebM, Ogg, MP4, WAV, MP3 or FLAC audio recording.', 'UNSUPPORTED_AUDIO', 415);
  const prefix = Buffer.from(await file.slice(0, 16).arrayBuffer());
  const signature = mime === 'audio/webm' ? prefix.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    : mime === 'audio/ogg' ? prefix.toString('ascii', 0, 4) === 'OggS'
    : ['audio/mp4', 'audio/x-m4a'].includes(mime) ? prefix.toString('ascii', 4, 8) === 'ftyp'
    : ['audio/wav', 'audio/x-wav'].includes(mime) ? prefix.toString('ascii', 0, 4) === 'RIFF' && prefix.toString('ascii', 8, 12) === 'WAVE'
    : mime === 'audio/flac' ? prefix.toString('ascii', 0, 4) === 'fLaC'
    : prefix.toString('ascii', 0, 3) === 'ID3' || prefix[0] === 0xff && (prefix[1] & 0xe0) === 0xe0;
  if (!signature) throw new VoiceError('That file does not look like the declared audio format. Record again.', 'UNSUPPORTED_AUDIO', 415);
  const duration = Number(form.get('durationMs'));
  if (!Number.isFinite(duration) || duration <= 0 || duration > 60000) throw new VoiceError('Record up to 60 seconds, then stop.', 'VOICE_TOO_LONG', 400);
  return { file, extension: MIME.get(mime), language: languageValue(form.get('language')) };
}

// Groq Orpheus currently accepts at most 200 characters per request.
// https://console.groq.com/docs/text-to-speech/orpheus
export function splitSpeechText(text, limit = 200) {
  const chunks = []; let rest = text.replace(/\s+/g, ' ').trim();
  while (rest.length > limit) {
    let cut = rest.lastIndexOf(' ', limit);
    if (cut < Math.floor(limit * 0.7)) cut = limit;
    const sentence = Math.max(rest.lastIndexOf('. ', cut), rest.lastIndexOf('? ', cut), rest.lastIndexOf('! ', cut));
    if (sentence >= Math.floor(limit * 0.7)) cut = sentence + 1;
    chunks.push(rest.slice(0, cut).trim()); rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

function pcmWave(value) {
  const data = Buffer.from(value);
  if (data.length < 44 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') throw new VoiceError('The natural voice returned an unsupported audio file. Try the browser voice.', 'VOICE_FORMAT', 502);
  let format, samples;
  for (let offset = 12; offset + 8 <= data.length;) {
    const id = data.toString('ascii', offset, offset + 4), length = data.readUInt32LE(offset + 4), end = offset + 8 + length;
    if (end > data.length) throw new VoiceError('The natural voice audio was incomplete. Try again or use the browser voice.', 'VOICE_FORMAT', 502);
    if (id === 'fmt ') format = data.subarray(offset + 8, end);
    if (id === 'data') samples = data.subarray(offset + 8, end);
    offset = end + (length % 2);
  }
  if (!format || format.length < 16 || !samples?.length || format.readUInt16LE(0) !== 1 || !format.readUInt16LE(12) || samples.length % format.readUInt16LE(12)) throw new VoiceError('The natural voice format could not be combined. Use the browser voice.', 'VOICE_FORMAT', 502);
  return { format, samples };
}

export function combineSpeechWav(chunks) {
  const parsed = chunks.map(pcmWave), first = parsed[0];
  if (!first || parsed.some(item => !item.format.equals(first.format))) throw new VoiceError('The natural voice changed audio format. Use the browser voice.', 'VOICE_FORMAT', 502);
  const size = parsed.reduce((sum, item) => sum + item.samples.length, 0);
  if (size > MAX_WAV_BYTES) throw new VoiceError('The generated audio is too large. Use the browser voice.', 'VOICE_TOO_LARGE', 502);
  const fmtLength = first.format.length, dataOffset = 20 + fmtLength + fmtLength % 2;
  const result = Buffer.alloc(dataOffset + 8 + size + size % 2);
  result.write('RIFF', 0); result.writeUInt32LE(result.length - 8, 4); result.write('WAVEfmt ', 8); result.writeUInt32LE(fmtLength, 16); first.format.copy(result, 20);
  result.write('data', dataOffset); result.writeUInt32LE(size, dataOffset + 4);
  let offset = dataOffset + 8;
  for (const item of parsed) { item.samples.copy(result, offset); offset += item.samples.length; }
  return result;
}

export function createVoiceHandlers({ env = () => process.env, fetchImpl = fetch, now = Date.now, timeoutMs = 12000 } = {}) {
  const cooldowns = new Map(); let cursor = 0, active = 0, bucket = { start: 0, count: 0 };

  async function provider(kind, body, keys, signal, deadline) {
    let attempted = 0;
    const start = cursor % keys.length;
    for (let index = 0; index < keys.length && attempted < 2; index++) {
      if (signal.aborted) throw new VoiceError('Voice request cancelled.', 'CANCELLED', 499);
      if (now() >= deadline) throw new VoiceError('The natural voice took too long. Try the browser voice.', 'VOICE_TIMEOUT', 503);
      const keyIndex = (start + index) % keys.length, key = keys[keyIndex], fingerprint = digest(key).toString('hex');
      if ((cooldowns.get(fingerprint) || 0) > now()) continue;
      attempted++; cursor = keyIndex + 1;
      try {
        const response = await fetchImpl(ENDPOINTS[kind], { method: 'POST', headers: { Authorization: `Bearer ${key}`, ...(kind === 'speak' ? { 'Content-Type': 'application/json' } : {}) }, body: kind === 'speak' ? JSON.stringify(body) : body, cache: 'no-store', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(Math.max(1, Math.min(timeoutMs, deadline - now())))]) });
        if (!response.ok) {
          if (kind === 'speak' && response.status === 400) {
            let code;
            try { const details = JSON.parse((await bytesWithin(response.body, 8192, 502)).toString('utf8')); code = details?.error?.code; } catch {}
            if (code === 'model_terms_required') throw new VoiceError('A Groq organization administrator must review and accept the Orpheus model terms before natural voice can work. Open Groq model setup, or use the browser voice.', 'VOICE_TERMS_REQUIRED', 503);
            throw new VoiceError('The voice provider could not use this recording or voice model. Try again, type your question, or use the browser voice.', 'VOICE_PROVIDER_SETUP', 503);
          }
          await response.body?.cancel();
          if ([400, 404, 422].includes(response.status)) throw new VoiceError('The voice provider could not use this recording or voice model. Try again, type your question, or use the browser voice.', 'VOICE_PROVIDER_SETUP', 503);
          const delay = response.status === 429 ? Math.max(60000, Number(response.headers.get('retry-after')) * 1000 || Date.parse(response.headers.get('retry-after')) - now() || 60000) : [401, 402, 403].includes(response.status) ? 300000 : 30000;
          cooldowns.set(fingerprint, now() + delay);
          if (![401, 402, 403, 408, 429, 500, 502, 503, 504].includes(response.status)) throw new VoiceError('The voice provider is unavailable. Try the browser voice or type your question.');
          continue;
        }
        return await bytesWithin(response.body, kind === 'speak' ? 2 * 1024 * 1024 : 64 * 1024, 502);
      } catch (error) {
        if (error instanceof VoiceError) throw error;
        if (signal.aborted) throw new VoiceError('Voice request cancelled.', 'CANCELLED', 499);
        cooldowns.set(fingerprint, now() + 30000);
      }
    }
    throw new VoiceError('Natural voice is unavailable or cooling down. Type your question or choose the browser voice.', 'VOICE_UNAVAILABLE', 503);
  }

  async function handle(kind, request) {
    let counted = false;
    try {
      const origin = request.headers.get('origin'), host = request.headers.get('host') || new URL(request.url).host;
      let originHost;
      try { const parsed = new URL(origin); if (['http:', 'https:'].includes(parsed.protocol)) originHost = parsed.host; } catch {}
      if (!originHost || originHost !== host) throw new VoiceError('Use voice from this website.', 'ORIGIN_DENIED', 403);
      const currentEnv = env(), type = request.headers.get('content-type') || '';
      const limit = kind === 'transcribe' ? MAX_AUDIO_BYTES + 65536 : 16384;
      if (Number(request.headers.get('content-length')) > limit) throw new VoiceError('The voice request is too large.', 'VOICE_TOO_LARGE', 413);
      if (!(kind === 'transcribe' ? type.startsWith('multipart/form-data;') : type.startsWith('application/json'))) throw new VoiceError('The voice request format is unsupported.', 'INVALID_VOICE_REQUEST', 415);
      const bytes = await bytesWithin(request.body, limit);
      let body;
      try { body = kind === 'transcribe' ? await new Response(bytes, { headers: { 'Content-Type': type } }).formData() : JSON.parse(bytes.toString('utf8')); }
      catch { throw new VoiceError('The voice request could not be read.', 'INVALID_VOICE_REQUEST', 400); }
      if (kind === 'speak' && (!body || typeof body !== 'object' || Array.isArray(body))) throw new VoiceError('Include text to read aloud.', 'INVALID_VOICE_REQUEST', 400);
      authorize(request, kind === 'transcribe' ? body.get('accessCode') : body.accessCode, currentEnv);
      const input = kind === 'transcribe' ? await validateRecording(body) : validateSpeechInput(body);
      const keys = readVoiceKeys(currentEnv);
      if (!keys.length) throw new VoiceError('Voice input and natural speech need a server-side Groq key. You can type or use the browser voice.', 'VOICE_NOT_CONFIGURED', 503);
      if (now() - bucket.start >= 60000) bucket = { start: now(), count: 0 };
      if (bucket.count >= 8 || active >= 2) return json({ error: 'Voice is busy. Wait a moment before trying again.', code: 'VOICE_RATE_LIMITED' }, 429, { 'Retry-After': '60' });
      bucket.count++; active++; counted = true;
      for (const [key, until] of cooldowns) if (until <= now()) cooldowns.delete(key);
      const deadline = now() + 45000;
      if (kind === 'transcribe') {
        const form = new FormData(); form.set('file', input.file, `question.${input.extension}`); form.set('model', 'whisper-large-v3-turbo'); form.set('response_format', 'verbose_json'); form.set('temperature', '0');
        if (input.language === 'en') form.set('language', 'en');
        form.set('prompt', input.language === 'hinglish' ? 'An ecommerce backend question, mostly English with occasional Hindi words in Roman letters. API, database, webhook, Fieldstore, checkout, Supabase, Node.js.' : 'An ecommerce backend question. API, database, webhook, Fieldstore, checkout, Supabase, Node.js.');
        const raw = await provider(kind, form, keys, request.signal, deadline);
        let result; try { result = JSON.parse(raw.toString('utf8')); } catch { throw new VoiceError('The transcription could not be read. Try recording again.', 'VOICE_RESPONSE', 502); }
        if (Number(result.duration) > 61) throw new VoiceError('The recording is longer than 60 seconds. Record a shorter question.', 'VOICE_TOO_LONG', 422);
        if (typeof result.text !== 'string' || !result.text.trim()) throw new VoiceError('No clear speech was found. Try again or type your question.', 'VOICE_EMPTY', 422);
        return json({ text: result.text.trim().slice(0, MAX_SPEECH_CHARS), truncated: result.text.trim().length > MAX_SPEECH_CHARS, provider: 'groq' });
      }
      const chunks = [];
      for (const text of splitSpeechText(input.text)) chunks.push(await provider(kind, { model: 'canopylabs/orpheus-v1-english', voice: 'hannah', input: text, response_format: 'wav' }, keys, request.signal, deadline));
      return new Response(combineSpeechWav(chunks), { headers: { ...headers, 'Content-Type': 'audio/wav', 'X-Voice-Provider': 'groq', 'X-Voice-Name': 'hannah' } });
    } catch (error) {
      const known = error instanceof VoiceError;
      return json({ error: known ? error.message : 'Voice could not finish. Try again, type your question, or choose the browser voice.', code: known ? error.code : 'VOICE_ERROR', ...(['ACCESS_REQUIRED', 'ACCESS_NOT_CONFIGURED'].includes(error.code) ? { accessCodeRequired: true } : {}) }, known ? error.status : 500);
    } finally { if (counted) active--; }
  }

  return {
    transcribe: request => handle('transcribe', request),
    speak: request => handle('speak', request),
    status: request => json({ configured: readVoiceKeys(env()).length > 0, accessCodeRequired: accessRequired(request, env()), maxSeconds: 60, maxAudioBytes: MAX_AUDIO_BYTES, maxSpeechCharacters: MAX_SPEECH_CHARS }),
  };
}

export const voiceHandlers = createVoiceHandlers();
