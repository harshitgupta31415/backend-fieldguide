import { activityIdSet, lessons } from './course.mjs';
import { cleanCourseChanges, buildCourse, emptyCourseChanges } from './course-workspace.mjs';
import { normalizeLanguage } from './language.mjs';
export const STORAGE_KEY = 'backend-fieldguide-v1';
export const emptyProgress = { version: 1, completed: [], notes: {}, draft: {}, last: Number(lessons[0].id), achievements: [], quizzes: [], practice: [], checks: {}, reduceMotion: false, language: 'en', course: emptyCourseChanges };
const draftKeys = ['context', 'feature', 'inputs', 'rules', 'constraints', 'failures', 'evidence'];

// Optional fields preserve compatibility with progress files exported before games.
export function cleanProgress(value) {
  if (!value || typeof value !== 'object' || value.version !== 1) throw new Error('Use a progress file exported from this course.');
  const course = cleanCourseChanges(value.course);
  const current = buildCourse(course).lessons;
  const lessonIdSet = new Set(current.map(lesson => Number(lesson.id)));
  const lessonById = id => current.find(lesson => Number(lesson.id) === Number(id));
  const lessonIds = values => [...new Set((Array.isArray(values) ? values : []).map(Number).filter(n => lessonIdSet.has(n)))];
  const completed = lessonIds(value.completed);
  const notes = {};
  for (const [key, note] of Object.entries(value.notes || {})) {
    if (lessonIdSet.has(Number(key)) && typeof note === 'string') notes[Number(key)] = note.slice(0, 10000);
  }
  const draft = {};
  for (const key of draftKeys) if (typeof value.draft?.[key] === 'string') draft[key] = value.draft[key].slice(0, 5000);
  const achievements = [...new Set((Array.isArray(value.achievements) ? value.achievements : []).filter(v => ['pipeline', 'trust', 'detective'].includes(v)))];
  const quizzes = lessonIds(value.quizzes);
  const practice = [...new Set((Array.isArray(value.practice) ? value.practice : []).filter(id => activityIdSet.has(id)))];
  const checks = {};
  for (const [key, list] of Object.entries(value.checks || {})) {
    if (lessonIdSet.has(Number(key)) && Array.isArray(list)) checks[Number(key)] = [...new Set(list.filter(n => Number.isInteger(n) && n >= 0 && n < (lessonById(key).completionChecks?.length || 0)))];
  }
  const last = Number(value.last);
  return { version: 1, completed, notes, draft, achievements, quizzes, practice, checks, course, reduceMotion: value.reduceMotion === true, language: normalizeLanguage(value.language), last: lessonIdSet.has(last) ? last : Number(lessons[0].id) };
}

// A previously passed assessment is not proof for a replacement assessment.
export function withCourseChanges(progress, changes) {
  const before = buildCourse(progress.course);
  const after = buildCourse(changes);
  const next = cleanProgress({...progress, course:changes});
  const oldLessons = new Map(before.lessons.map(lesson => [Number(lesson.id),lesson]));
  const changed = new Set(after.lessons.filter(lesson => {
    const old = oldLessons.get(Number(lesson.id));
    const key = String(lesson.id).padStart(2,'0');
    return old && JSON.stringify([old.exercise,old.answer,old.completionChecks,before.interactions[key]]) !== JSON.stringify([lesson.exercise,lesson.answer,lesson.completionChecks,after.interactions[key]]);
  }).map(lesson => Number(lesson.id)));
  next.completed = next.completed.filter(id => !changed.has(id));
  next.quizzes = next.quizzes.filter(id => !changed.has(id));
  for (const id of changed) delete next.checks[id];
  return next;
}
