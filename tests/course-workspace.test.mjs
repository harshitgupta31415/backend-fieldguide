import test from 'node:test';
import assert from 'node:assert/strict';
import { lessons as baseline, reference } from '../lib/course.mjs';
import baselineInteractions from '../lib/interactions.json' with { type: 'json' };
import { cleanProgress } from '../lib/progress.mjs';
import { emptyCourseChanges, cleanCourseChanges, cleanLessonPatch, buildCourse, applyCourseChange, undoCourseChange, makeTutorCourseContext } from '../lib/course-workspace.mjs';

const sample = () => ({
  module_id: 14,
  title: 'Isolate the test database',
  question: 'Which database target is safe for synthetic test writes?',
  definition: 'Only an explicitly approved isolated target may receive synthetic test writes.',
  why: 'A command named test can still point at real customer records.',
  example: 'Fieldstore refuses a production target before inserting a synthetic shirt priced at25000 INR minor units.',
  steps: ['Inspect the effective target.', 'Reject production before writes.', 'Verify isolated synthetic data.'],
  exercise: 'A test command targets production. Should it write first to investigate?',
  answer: 'No. Stop before the write, repair the environment, and verify an isolated destination.',
  quiz: { choices: ['Stop before writing.', 'Write once to investigate.', 'Trust the command name.'], correct: 0, explanation: 'The actual target controls impact. The test label does not protect customer data.' },
  completionChecks: ['I can identify the effective destination.', 'I can reject a forbidden target.', 'I can verify an isolated test write.'],
});
const add = (lesson = sample(), extra = {}) => ({ type: 'add_lesson', lesson, ...extra });
const find = (course,id) => course.lessons.find(lesson=>Number(lesson.id)===id);

test('adding a lesson creates complete local teaching data, an assigned ID, and aligned quiz reasoning', () => {
  const before = JSON.stringify(emptyCourseChanges);
  const result = applyCourseChange(emptyCourseChanges,add());
  assert.equal(result.lessonId,1001);
  assert.equal(JSON.stringify(emptyCourseChanges),before);
  const course = buildCourse(result.changes), lesson = find(course,1001);
  assert.equal(course.lessons.length,baseline.length+1);
  assert.equal(lesson.id,'1001');
  assert.equal(lesson.module_id,14);
  assert.equal(lesson.isCustom,true);
  assert.equal(lesson.module_title,reference.modules.find(module=>module.id===14).title);
  assert.equal(lesson.sources.length,0,'a custom proposal invents no official sources');
  assert.equal(Object.keys(lesson.prompts).length,7);
  assert.equal(course.interactions['1001'].correct,0);
  assert.equal(course.interactions['1001'].nodeDetails.length,lesson.visual.nodes.length);
  const next = course.lessons[course.lessons.findIndex(lesson=>Number(lesson.id)===1001)+1];
  assert.notEqual(next?.module_id,14,'default insertion is at the end of the selected part');
});

test('a new lesson requires a full quiz, exactly three checks, 3–6 steps, and a known module', () => {
  for (const field of ['quiz','completionChecks','definition','answer']) {
    const lesson = sample(); delete lesson[field];
    assert.throws(()=>applyCourseChange(emptyCourseChanges,add(lesson)),/new lesson|teaching text/i);
  }
  for (const lesson of [
    {...sample(),steps:['Only one step.']},
    {...sample(),steps:Array.from({length:7},()=> 'An additional bounded step.')},
    {...sample(),completionChecks:['Only one completion check.']},
    {...sample(),completionChecks:Array.from({length:4},()=> 'Too many completion checks.')},
    {...sample(),quiz:{...sample().quiz,correct:3}},
    {...sample(),quiz:{...sample().quiz,choices:['Same','Same','Other']}},
    {...sample(),module_id:999},
    {...sample(),id:7777},
    {...sample(),nodes:['First','Second','Third','Fourth']},
  ]) assert.throws(()=>applyCourseChange(emptyCourseChanges,add(lesson)));
});

