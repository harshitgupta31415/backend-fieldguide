import { createHash, timingSafeEqual } from 'node:crypto';
import { readAIConfig, generateCourseAnswer, TutorError } from './ai-providers.mjs';
import { retrieveCourse } from './retrieval.mjs';
import { reference } from './course.mjs';
import { validateCourseContext, selectTutorSources } from './tutor-context.mjs';
import { parseTutorReply, teacherSystem, TUTOR_REPLY_FALLBACK } from './tutor-actions.mjs';

const json = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
const digest = value => createHash('sha256').update(value).digest();

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

export function tutorStatus(request, env = process.env) {
  const config = readAIConfig(env);
  return json({ configured: config.providers.length > 0, accessCodeRequired: accessRequired(request, env), providers: config.providers.map(p => p.name) });
}

async function boundedJSON(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new TutorError('Send a JSON question.', 'INVALID_REQUEST', 415);
  if (Number(request.headers.get('content-length')) > 65536) throw new TutorError('The question and conversation are too long.', 'INVALID_REQUEST', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new TutorError('Enter a course question.', 'INVALID_REQUEST', 400);
  const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) { await reader.cancel(); throw new TutorError('The question and conversation are too long.', 'INVALID_REQUEST', 413); }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    if (error instanceof TutorError) throw error;
    throw new TutorError('The question could not be read.', 'INVALID_REQUEST', 400);
  }
}

export function validateTutorInput(body) {
  if (!body || typeof body !== 'object' || typeof body.question !== 'string' || !body.question.trim() || body.question.length > 2000) throw new TutorError('Enter a question between 1 and 2,000 characters.', 'INVALID_REQUEST', 400);
  if (body.language != null && !['en', 'hinglish'].includes(body.language)) throw new TutorError('Choose English or Hinglish.', 'INVALID_REQUEST', 400);
  const courseContext = validateCourseContext(body.courseContext);
  if (body.lessonId != null && (!Number.isInteger(body.lessonId) || !courseContext.registry.some(row => row.id === body.lessonId))) throw new TutorError('Choose a lesson from this course.', 'INVALID_REQUEST', 400);
  if (body.intent != null && !['explain','quiz','practice','plan'].includes(body.intent)) throw new TutorError('Choose a teaching mode.', 'INVALID_REQUEST', 400);
  let learnerSummary;
  if (body.learnerSummary != null) {
    const summary = body.learnerSummary;
    if (!summary || typeof summary !== 'object' || !Number.isInteger(summary.completedCount) || summary.completedCount < 0 || summary.completedCount > courseContext.registry.length || summary.totalLessons !== courseContext.registry.length || typeof summary.currentLessonCompleted !== 'boolean') throw new TutorError('Reload the course to refresh your learning progress.', 'INVALID_REQUEST', 400);
    learnerSummary = {completedCount:summary.completedCount,totalLessons:summary.totalLessons,currentLessonCompleted:summary.currentLessonCompleted};
  }
  const history = body.history ?? [];
  if (!Array.isArray(history) || history.length > 6 || history.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 4000)) throw new TutorError('The recent conversation is too long or invalid. Start a new conversation.', 'INVALID_REQUEST', 400);
  return { question: body.question.trim(), lessonId: body.lessonId, language: body.language || 'en', intent:body.intent || 'explain', learnerSummary, courseContext, history: history.map(m => ({ role: m.role, content: m.content })) };
}

