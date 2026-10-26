import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanProgress, withCourseChanges } from '../lib/progress.mjs';
import { applyCourseChange, emptyCourseChanges, undoCourseChange } from '../lib/course-workspace.mjs';

test('course-only imports and undo clear a pass when the assessment changes', () => {
  const progress = cleanProgress({version:1,completed:[1,2],quizzes:[1,2],checks:{1:[0]},last:1});
  const edited = applyCourseChange(emptyCourseChanges,{type:'edit_lesson',lessonId:1,patch:{answer:'The server validates the submitted variant before saving it.'}}).changes;
  const imported = withCourseChanges(progress,edited);
  assert.deepEqual(imported.completed,[2]);
  assert.deepEqual(imported.quizzes,[2]);
  assert.equal(imported.checks[1],undefined);
  const passedAgain = {...imported,completed:[1,2],quizzes:[1,2]};
  const undone = withCourseChanges(passedAgain,undoCourseChange(edited));
  assert.deepEqual(undone.completed,[2]);
});

test('a title change or reorder preserves earned assessment progress', () => {
  const progress=cleanProgress({version:1,completed:[1],quizzes:[1],last:1});
  const title=applyCourseChange(emptyCourseChanges,{type:'edit_lesson',lessonId:1,patch:{title:'Trace one request'}}).changes;
  const moved=applyCourseChange(title,{type:'move_lesson',lessonId:1,afterLessonId:2}).changes;
  const after=withCourseChanges(progress,moved);
  assert.deepEqual(after.completed,[1]);
  assert.deepEqual(after.quizzes,[1]);
});
