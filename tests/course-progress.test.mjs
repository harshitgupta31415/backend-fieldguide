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

test('importing a different custom lesson never attaches old notes to a reused numeric ID', () => {
  const custom={module_id:1,title:'Review a request boundary',question:'Where should the request be checked?',definition:'The server checks the request before changing shared data.',why:'Browser input can be modified by a client.',example:'Fieldstore checks cart ownership before changing an item.',steps:['Receive the request.','Check cart ownership.','Save the accepted result.'],exercise:'Where must ownership be checked?',answer:'The trusted server checks ownership before saving.',quiz:{choices:['The trusted server.','Only the browser.','Only the image.'],correct:0,explanation:'Browser input can be changed, so the server enforces the rule.'},completionChecks:['I can name the request inputs.','I can explain the ownership check.','I can describe the saved result.']};
  const course=applyCourseChange(emptyCourseChanges,{type:'add_lesson',lesson:custom}).changes;
  const prior=cleanProgress({version:1,course,completed:[1001],quizzes:[1001],notes:{1001:'My previous lesson note'}});
  const replacement=applyCourseChange(course,{type:'edit_lesson',lessonId:1001,patch:{title:'A different request exercise'}}).changes;
  assert.equal(withCourseChanges(prior,replacement).notes[1001],'My previous lesson note');
  const imported=withCourseChanges(prior,replacement,{importing:true});
  assert.equal(imported.notes[1001],undefined);
  assert.deepEqual(imported.completed,[]);
});
