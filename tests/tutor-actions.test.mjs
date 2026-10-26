import test from 'node:test';
import assert from 'node:assert/strict';
import lessons from '../lib/lessons.json' with { type: 'json' };
import reference from '../lib/reference.json' with { type: 'json' };
import { parseTutorReply, validateTutorActions, teacherSystem, tutorActionContract, TUTOR_ACTION_LIMITS } from '../lib/tutor-actions.mjs';

const navigate = lessonId => ({ type: 'navigate', lessonId, reason: 'This lesson explains the requested boundary.' });
const sampleLesson = () => ({
  module_id: 14,
  title: 'Check configuration before a test',
  question: 'Which database target should a synthetic test use?',
  definition: 'A test must use an explicitly approved isolated target before it can write records.',
  why: 'A label such as test does not change the destination or the credential capability.',
  example: 'Fieldstore rejects the production database target before inserting synthetic shirts priced at25000 INR minor units.',
  steps: ['Identify the effective target.', 'Reject forbidden production destinations.', 'Verify only the isolated synthetic target.'],
  exercise: 'The command is named test but points at production. Should it write?',
  answer: 'No. Refuse the write and repair the configuration bundle before rerunning an isolated check.',
  quiz: { choices: ['Refuse the unsafe write.', 'Write once to see the result.', 'Trust the command name.'], correct: 0, explanation: 'The effective destination controls impact. A test command name cannot protect production data.' },
  completionChecks: ['I can identify the actual destination.', 'I can reject a forbidden target.', 'I can demonstrate an isolated synthetic check.'],
});
const addition = lesson => ({ type: 'add_lesson', lesson: lesson || sampleLesson(), afterLessonId: 64, reason: 'The learner explicitly requested a practical configuration lesson.' });

test('the teaching contract asks one question, scaffolds reasoning, and requires explicit editing intent', () => {
  assert.match(teacherSystem, /one useful prediction or clarification question/i);
  assert.match(teacherSystem, /then wait/i);
  assert.match(teacherSystem, /hint before giving a quiz solution/i);
  assert.match(teacherSystem, /supplied course excerpts/i);
  assert.match(tutorActionContract, /explicitly requested/i);
  assert.match(tutorActionContract, /client assigns the ID/i);
  assert.match(tutorActionContract, /Apply\/Undo/);
  assert.match(tutorActionContract, /not evidence that the core course proves/i);
  assert.deepEqual([TUTOR_ACTION_LIMITS.actions, TUTOR_ACTION_LIMITS.customLessons, TUTOR_ACTION_LIMITS.editedLessons], [2, 50, 100]);
});

test('strict JSON and one optional JSON fence preserve a valid teaching reply and action', () => {
  const input = { answer: 'The server must verify the provider evidence before marking an order paid. [Lesson22]', actions: [navigate(22)] };
  for (const raw of [JSON.stringify(input), `\n\`\`\`json\n${JSON.stringify(input)}\n\`\`\`\n`]) {
    const result = parseTutorReply(raw);
    assert.equal(result.answer, 'The server must verify the provider evidence before marking an order paid. [Lesson 22]');
    assert.deepEqual(result.actions, input.actions);
    assert.deepEqual(result.warnings, []);
  }
});

test('safe plaintext remains an answer without implicitly extracting embedded actions', () => {
  const text = 'First inspect the trusted order amount. Do you know which component created the payment attempt?';
  assert.deepEqual(parseTutorReply(text), { answer: text, actions: [], warnings: [] });
  const embedded = 'For illustration only: {"type":"navigate","lessonId":64}. Nothing is being applied.';
  assert.deepEqual(parseTutorReply(embedded).actions, []);
});

test('malformed whole JSON or an invalid envelope gives a safe fallback rather than broken JSON', () => {
  for (const raw of ['{"answer":"unfinished', '[{"answer":"wrong root"}]', '```json\n{"answer":"missing actions"}\n```', JSON.stringify({ answer: '<script>alert(1)</script>', actions: [] }), JSON.stringify({ answer: 'x'.repeat(9000), actions: [] })]) {
    const result = parseTutorReply(raw);
    assert.deepEqual(result.actions, []);
    assert.match(result.answer, /could not read/i);
    assert.ok(!result.answer.startsWith('{'));
    assert.ok(result.warnings.length);
  }
});