test('editing baseline content never mutates baseline data or other built course copies', () => {
  const original = JSON.stringify(baseline), originalQuizzes = JSON.stringify(baselineInteractions);
  const untouched = buildCourse();
  untouched.lessons[0].title='External mutation';
  untouched.lessons[0].steps[0]='External nested mutation';
  untouched.interactions['01'].choices[0]='External quiz mutation';
  assert.equal(JSON.stringify(baseline),original);
  assert.equal(JSON.stringify(baselineInteractions),originalQuizzes);
  const patch = { title:'Trace the saved result', definition:'A request must be traced through its committed data and verified response.' };
  const result = applyCourseChange(emptyCourseChanges,{type:'edit_lesson',lessonId:1,patch});
  const edited = find(buildCourse(result.changes),1);
  assert.equal(edited.title,patch.title);
  assert.equal(edited.customized,true);
  assert.equal(edited.id,baseline[0].id);
  assert.equal(edited.module_id,baseline[0].module_id);
  assert.equal(find(buildCourse(),1).title,baseline[0].title);
  assert.equal(JSON.stringify(baseline),original);
});

test('custom edits regenerate prompt context and six-step diagrams without stale labels or mismatched details', () => {
  const added = applyCourseChange(emptyCourseChanges,add());
  const patch = { title:'Verify the complete configuration boundary',definition:'Configuration checks must reject unintended data and provider destinations before work.',steps:Array.from({length:6},(_,index)=>`Verify configuration boundary number ${index+1}.`),quiz:{...sample().quiz,explanation:'The updated check protects the revised configuration boundary.'} };
  const edited = applyCourseChange(added.changes,{type:'edit_lesson',lessonId:added.lessonId,patch});
  const course = buildCourse(edited.changes), lesson = find(course,1001), quiz = course.interactions['1001'];
  assert.match(lesson.prompts.understand,/Verify the complete configuration boundary/);
  assert.match(lesson.prompts.understand,/unintended data and provider destinations/);
  assert.equal(lesson.visual.nodes.length,4);
  assert.equal(quiz.nodeDetails.length,4);
  assert.match(quiz.nodeDetails[3],/number 4/);
  assert.match(quiz.nodeDetails[3],/number 6/);
  assert.equal(quiz.explanation,patch.quiz.explanation);
  const baseEdited = applyCourseChange(emptyCourseChanges,{type:'edit_lesson',lessonId:1,patch:{steps:patch.steps}});
  const baseCourse = buildCourse(baseEdited.changes);
  assert.equal(baseCourse.interactions['01'].nodeDetails.length,find(baseCourse,1).visual.nodes.length);
});

test('same-part moves support beginning and after positions while cross-part and self moves fail', () => {
  const moved = applyCourseChange(emptyCourseChanges,{type:'move_lesson',lessonId:3,afterLessonId:1});
  assert.deepEqual(buildCourse(moved.changes).lessons.filter(lesson=>lesson.module_id===1).map(lesson=>Number(lesson.id)),[1,3,2,4,5]);
  const first = applyCourseChange(moved.changes,{type:'move_lesson',lessonId:3,afterLessonId:null});
  assert.deepEqual(buildCourse(first.changes).lessons.slice(0,5).map(lesson=>Number(lesson.id)),[3,1,2,4,5]);
  for (const action of [
    {type:'move_lesson',lessonId:3,afterLessonId:3},
    {type:'move_lesson',lessonId:3,afterLessonId:64},
    {type:'move_lesson',lessonId:3,afterLessonId:99999},
    {type:'move_lesson',lessonId:99999,afterLessonId:1},
    {type:'move_lesson',lessonId:3},
    {type:'move_lesson',lessonId:3,afterLessonId:'1'},
  ]) assert.throws(()=>applyCourseChange(emptyCourseChanges,action));
  assert.throws(()=>applyCourseChange(emptyCourseChanges,add(sample(),{afterLessonId:1})),/same part/i);
});

