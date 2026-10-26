import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { cleanProgress } from '../lib/progress.mjs';

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
  const restored = cleanProgress(JSON.parse(JSON.stringify({ version: 1, completed: [1, 1, 60, -1, 61, 2.5], quizzes: [1, 1, 2, 100], achievements: ['trust', 'trust', 'detective', 'unknown'], notes: { 1: 'a'.repeat(12000), 61: 'outside course', 1.5: 'not a lesson' }, draft: { feature: 'b'.repeat(6000), unknown: 'discard' }, last: 99, reduceMotion: true })));
  assert.deepEqual(restored.completed, [1, 60]);
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

test('all 60 lesson routes have an exercise, prompt, and diagram explanation for every node', async () => {
  const lessons = JSON.parse(await readFile(new URL('../lib/lessons.json', import.meta.url)));
  const interactions = JSON.parse(await readFile(new URL('../lib/interactions.json', import.meta.url)));
  assert.equal(lessons.length, 60);
  assert.equal(new Set(lessons.map(d => Number(d.id))).size, 60);
  for (let id = 1; id <= 60; id++) {
    const lesson = lessons.find(d => Number(d.id) === id);
    const quiz = interactions[String(id).padStart(2, '0')];
    assert.ok(lesson && lesson.prompt && lesson.exercise && lesson.steps.length === 3, `lesson ${id} is teachable`);
    assert.equal(Number(lesson.module_id), Math.ceil(id / 5));
    assert.equal(quiz.choices.length, 3);
    assert.ok(Number.isInteger(quiz.correct) && quiz.correct >= 0 && quiz.correct < quiz.choices.length);
    assert.equal(quiz.nodeDetails.length, lesson.visual.nodes.length);
    assert.ok(quiz.explanation.length > 20);
  }
});