test('unregistered action targets and unsupported citations are not accepted as known course evidence', () => {
  const unknown = parseTutorReply(JSON.stringify({ answer: 'A claim with an unknown citation [Lesson99999].', actions: [navigate(99999), navigate(64)] }));
  assert.deepEqual(unknown.actions, [navigate(64)]);
  assert.ok(!unknown.answer.includes('[Lesson99999]'));
  assert.match(unknown.answer, /unsupported lesson citation removed/);
  assert.ok(unknown.warnings.length >= 2);
  const scoped = parseTutorReply(JSON.stringify({ answer: 'Compare [Lesson22] and [Lesson64].', actions: [] }), { lessons, modules: reference.modules, sourceLessonIds: [22] });
  assert.ok(scoped.answer.includes('[Lesson 22]'));
  assert.ok(!scoped.answer.includes('[Lesson64]'));
});

test('custom IDs are accepted only from the supplied dynamic registry and preserve source identity', () => {
  const custom = { id: '1001', module_id: 14, title: 'A custom configuration lesson' };
  assert.deepEqual(validateTutorActions([navigate(1001)]).actions, []);
  const dynamic = [...lessons, custom];
  assert.deepEqual(validateTutorActions([navigate(1001)], dynamic).actions, [navigate(1001)]);
  const result = parseTutorReply(JSON.stringify({ answer: 'This custom lesson is a proposed addition, not verified core-course proof. [Lesson1001]', actions: [navigate(1001)] }), { lessons: dynamic, modules: reference.modules, sourceLessonIds: [1001] });
  assert.match(result.answer, /\[Lesson 1001\]/);
  assert.equal(result.actions[0].lessonId, 1001);
});

test('a complete addition carries its quiz and checks but never receives a model-supplied ID', () => {
  const input = addition();
  const result = validateTutorActions([input]);
  assert.equal(result.actions.length, 1);
  assert.deepEqual(result.actions[0].lesson.quiz, input.lesson.quiz);
  assert.equal(result.actions[0].lesson.completionChecks.length, 3);
  assert.ok(!Object.hasOwn(result.actions[0].lesson, 'id'));
  for (const invalid of [
    { ...sampleLesson(), id: 1001 },
    { ...sampleLesson(), lessonId: 1001 },
    { ...sampleLesson(), module_id: 999 },
    { ...sampleLesson(), sources: [{ title: 'Invented', url: 'https://untrusted.invalid' }] },
    { ...sampleLesson(), quiz: { choices: ['Same', 'Same', 'Other'], correct: 0, explanation: 'These are intentionally duplicate answer choices.' } },
    { ...sampleLesson(), completionChecks: ['Only one check exists.'] },
  ]) assert.deepEqual(validateTutorActions([addition(invalid)]).actions, []);
  const noQuiz = sampleLesson(); delete noQuiz.quiz;
  assert.deepEqual(validateTutorActions([addition(noQuiz)]).actions, []);
  const fakeModuleRegistry = { lessons, modules: [...reference.modules, { id: 999 }] };
  assert.deepEqual(validateTutorActions([addition({ ...sampleLesson(), module_id: 999 })], fakeModuleRegistry).actions, []);
});

test('edit patches are bounded and limited to teaching fields, including replacement quizzes', () => {
  const patch = { definition: 'A verified identity still needs resource authorization.', quiz: sampleLesson().quiz, completionChecks: sampleLesson().completionChecks };
  const valid = { type: 'edit_lesson', lessonId: 11, patch, reason: 'The learner requested a clearer definition and aligned exercise.' };
  assert.deepEqual(validateTutorActions([valid]).actions, [valid]);
  for (const badPatch of [{ definition: 'x'.repeat(100000) }, { module_id: 14 }, { id: 123 }, { sources: [] }, { title: '' }, {}, { code: 'runSomething()' }, { steps: ['Too few steps.'] }, { quiz: { ...sampleLesson().quiz, correct: 4 } }]) {
    assert.deepEqual(validateTutorActions([{ ...valid, patch: badPatch }]).actions, []);
  }
  assert.deepEqual(validateTutorActions([{ ...valid, execute: true }]).actions, [], 'unknown action fields are rejected');
});

