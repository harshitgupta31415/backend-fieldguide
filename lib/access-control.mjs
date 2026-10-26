import { createHash, timingSafeEqual } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest();
export const MIN_ACCESS_LENGTH = 12;
export const MAX_ACCESS_LENGTH = 256;

export function readAccessCode(env = process.env) {
  const current = typeof env.code === 'string' ? env.code.trim() : '';
  const legacy = typeof env.TUTOR_ACCESS_CODE === 'string' ? env.TUTOR_ACCESS_CODE.trim() : '';
  return current || legacy;
}

export function accessRequired(request, env = process.env) {
  const host = new URL(request.url).hostname;
  let publicHost = host;
  try { publicHost = new URL(`http://${request.headers.get('host') || new URL(request.url).host}`).hostname; } catch { return true; }
  const forwardedRemote = (request.headers.get('x-forwarded-for') || '').split(',').some(value => value.trim() && !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(value.trim()));
  return Boolean(readAccessCode(env)) || Boolean(env.VERCEL) || !['localhost', '127.0.0.1', '[::1]'].includes(host) || !['localhost', '127.0.0.1', '[::1]'].includes(publicHost) || forwardedRemote;
}

export function accessConfigured(env = process.env) {
  const size = readAccessCode(env).length;
  return size >= MIN_ACCESS_LENGTH && size <= MAX_ACCESS_LENGTH;
}

// Every paid endpoint checks access itself; a browser "unlocked" state is not authorization.
export function checkAccess(request, submitted, env = process.env) {
  if (!accessRequired(request, env)) return null;
  if (!accessConfigured(env)) return { status: 503, error: 'The owner must set the server environment variable code to an access code of 12–256 characters.', code: 'ACCESS_NOT_CONFIGURED', accessCodeRequired: true };
  if (typeof submitted !== 'string' || submitted.length > MAX_ACCESS_LENGTH || !timingSafeEqual(digest(readAccessCode(env)), digest(submitted))) return { status: 401, error: 'Check your AI access code in Settings to continue.', code: 'ACCESS_REQUIRED', accessCodeRequired: true };
  return null;
}
