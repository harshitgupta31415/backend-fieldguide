import { lessons, reference } from './course.mjs';
import { TutorError } from './ai-providers.mjs';

const fail = () => { throw new TutorError('The course context is invalid or too large. Reload the course and try again.', 'INVALID_REQUEST', 400); };
const record = value => value && typeof value === 'object' && !Array.isArray(value);
const bounded = (value, limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
const baseline = new Map(lessons.map(lesson => [Number(lesson.id), lesson]));
const modules = new Set(reference.modules.map(module => Number(module.id)));
const excerptLimits = { question: 500, definition: 1400, why: 800, example: 1000, exercise: 500, answer: 800 };

export function validateCourseContext(value) {
  if (value == null) return { registry: lessons.map(lesson => ({id:Number(lesson.id),module_id:Number(lesson.module_id),title:lesson.title,customized:false})), excerpts: [] };
  if (!record(value) || !Array.isArray(value.registry) || value.registry.length < lessons.length || value.registry.length > lessons.length + 50 || !Array.isArray(value.excerpts) || value.excerpts.length > 6) fail();
  const ids = new Set();
  const registry = value.registry.map(row => {
    if (!record(row) || !Number.isSafeInteger(row.id) || ids.has(row.id) || (!baseline.has(row.id) && (row.id < 1001 || row.id > 99999)) || !modules.has(row.module_id) || !bounded(row.title,160) || (baseline.has(row.id) && Number(baseline.get(row.id).module_id) !== row.module_id) || (row.customized != null && typeof row.customized !== 'boolean')) fail();
    ids.add(row.id);
    return {id:row.id,module_id:row.module_id,title:row.title.trim(),customized:row.customized === true};
  });
  if ([...baseline.keys()].some(id => !ids.has(id))) fail();
  const excerptIds = new Set();
  const excerpts = value.excerpts.map(row => {
    if (!record(row) || !ids.has(row.id) || excerptIds.has(row.id)) fail();
    excerptIds.add(row.id);
    const result = {...registry.find(item => item.id === row.id)};
    for (const [key,limit] of Object.entries(excerptLimits)) { if (!bounded(row[key],limit)) fail(); result[key] = row[key].trim(); }
    if (!Array.isArray(row.steps) || row.steps.length < 3 || row.steps.length > 6 || !row.steps.every(step => bounded(step,300))) fail();
    result.steps = row.steps.map(step => step.trim());
    // Client-authored excerpts are always labeled personal content, even when an
    // otherwise valid registry pretends that they are the original lesson.
    const registered = registry.find(item => item.id === row.id);
    registered.customized = true;
    result.customized = true;
    return result;
  });
  return {registry,excerpts};
}

export function personalSource(lesson) {
  return { id:`personal-${lesson.id}`, lessonId:lesson.id, title:lesson.title, section:'Your course copy · unverified personal content', href:`#lesson/${lesson.id}`, references:[], excerpt:[lesson.question,lesson.definition,`Why: ${lesson.why}`,`Example: ${lesson.example}`,`Steps: ${lesson.steps.join(' → ')}`,`Practice: ${lesson.exercise}`,`Teaching answer: ${lesson.answer}`].join('\n').slice(0,3600) };
}

export function selectTutorSources(input, retrieve) {
  const rows = new Map(input.courseContext.registry.map(row => [row.id,row]));
  const personal = new Map(input.courseContext.excerpts.map(row => [row.id,row]));
  const question = input.question;
  const selected = rows.get(input.lessonId);
  let sources = retrieve(question, {lessonId:input.lessonId,limit:4});
  const contextual = /\b(this|that|current|it|topic|lesson|understand|quiz|practice|next|plan|add|edit|improve|reorder|move)\b/i.test(question);
  if (!sources.length && question.length < 160) {
    const previous = [...input.history].reverse().find(message => message.role === 'user');
    if (previous && /^(why|how|what|explain|give|and|can you)/i.test(question)) sources = retrieve(`${previous.content} ${question}`, {lessonId:input.lessonId,limit:4});
  }
  const out = [];
  const include = source => { if (source && !out.some(item => item.lessonId === source.lessonId)) out.push(source); };
  if (selected && (contextual || input.history.length > 0 || !sources.length)) {
    if (personal.has(selected.id)) include(personalSource(personal.get(selected.id)));
    else if (!selected.customized && baseline.has(selected.id)) {
      const lesson = baseline.get(selected.id);
      include({id:`selected-${selected.id}`,lessonId:selected.id,title:lesson.title,section:'Current lesson',href:`#lesson/${selected.id}`,references:lesson.sources || [],excerpt:[lesson.question,lesson.definition,lesson.why,lesson.example,...lesson.steps,lesson.exercise,lesson.answer].join('\n').slice(0,3600)});
    }
  }
  for (const source of sources) {
    if (!rows.has(source.lessonId)) continue;
    if (personal.has(source.lessonId)) include(personalSource(personal.get(source.lessonId)));
    else if (!rows.get(source.lessonId).customized) include(source);
  }
  // Personal additions do not exist in the authored index. Match meaningful
  // title words, never instructions contained in their text.
  const terms = new Set(question.toLowerCase().match(/[a-z]{4,}/g) || []);
  for (const row of personal.values()) if ((row.title.toLowerCase().match(/[a-z]{4,}/g) || []).some(word => terms.has(word))) include(personalSource(row));
  return out.slice(0,2);
}
