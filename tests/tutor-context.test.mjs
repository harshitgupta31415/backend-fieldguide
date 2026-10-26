import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCourseContext, selectTutorSources } from '../lib/tutor-context.mjs';
import { lessons } from '../lib/course.mjs';
import { createTutorHandler } from '../lib/tutor-server.mjs';

const registry = () => lessons.map(lesson => ({id:Number(lesson.id),title:lesson.title,module_id:Number(lesson.module_id),customized:false}));
const personal = {id:1001,module_id:1,title:'Duplicate request recovery',question:'How can a store recover a duplicate request?',definition:'Use the same operation identity to find the existing request result.',why:'A repeated request must not create a second financial effect.',example:'After a timeout, Fieldstore checks the known attempt before retrying.',steps:['Assign one operation identity.','Save the operation result.','Recover that result after a retry.'],exercise:'What should a second click return?',answer:'Return the result of the same logical operation.'};
const context = () => ({registry:[...registry(),{id:1001,module_id:1,title:personal.title}],excerpts:[personal]});

test('personal context has a bounded registry, exactly known parts and no duplicate excerpts', () => {
  const valid = validateCourseContext(context());
  assert.equal(valid.registry.at(-1).id,1001);
  assert.equal(valid.registry.at(-1).customized,true);
  for (const bad of [
    {...context(),registry:registry().slice(1)},
    {...context(),excerpts:[personal,personal]},
    {...context(),excerpts:[{...personal,definition:'x'.repeat(1401)}]},
    {...context(),registry:[...registry(),{id:999,module_id:1,title:'Unknown'}]},
    {...context(),registry:[...registry(),{id:1001,module_id:99,title:'Unknown'}]},
  ]) assert.throws(()=>validateCourseContext(bad),/context/);
});

test('selected personal lessons replace original evidence and never inherit official citations', () => {
  const rows = registry(); rows[0].customized = true;
  const input = {question:'Explain this lesson.',lessonId:1,history:[],courseContext:validateCourseContext({registry:rows,excerpts:[{...personal,id:1}]})};
  const result = selectTutorSources(input,()=>[{lessonId:1,title:'Old title',excerpt:'OLD CONTENT',references:[{url:'https://example.com'}]}]);
  assert.equal(result.length,1);
  assert.match(result[0].section,/unverified personal/);
  assert.deepEqual(result[0].references,[]);
  assert.ok(!result[0].excerpt.includes('OLD CONTENT'));
  input.courseContext.excerpts=[];
  assert.deepEqual(selectTutorSources(input,()=>[{lessonId:1,excerpt:'OLD CONTENT'}]),[]);
});

test('API supplies teaching mode and custom evidence, validates proposals, and exposes no arbitrary summary data', async () => {
  let sent;
  const handle = createTutorHandler({env:()=>({OPENROUTER_API_KEY:'test-credential'}),retrieve:()=>[],generate:async messages=>{
    sent=messages;
    return {answer:JSON.stringify({answer:'Recover the known attempt. [Lesson 1001]',actions:[{type:'navigate',lessonId:1001,reason:'Review the matching lesson.'},{type:'move_lesson',lessonId:1001,afterLessonId:64,reason:'This would cross parts.'}]}),provider:'stub',model:'stub'};
  }});
  const response=await handle(new Request('http://127.0.0.1:3000/api/tutor',{method:'POST',headers:{origin:'http://127.0.0.1:3000','content-type':'application/json'},body:JSON.stringify({question:'Quiz me on this lesson.',lessonId:1001,intent:'quiz',courseContext:context(),learnerSummary:{completedCount:1,totalLessons:109,currentLessonCompleted:false,notes:'PRIVATE'}})}));
  const result=await response.json();
  assert.equal(response.status,200);
  assert.equal(result.actions.length,1);
  assert.equal(result.sources[0].lessonId,1001);
  assert.match(sent[0].content,/Do not reveal the answer/);
  assert.ok(!JSON.stringify(sent).includes('PRIVATE'));
  assert.equal(result.warnings.length,1);
});
