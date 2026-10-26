import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cleanProgress } from '../lib/progress.mjs';
import { lessons, reference, activities } from '../lib/course.mjs';

test('an older exported course file preserves learning without inventing rewards', () => {
  const oldFile = { version: 1, completed: [1, 2], notes: { 2: 'HTTP is the request contract.' }, draft: { rules: 'Check ownership.' }, last: 3 };
  const restored = cleanProgress(oldFile);
  assert.deepEqual(restored.completed, [1, 2]);
  assert.equal(restored.notes[2], oldFile.notes[2]);
  assert.equal(restored.draft.rules, oldFile.draft.rules);
  assert.equal(restored.last, 3);
  assert.deepEqual(restored.achievements, []);
  assert.deepEqual(restored.quizzes, []);
});

test('round-trip export keeps earned rewards once and bounds imported data', () => {
  const last = Number(lessons.at(-1).id);
  const unknown = Math.max(...lessons.map(d => Number(d.id))) + 1;
  const restored = cleanProgress(JSON.parse(JSON.stringify({ version: 1, completed: [1, 1, last, -1, unknown, 2.5], quizzes: [1, 1, 2, unknown], achievements: ['trust', 'trust', 'detective', 'unknown'], notes: { 1: 'a'.repeat(12000), [unknown]: 'outside course', 1.5: 'not a lesson' }, draft: { feature: 'b'.repeat(6000), unknown: 'discard' }, last: unknown, reduceMotion: true })));
  assert.deepEqual(restored.completed, [1, last]);
  assert.deepEqual(restored.achievements, ['trust', 'detective']);
  assert.deepEqual(restored.quizzes, [1, 2]);
  assert.equal(restored.notes[1].length, 10000);
  assert.equal(Object.keys(restored.notes).length, 1);
  assert.equal(restored.draft.feature.length, 5000);
  assert.equal(restored.draft.unknown, undefined);
  assert.equal(restored.last, 1);
  assert.equal(restored.reduceMotion, true);
});

test('unrecognized progress files are rejected rather than silently replacing progress', () => {
  for (const value of [null, [], {}, { version: 2 }]) assert.throws(() => cleanProgress(value), /progress file/);
});

test('every registered lesson is reachable and has a complete teaching contract', async () => {
  const interactions = JSON.parse(await readFile(new URL('../lib/interactions.json', import.meta.url)));
  assert.equal(new Set(lessons.map(d => Number(d.id))).size, lessons.length);
  for (const lesson of lessons) {
    const id = Number(lesson.id);
    const quiz = interactions[String(id).padStart(2, '0')];
    assert.ok(lesson && lesson.prompt && lesson.exercise && lesson.steps.length === 3, `lesson ${id} is teachable`);
    assert.ok(reference.modules.some(module => module.id === Number(lesson.module_id)));
    assert.equal(quiz.choices.length, 3);
    assert.ok(Number.isInteger(quiz.correct) && quiz.correct >= 0 && quiz.correct < quiz.choices.length);
    assert.equal(quiz.nodeDetails.length, lesson.visual.nodes.length);
    assert.ok(quiz.explanation.length > 20);
    for (const mode of ['understand','inspect','plan','implement','debug','verify','review']) assert.ok(lesson.prompts[mode].length > 30, `${id} has ${mode} prompt`);
    assert.ok(lesson.completionChecks.length >= 2);
    assert.ok(lesson.debugClues.length >= 2);
    assert.ok(lesson.sources.length && lesson.sources.every(source => source.url.startsWith('https://')));
  }
  for (const module of reference.modules) assert.ok(lessons.some(lesson=>Number(lesson.module_id)===module.id));
});

test('the original lesson identities survive the expansion', async () => {
  const identities=JSON.parse(await readFile(new URL('./original-lesson-identity.json',import.meta.url)));
  for(const before of identities){const after=lessons.find(d=>d.id===before.id);assert.ok(after);assert.equal(after.title,before.title);assert.equal(after.module_id,before.module_id);}
});

test('practical missions have valid decisions, placement destinations, and ordering steps',()=>{
  assert.equal(new Set(activities.map(a=>a.id)).size,activities.length);
  for(const activity of activities){
    assert.ok(reference.modules.some(m=>m.id===activity.moduleId));
    assert.ok(activity.scenarios.length>=3);
    for(const scenario of activity.scenarios){assert.ok(scenario.evidence.length>0);assert.ok(scenario.correct>=0&&scenario.correct<scenario.choices.length);assert.ok(scenario.choices.every(choice=>choice.text&&choice.why));}
    for(const item of activity.sortItems||[])assert.ok(activity.categories.some(category=>category.id===item.correct));
    if(activity.orderItems){assert.deepEqual(new Set(activity.orderStart),new Set(activity.orderItems.map(item=>item.id)));}
  }
});