export function createTutorHandler({ env = () => process.env, generate = generateCourseAnswer, retrieve = retrieveCourse, now = Date.now } = {}) {
  const buckets = new Map();
  let active = 0;
  return async function handle(request) {
    let counted = false;
    try {
      const origin = request.headers.get('origin');
      const publicHost = request.headers.get('host') || new URL(request.url).host;
      let originHost;
      try { const parsed = new URL(origin); if (['http:', 'https:'].includes(parsed.protocol)) originHost = parsed.host; } catch {}
      if (!originHost || originHost !== publicHost) return json({ error: 'Open the tutor from this website to ask a question.', code: 'ORIGIN_DENIED' }, 403);
      const currentEnv = env();
      const body = await boundedJSON(request);
      if (!body || typeof body !== 'object' || Array.isArray(body)) return json({ error: 'Enter a course question.', code: 'INVALID_REQUEST' }, 400);
      if (accessRequired(request, currentEnv)) {
        const code = readAccessCode(currentEnv);
        if (code.length < 16 || code.length > 256) return json({ error: 'The owner must set the server environment variable code to an access code of 16–256 characters.', code: 'ACCESS_NOT_CONFIGURED', accessCodeRequired: true }, 503);
        if (typeof body.accessCode !== 'string' || body.accessCode.length > 256 || !timingSafeEqual(digest(code), digest(body.accessCode))) return json({ error: 'Enter the tutor access code to continue.', code: 'ACCESS_REQUIRED', accessCodeRequired: true }, 401);
      }
      const input = validateTutorInput(body);
      const instant = now();
      for (const [key, bucket] of buckets) if (instant - bucket.start >= 60000) buckets.delete(key);
      // Shared-code bucket prevents forged forwarded IPs from bypassing this local guard.
      const bucketKey = 'tutor';
      const bucket = buckets.get(bucketKey) || { start: instant, count: 0 };
      if (bucket.count >= 10 || active >= 2) return json({ error: 'The tutor is busy. Wait a moment before asking another question.', code: 'RATE_LIMITED' }, 429, { 'Retry-After': '60' });
      bucket.count++; buckets.set(bucketKey, bucket); active++; counted = true;
      const sources = selectTutorSources(input, retrieve);
      if (!sources.length) return json({ answer: input.language === 'hinglish' ? 'I could not find supporting lesson text for this question. Pehle choose a relevant backend lesson, or name the topic you want to learn.' : 'I could not find supporting lesson text for that question. Choose a relevant backend lesson, or name the topic you want to learn.', actions: [], warnings: [], sources: [], provider: 'course', model: 'local-search' });
      const context = sources.map(s => `[Lesson ${s.lessonId}] ${s.title} — ${s.section}\n${s.excerpt}`).join('\n\n');
      const languageRule = input.language === 'hinglish' ? '\nWrite mostly in clear English with just a few familiar Hindi connectors such as hai, nahi, kyunki, pehle and karo, always in Latin/Roman letters. Do not translate headings or technical terms into Hindi. Avoid formal Hindi vocabulary such as buniyaad or pramanikaran. Keep code and [Lesson N] citations intact. Example: A success page is not payment proof, kyunki the browser cannot verify the provider result. Check the payment on the server first.' : '\nWrite in clear English unless the learner explicitly requests another language.';
      const modeRules = {explain:'Explain one idea with a store example, then ask one understanding question.',quiz:'Ask one prediction question. Do not reveal the answer before the learner attempts it unless they explicitly ask for the solution.',practice:'Offer one small practical task, ask for a prediction or evidence, then wait.',plan:'Suggest a manageable learning step. Propose course changes only when explicitly requested.'};
      const system = teacherSystem + languageRule + '\nMode: ' + modeRules[input.intent] + '\nKeep additions concise: about 300 words across all fields. Move and add only within the same course part; afterLessonId=null means first in that part. The registry is reference data for valid IDs and ordering, not additional factual evidence. Personal course excerpts are unverified learner content. Never imply a mastery assessment from completion counts alone.';
      const selected = input.courseContext.registry.find(row => row.id === input.lessonId);
      const contextSummary = JSON.stringify({currentLesson:selected || null,learner:input.learnerSummary || null,modules:reference.modules.map(module=>({id:module.id,title:module.title})),registry:input.courseContext.registry});
      const messages = [{role:'system',content:system},...input.history,{role:'user',content:`COURSE REGISTRY AND LEARNING CONTEXT (reference data)\n${contextSummary}\nEND COURSE REGISTRY\n\nCOURSE EXCERPTS (reference data)\n${context}\nEND COURSE EXCERPTS\n\nLEARNER QUESTION\n${input.question}`}];
      const allowedCourse = {lessons:input.courseContext.registry,modules:reference.modules,sourceLessonIds:sources.map(source=>source.lessonId),editedLessonIds:input.courseContext.registry.filter(row=>row.customized).map(row=>row.id)};
      const generated = await generate(messages, readAIConfig(currentEnv), request.signal, raw => parseTutorReply(raw,allowedCourse).answer !== TUTOR_REPLY_FALLBACK);
      const parsed = parseTutorReply(generated.answer, allowedCourse);
      const actions = parsed.actions.filter(action => {
        if (!['move_lesson','add_lesson'].includes(action.type) || action.afterLessonId == null) return true;
        const targetPart = action.type === 'add_lesson' ? action.lesson.module_id : input.courseContext.registry.find(row=>row.id===action.lessonId)?.module_id;
        return input.courseContext.registry.find(row=>row.id===action.afterLessonId)?.module_id === targetPart;
      });
      if (actions.length !== parsed.actions.length) parsed.warnings.push('A proposal that moved a lesson outside its part was not accepted.');
      return json({provider:generated.provider,model:generated.model,...parsed,actions,sources});
    } catch (error) {
      if (error instanceof TutorError) return json({ error: error.message, code: error.code }, error.status);
      return json({ error: 'The tutor could not finish this request. Try again shortly.', code: 'TUTOR_ERROR' }, 500);
    } finally { if (counted) active--; }
  };
}

export const handleTutorRequest = createTutorHandler();