test('an imported order cannot move a part ahead of another part', () => {
  const course = buildCourse({order:[64,3,1,2,5,4]});
  assert.deepEqual(course.lessons.slice(0,5).map(lesson=>Number(lesson.id)),[3,1,2,5,4]);
  const ranks = new Map(reference.modules.map((module,index)=>[module.id,index]));
  for (let index=1;index<course.lessons.length;index++) assert.ok(ranks.get(course.lessons[index-1].module_id)<=ranks.get(course.lessons[index].module_id));
});

test('undo restores add, edit, and move state without reusing a custom identifier', () => {
  const added = applyCourseChange(emptyCourseChanges,add());
  const edited = applyCourseChange(added.changes,{type:'edit_lesson',lessonId:1001,patch:{title:'A revised isolated test lesson'}});
  const moved = applyCourseChange(edited.changes,{type:'move_lesson',lessonId:1001,afterLessonId:null});
  let state = undoCourseChange(moved.changes);
  assert.equal(find(buildCourse(state),1001).title,'A revised isolated test lesson');
  state = undoCourseChange(state);
  assert.equal(find(buildCourse(state),1001).title,sample().title);
  state = undoCourseChange(state);
  assert.equal(find(buildCourse(state),1001),undefined);
  assert.equal(state.nextId,1002);
  assert.equal(applyCourseChange(state,add()).lessonId,1002);
  assert.deepEqual(undoCourseChange(emptyCourseChanges),cleanCourseChanges(emptyCourseChanges));
});

test('history is bounded and workspace data is export/import portable', () => {
  let state = emptyCourseChanges;
  for(let index=0;index<8;index++) state=applyCourseChange(state,{type:'edit_lesson',lessonId:1,patch:{title:`A reviewed lesson revision ${index}`}}).changes;
  assert.equal(state.history.length,5);
  assert.deepEqual(cleanCourseChanges(JSON.parse(JSON.stringify(state))),state);
});

test('custom and edited lesson limits are enforced without blocking a further edit to an existing patch', () => {
  const custom = Array.from({length:50},(_,index)=>({...sample(),id:1001+index}));
  const full = cleanCourseChanges({custom});
  assert.equal(full.custom.length,50);
  assert.equal(cleanCourseChanges({custom:[...custom,{...sample(),id:2000}]}).custom.length,50);
  assert.throws(()=>applyCourseChange(full,add()),/50 added lessons/);
  const patches=Object.fromEntries(baseline.slice(0,100).map(lesson=>[lesson.id,{title:'An intentionally reviewed title'}]));
  const capped=cleanCourseChanges({patches});
  assert.equal(Object.keys(capped.patches).length,100);
  assert.throws(()=>applyCourseChange(capped,{type:'edit_lesson',lessonId:108,patch:{title:'An additional edited title'}}),/100 edited lessons/);
  assert.equal(find(buildCourse(applyCourseChange(capped,{type:'edit_lesson',lessonId:1,patch:{title:'A further reviewed title'}}).changes),1).title,'A further reviewed title');
});