test('reordering validates both registered positions and rejects a self move', () => {
  const move = { type: 'move_lesson', lessonId: 64, afterLessonId: 63, reason: 'The learner asked to study configuration earlier.' };
  assert.deepEqual(validateTutorActions([move]).actions, [move]);
  assert.equal(validateTutorActions([{ ...move, afterLessonId: null }]).actions[0].afterLessonId, null);
  for (const invalid of [{ ...move, afterLessonId: 64 }, { ...move, afterLessonId: 99999 }, { ...move, lessonId: 99999 }, { type: 'move_lesson', lessonId: 64, reason: move.reason }]) assert.deepEqual(validateTutorActions([invalid]).actions, []);
});

test('independent validation drops bad proposals, bounds count, and keeps warnings separate from content', () => {
  const invalid = { ...navigate(64), reason: 'x'.repeat(501) };
  const result = validateTutorActions([invalid, navigate(22), navigate(23)]);
  assert.deepEqual(result.actions, [navigate(22)]);
  assert.equal(result.warnings.length, 2);
  const parsed = parseTutorReply(JSON.stringify({ answer: 'Let us inspect the server boundary before changing this course.', actions: [{ ...navigate(64), arbitrary: true }, navigate(22)], sources: ['untrusted'] }));
  assert.deepEqual(parsed.actions, [navigate(22)]);
  assert.ok(parsed.warnings.length >= 2);
});

test('prototype keys, custom prototypes, cycles, and accessors cannot become lesson patches', () => {
  assert.equal({}.polluted, undefined);
  const malicious = JSON.parse('{"type":"edit_lesson","lessonId":1,"patch":{"__proto__":{"polluted":true}},"reason":"Attempt to inject prototype data."}');
  assert.deepEqual(validateTutorActions([malicious, navigate(22)]).actions, [navigate(22)]);
  const parsed = parseTutorReply(JSON.stringify({ answer: 'Only independently valid proposals are retained.', actions: [malicious, navigate(22)] }));
  assert.deepEqual(parsed.actions, [navigate(22)]);
  assert.equal({}.polluted, undefined);
  const inherited = Object.create({ type: 'navigate' }); inherited.lessonId = 22; inherited.reason = 'An inherited type is not an own JSON field.';
  assert.deepEqual(validateTutorActions([inherited]).actions, []);
  const cycle = navigate(22); cycle.loop = cycle;
  assert.deepEqual(validateTutorActions([cycle]).actions, []);
  let read = false;
  const accessor = { lessonId: 22, reason: 'The getter must never be executed.' };
  Object.defineProperty(accessor, 'type', { enumerable: true, get() { read = true; return 'navigate'; } });
  assert.deepEqual(validateTutorActions([accessor]).actions, []);
  assert.equal(read, false);
});

test('HTML, unsafe link schemes, executable action kinds, and fenced lesson code are not course edits', () => {
  for (const patch of [{ title: '<img src=x onerror=alert(1)>' }, { example: 'Open javascript:alert(1) to update the course.' }, { definition: 'Read file:/private/secret.txt as part of the lesson.' }, { answer: '```sh\nrun-a-command\n```' }]) {
    assert.deepEqual(validateTutorActions([{ type: 'edit_lesson', lessonId: 64, patch, reason: 'This unsafe proposal must be rejected.' }]).actions, []);
  }
  assert.deepEqual(validateTutorActions([{ type: 'execute_code', code: 'anything', reason: 'There is no executable action capability.' }]).actions, []);
});

test('course caps account for two proposals and allow a previously edited lesson to be refined', () => {
  const custom = Array.from({ length: 49 }, (_, index) => ({ id: 1001 + index, module_id: 14 }));
  const result = validateTutorActions([addition(), addition()], [...lessons, ...custom]);
  assert.equal(result.actions.length, 1);
  assert.equal(result.warnings.length, 1);
  assert.deepEqual(validateTutorActions([addition()], [...lessons, ...custom, { id: 2000, module_id: 14 }]).actions, []);
  const editedLessonIds = lessons.slice(0, 100).map(lesson => Number(lesson.id));
  const edit = lessonId => ({ type: 'edit_lesson', lessonId, patch: { title: 'A clearer trusted operation' }, reason: 'The learner requested a clearer lesson title.' });
  const edits = validateTutorActions([edit(1), edit(108)], { lessons, modules: reference.modules, editedLessonIds });
  assert.deepEqual(edits.actions.map(action => action.lessonId), [1]);
  assert.equal(edits.warnings.length, 1);
});
