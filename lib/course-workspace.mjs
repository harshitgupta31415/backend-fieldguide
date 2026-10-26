import { lessons as baseline, reference } from './course.mjs';
import interactions from './interactions.json' with { type: 'json' };

export const emptyCourseChanges = { custom: [], patches: {}, order: [], nextId: 1001, history: [] };
const fields = ['title','question','definition','why','example','steps','exercise','answer','completionChecks','quiz'];
const text = (value, max = 4000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const own = (value, key) => value && Object.hasOwn(value, key);
const moduleIds = new Set(reference.modules.map(m => Number(m.id)));

function cleanQuiz(quiz) {
  if (!quiz || !Array.isArray(quiz.choices) || quiz.choices.length !== 3 || !Number.isInteger(quiz.correct) || quiz.correct < 0 || quiz.correct > 2) return null;
  const choices = quiz.choices.map(value => text(value, 700));
  const explanation = text(quiz.explanation, 1500);
  return choices.every(Boolean) && explanation ? { choices, correct: quiz.correct, explanation } : null;
}
export function cleanLessonPatch(value) {
  const result = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const field of fields) {
    if (!own(value, field)) continue;
    if (field === 'quiz') { const quiz = cleanQuiz(value.quiz); if (quiz) result.quiz = quiz; }
    else if (field === 'steps' || field === 'completionChecks') {
      const list = Array.isArray(value[field]) ? value[field].slice(0, field === 'steps' ? 6 : 3).map(item => text(item, 800)) : [];
      if (list.length >= 3 && list.every(Boolean)) result[field] = list;
    } else { const copy = text(value[field], field === 'title' ? 160 : field === 'question' ? 500 : 4000); if (copy) result[field] = copy; }
  }
  return result;
}
function snapshot(value) {
  const custom = [];
  const seen = new Set();
  for (const candidate of (Array.isArray(value?.custom) ? value.custom : []).slice(0, 50)) {
    const id = Number(candidate?.id); const module_id = Number(candidate?.module_id);
    const patch = cleanLessonPatch(candidate);
    if (!Number.isSafeInteger(id) || id < 1001 || id > 99999 || seen.has(id) || !moduleIds.has(module_id) || fields.some(field => !patch[field])) continue;
    seen.add(id); custom.push({ ...patch, id, module_id });
  }
  const valid = new Set([...baseline.map(l => Number(l.id)), ...custom.map(l => l.id)]);
  const patches = {};
  for (const [key, valuePatch] of Object.entries(value?.patches || {}).slice(0, 100)) {
    if (valid.has(Number(key))) { const patch = cleanLessonPatch(valuePatch); if (Object.keys(patch).length) patches[Number(key)] = patch; }
  }
  const order = [...new Set((Array.isArray(value?.order) ? value.order : []).map(Number).filter(id => valid.has(id)))];
  return { custom, patches, order, nextId: Math.min(100000, Math.max(1001, ...custom.map(l => l.id + 1), Number.isSafeInteger(value?.nextId) ? value.nextId : 1001)) };
}
export function cleanCourseChanges(value) {
  const result = snapshot(value);
  return { ...result, history: (Array.isArray(value?.history) ? value.history : []).slice(-5).map(snapshot) };
}
function customLesson(item) {
  const topic = item.title;
  const prompts = {
    understand: `Explain ${topic} using this rule: ${item.definition} Give one store example and ask me a prediction question.`,
    inspect: `Inspect the repository before changing ${topic}. Identify inputs, trust boundaries, data ownership and existing tests.`,
    plan: `Plan ${topic} around this outcome: ${item.question} List business rules, failure cases and acceptance checks before implementation.`,
    implement: `Implement the agreed ${topic} change in a small reviewable step. Follow existing conventions and verify this rule: ${item.definition}`,
    debug: `Investigate a failure in ${topic}. Ask for redacted evidence, separate facts from hypotheses and test the smallest discriminating check.`,
    verify: `Verify ${topic} with normal, invalid, unauthorized, repeated and concurrent requests where relevant. Report what actually ran.`,
    review: `Review ${topic} for incorrect assumptions, missing validation, permission checks and incomplete failure recovery. Cite concrete evidence.`,
  };
  return { ...item, id: String(item.id), module_title: reference.modules.find(m => Number(m.id) === item.module_id)?.title, visual: { kind: 'flow', nodes: item.steps.slice(0, 4).map((_, index) => `Step ${index + 1}`), caption: 'Trace the steps, then check the proposed rule against evidence.' }, sources: [], details: [], debugClues: [], prompts, prompt: prompts.implement, isCustom: true };
}
export function buildCourse(changes = emptyCourseChanges) {
  const state = cleanCourseChanges(changes);
  const courseLessons = [...baseline, ...state.custom.map(customLesson)].map(lesson => {
    const patch = state.patches[Number(lesson.id)];
    return patch ? { ...lesson, ...patch, id: lesson.id, module_id: lesson.module_id, customized: true } : lesson;
  });
  const rank = new Map(state.order.map((id, index) => [id, index]));
  courseLessons.sort((a, b) => (rank.get(Number(a.id)) ?? 10000) - (rank.get(Number(b.id)) ?? 10000));
  const quizzes = { ...interactions };
  for (const lesson of courseLessons) if (lesson.quiz) quizzes[String(lesson.id).padStart(2, '0')] = { ...lesson.quiz, nodeDetails: lesson.steps || [] };
  return { lessons: courseLessons, interactions: quizzes };
}
function reposition(order, id, afterId, courseLessons) {
  const subject = courseLessons.find(l => Number(l.id) === id);
  const after = courseLessons.find(l => Number(l.id) === afterId);
  if (!subject || afterId === id || (afterId != null && (!after || after.module_id !== subject.module_id))) throw new Error('Choose a different lesson in the same part for the new position.');
  const result = order.filter(item => item !== id);
  const index = afterId == null ? result.findIndex(item => courseLessons.find(l => Number(l.id) === item)?.module_id === subject.module_id) : result.indexOf(afterId) + 1;
  result.splice(index < 0 ? result.length : index, 0, id);
  return result;
}
export function applyCourseChange(changes, action) {
  const state = cleanCourseChanges(changes);
  const before = snapshot(state);
  const current = buildCourse(state).lessons;
  const next = { ...state, custom: [...state.custom], patches: { ...state.patches }, order: current.map(l => Number(l.id)) };
  let lessonId = Number(action?.lessonId);
  if (action?.type === 'add_lesson') {
    if (next.custom.length >= 50 || next.nextId > 99999) throw new Error('This course copy supports up to 50 added lessons.');
    const patch = cleanLessonPatch(action.lesson);
    if (fields.some(field => !patch[field]) || !moduleIds.has(Number(action.lesson?.module_id))) throw new Error('A new lesson needs its teaching text, 3–6 steps, three checks and a complete three-choice quiz.');
    lessonId = next.nextId++;
    const item = { ...patch, id: lessonId, module_id: Number(action.lesson.module_id) };
    next.custom.push(item); next.order.push(lessonId);
    const samePart = current.filter(l => l.module_id === item.module_id);
    const after = own(action, 'afterLessonId') ? action.afterLessonId : Number(samePart.at(-1)?.id) || null;
    next.order = reposition(next.order, lessonId, after, [...current, item]);
  } else if (action?.type === 'edit_lesson') {
    if (!current.some(l => Number(l.id) === lessonId)) throw new Error('That lesson is no longer in this course copy.');
    if (!own(next.patches, lessonId) && Object.keys(next.patches).length >= 100) throw new Error('This course copy supports up to 100 edited lessons.');
    const patch = cleanLessonPatch(action.patch);
    if (!Object.keys(patch).length) throw new Error('There are no valid lesson fields to update.');
    next.patches[lessonId] = { ...next.patches[lessonId], ...patch };
  } else if (action?.type === 'move_lesson') {
    next.order = reposition(next.order, lessonId, action.afterLessonId ?? null, current);
  } else throw new Error('That course change is not supported.');
  next.history = [...state.history, before].slice(-5);
  if (JSON.stringify(next).length > 1500000) throw new Error('This course copy is too large. Export it and reduce the size of the proposed lesson text.');
  return { changes: next, lessonId };
}
export function undoCourseChange(changes) {
  const state = cleanCourseChanges(changes);
  if (!state.history.length) return state;
  return { ...state.history.at(-1), nextId: state.nextId, history: state.history.slice(0, -1) };
}
export function makeTutorCourseContext(courseLessons, currentId) {
  const candidates = courseLessons.filter(l => l.isCustom || l.customized).sort((a,b) => Number(Number(b.id) === Number(currentId)) - Number(Number(a.id) === Number(currentId))).slice(0, 6);
  return { registry: courseLessons.map(l => ({ id: Number(l.id), module_id: Number(l.module_id), title: l.title.slice(0, 160) })), excerpts: candidates.map(l => ({ id: Number(l.id), module_id: Number(l.module_id), title: l.title, question: l.question?.slice(0,500), definition: l.definition?.slice(0,1400), why: l.why?.slice(0,800), example: l.example?.slice(0,1000), steps: l.steps?.slice(0,6).map(s=>s.slice(0,300)), exercise: l.exercise?.slice(0,500), answer: l.answer?.slice(0,800) })) };
}