test('untrusted import structures, prototypes, and getters cannot execute or pollute state', () => {
  assert.equal({}.polluted,undefined);
  const poisoned=JSON.parse('{"custom":[],"patches":{"__proto__":{"polluted":true}},"order":[1],"nextId":1001}');
  assert.deepEqual(cleanCourseChanges(poisoned).patches,{});
  assert.deepEqual(cleanLessonPatch(JSON.parse('{"title":"A harmless title","__proto__":{"polluted":true}}')),{});
  const getter={};let read=false;
  Object.defineProperty(getter,'custom',{enumerable:true,get(){read=true;return[];}});
  assert.equal(cleanCourseChanges(getter).custom.length,0);
  assert.equal(read,false);
  const symbolLesson=sample();let symbolRead=false;
  Object.defineProperty(symbolLesson,Symbol('untrusted'),{enumerable:true,get(){symbolRead=true;return 'hidden';}});
  assert.throws(()=>applyCourseChange(emptyCourseChanges,add(symbolLesson)));
  assert.equal(symbolRead,false);
  const inherited=Object.create({title:'An inherited title'});
  assert.deepEqual(cleanLessonPatch(inherited),{});
  assert.throws(()=>applyCourseChange(emptyCourseChanges,{type:'edit_lesson',lessonId:1,patch:JSON.parse('{"constructor":{"prototype":{"polluted":true}}}')}));
  assert.equal({}.polluted,undefined);
});

test('oversized or invalid content is rejected atomically rather than silently truncated', () => {
  for (const patch of [
    {title:'x'.repeat(121)},
    {title:'A valid title',definition:'x'.repeat(2401)},
    {title:'<script>alert(1)</script>'},
    {example:'Open javascript:alert(1) to update this lesson.'},
    {module_id:1,title:'A forbidden module reassignment'},
    {steps:Array.from({length:7},()=> 'Too many steps in this list.')},
  ]) {
    assert.deepEqual(cleanLessonPatch(patch),{});
    assert.throws(()=>applyCourseChange(emptyCourseChanges,{type:'edit_lesson',lessonId:1,patch}));
  }
  const malformed={...sample(),id:1001,definition:'x'.repeat(2401)};
  assert.equal(cleanCourseChanges({custom:[malformed]}).custom.length,0);
  assert.equal(cleanCourseChanges({custom:[{...sample(),id:1001},{...sample(),id:1001}]}).custom.length,1);
  assert.equal(cleanCourseChanges({custom:[{...sample(),id:1001}],nextId:1001}).nextId,1002);
});

test('custom completions round-trip and disappear from valid progress after undo removes the lesson', () => {
  const added=applyCourseChange(emptyCourseChanges,add());
  const progress=cleanProgress({version:1,course:added.changes,completed:[1,1001],quizzes:[1001],checks:{1001:[0,2,99]},notes:{1001:'My own custom note.'},last:1001,language:'hinglish'});
  const restored=cleanProgress(JSON.parse(JSON.stringify(progress)));
  assert.deepEqual(restored.completed,[1,1001]);
  assert.deepEqual(restored.quizzes,[1001]);
  assert.deepEqual(restored.checks[1001],[0,2]);
  assert.equal(restored.notes[1001],'My own custom note.');
  assert.equal(restored.last,1001);
  assert.equal(restored.language,'hinglish');
  const undone=cleanProgress({...restored,course:undoCourseChange(restored.course)});
  assert.deepEqual(undone.completed,[1]);
  assert.deepEqual(undone.quizzes,[]);
  assert.equal(undone.checks[1001],undefined);
  assert.equal(undone.notes[1001],undefined);
  assert.equal(undone.last,Number(baseline[0].id));
});

test('tutor context flags customized registry rows and prioritizes the current custom lesson', () => {
  const added=applyCourseChange(emptyCourseChanges,add());
  const edited=applyCourseChange(added.changes,{type:'edit_lesson',lessonId:64,patch:{definition:'This reviewed local definition differs from the original core lesson.'}});
  const context=makeTutorCourseContext(buildCourse(edited.changes).lessons,1001);
  assert.equal(context.registry.length,baseline.length+1);
  assert.equal(context.registry.find(lesson=>lesson.id===64).customized,true);
  assert.equal(context.registry.find(lesson=>lesson.id===1).customized,false);
  assert.equal(context.excerpts[0].id,1001);
  assert.equal(context.excerpts.some(lesson=>lesson.id===64),true);
  assert.ok(context.excerpts.length<=6);
  assert.equal(JSON.stringify(context).includes('My own custom note.'),false);
});
