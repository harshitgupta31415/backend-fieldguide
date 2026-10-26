import { accessConfigured, accessRequired, checkAccess } from './access-control.mjs';

const json = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
const metadata = (request, env) => ({ accessCodeRequired: accessRequired(request, env), accessCodeConfigured: accessConfigured(env) });
export function accessStatus(request, env = process.env) { return json(metadata(request, env)); }

export function createAccessHandler({ env = () => process.env, now = Date.now } = {}) {
  // Bounded process-local guard. Shared across callers, so forged forwarded IPs do not bypass it.
  let start = 0, attempts = 0;
  return async function handle(request) {
    const publicHost = request.headers.get('host') || new URL(request.url).host;
    let origin;
    try { origin = new URL(request.headers.get('origin')); } catch {}
    if (!origin || !['http:', 'https:'].includes(origin.protocol) || origin.host !== publicHost) return json({ error: 'Open Settings on this website to check your code.', code: 'ORIGIN_DENIED' }, 403);
    const instant = now();
    if (instant - start >= 60000) { start = instant; attempts = 0; }
    if (attempts >= 10) return json({ error: 'Too many checks. Wait a minute, then try again.', code: 'RATE_LIMITED' }, 429, { 'Retry-After': '60' });
    attempts++;
    if (!request.headers.get('content-type')?.startsWith('application/json')) return json({ error: 'Send a JSON access code.', code: 'INVALID_REQUEST' }, 415);
    if (Number(request.headers.get('content-length')) > 2048) return json({ error: 'The access code is too long.', code: 'INVALID_REQUEST' }, 413);
    const reader = request.body?.getReader();
    let body;
    try {
      if (!reader) throw new Error();
      const chunks = []; let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2048) { await reader.cancel(); return json({ error: 'The access code is too long.', code: 'INVALID_REQUEST' }, 413); }
        chunks.push(value);
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { return json({ error: 'The access code could not be read.', code: 'INVALID_REQUEST' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.accessCode !== 'string') return json({ error: 'Enter your AI access code.', code: 'INVALID_REQUEST' }, 400);
    const settings = env(), denied = checkAccess(request, body.accessCode, settings);
    if (denied) { const { status, ...failure } = denied; return json(failure, status); }
    // No AI provider call, cookie or credential is returned by this check.
    return json({ verified: true, ...metadata(request, settings) });
  };
}

export const handleAccessRequest = createAccessHandler();
