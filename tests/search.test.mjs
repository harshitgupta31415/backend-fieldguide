import test from 'node:test';
import assert from 'node:assert/strict';
import {createSearchIndex,searchCourse,isContextualFollowup,SEARCH_TYPES} from '../lib/search.mjs';
import lessons from '../lib/lessons.json' with {type:'json'};

const index=createSearchIndex();
const ids=(query,options)=>searchCourse(index,query,options).results.map(result=>result.id);

test('contextual follow-ups inherit a topic without treating independent questions as continuations',()=>{
  for (const question of ['Why?','How?','Give me an example','Give example','Can you give me another example?','What about refunds?','Why does it need a stable key?','How can that fail?','Can you explain that?','Explain it in simple words.','Yes, explain that again.','And why?','kyun?','Iska example do']) assert.equal(isContextualFollowup(question),true,question);
  for (const question of ['Why is the sky blue?','How do airplanes fly?','Can you explain photosynthesis?','Give me an example of photosynthesis.','Explain lesson 64','What is authentication?','And why is the sky blue?','payment',null,42,{},'', 'why '.repeat(100)]) assert.equal(isContextualFollowup(question),false,String(question));
});

test('search indexes every destination type and category requests return the requested content',()=>{
  for(const type of SEARCH_TYPES) assert.ok(index.documents.some(result=>result.type===type),type);
  assert.deepEqual(ids('games'),['game:pipeline','game:trust','game:detective']);
  assert.equal(searchCourse(index,'show all lessons',{limit:200}).total,108);
  assert.deepEqual(ids('show all lessons',{limit:3}),['lesson:1','lesson:2','lesson:3']);
  assert.equal(searchCourse(index,'labs').results.length,3);
});

test('multiword payment questions rank verification facts above incidental auth or deployment mentions',()=>{
  const found=ids('Why does a payment success redirect not prove payment?');
  assert.ok(found.slice(0,3).includes('lesson:22'));
  assert.ok(found.slice(0,3).includes('lesson:95'));
  assert.ok(!found.includes('lesson:73'));
  assert.ok(!found.includes('lesson:81'));
});

test('configuration synonyms and Roman Hindi connectors retain the intended technical concept',()=>{
  const config=ids('where should env secrets go',{type:'lesson'});
  assert.ok(config.slice(0,6).includes('lesson:64'));
  const hindi=ids('payment kyun verify karna hai',{type:'lesson'});
  assert.equal(hindi[0],'lesson:95');
  assert.ok(ids('login permission').some(id=>id==='lesson:11'||id==='lesson:13'));
});

test('bounded typo correction and a unique final-word prefix find useful matches',()=>{
  const corrected=searchCourse(index,'paymnt');
  assert.match(corrected.correction,/paymnt → payment/);
  assert.ok(corrected.results.some(result=>result.type==='lesson'&&[22,95,107].includes(result.lessonId)));
  assert.ok(ids('supaba').some(id=>id.startsWith('lesson:')));
  assert.equal(searchCourse(index,'penguin migration').results.length,0);
});

test('direct lesson IDs and natural command wrappers never resolve a prompt instead',()=>{
  for(const query of ['64','#64','lesson64','Lesson 064','Explain lesson 64','show me lesson 64','#lesson/64']) assert.deepEqual(ids(query),['lesson:64'],query);
  assert.deepEqual(ids('part14'),['part:14']);
  assert.deepEqual(ids('lesson 99999'),[]);
  assert.deepEqual(ids('64',{type:'game'}),[]);
});

test('explicit lesson and part references inside questions ignore numeric presentation constraints',()=>{
  for(const query of ['Explain lesson 64 in 80 words','what does lesson64 mean?','Explain lesson64 briefly','Summarize lesson number 64 with 3 examples','What should I learn in part 14 in 80 words?']) {
    const expected=query.includes('part 14')?'part:14':'lesson:64';
    const found=searchCourse(index,query);
    assert.deepEqual(found.results.map(item=>item.id),[expected],query);
    assert.equal(found.total,1);
    assert.equal(found.counts.prompt,0);
  }
  assert.deepEqual(ids('Explain lesson 64 and lesson 65 in 80 words'),['lesson:64','lesson:65']);
  assert.deepEqual(ids('Explain lesson 99999 briefly'),[]);
  assert.deepEqual(ids('Explain lesson64 briefly',{type:'prompt'}),[]);
});

test('explicit lesson prompt requests stay in the referenced lesson and prioritize the requested mode',()=>{
  const found=searchCourse(index,'Give a debug prompt for lesson 64 in 80 words');
  assert.ok(found.results.length>0);
  assert.equal(found.results[0].id,'prompt:64:debug');
  assert.ok(found.results.every(item=>item.type==='prompt'&&item.lessonId===64));
  assert.equal(found.counts.lesson,0);
  assert.equal(found.results[0].route.stage,'apply');
  assert.equal(found.results[0].route.promptMode,'debug');
  const part=searchCourse(index,'Show prompts for part 14',{type:'prompt'});
  assert.ok(part.results.length>0);
  assert.ok(part.results.every(item=>item.type==='prompt'&&item.moduleId===14));
});

test('glossary and practice intent expose a definition or usable activity',()=>{
  const rls=searchCourse(index,'RLS').results[0];
  assert.equal(rls.id,'glossary:rls');
  assert.equal(rls.lessonId,72);
  assert.match(rls.excerpt,/Row Level Security narrows which rows/);
  assert.ok(searchCourse(index,'Where can I practice stock reservations?',{limit:5}).results.some(result=>result.id==='lab:inventory'));
});

test('prompt results contain an exact template and a deep route to its learning stage',()=>{
  const found=searchCourse(index,'prompt for payment verification',{type:'prompt',limit:10});
  assert.ok(found.results.length);
  const result=found.results[0];
  assert.equal(result.type,'prompt');
  assert.equal(result.route.stage,'apply');
  assert.equal(result.route.promptMode,result.promptMode);
  assert.ok(result.prompt.length>40);
  assert.match(result.excerpt,/instructions to adapt, not factual evidence/);
});

test('type counts stay stable across filtering and pagination is bounded',()=>{
  const all=searchCourse(index,'payment',{limit:3});
  const filtered=searchCourse(index,'payment',{type:'lesson',limit:200});
  assert.deepEqual(all.counts,filtered.counts);
  assert.equal(filtered.total,filtered.counts.lesson);
  assert.ok(filtered.results.every(result=>result.type==='lesson'));
  assert.equal(all.results.length,3);
  assert.ok(searchCourse(index,'prompts',{limit:9999}).results.length<=200);
});

test('personal course content replaces baseline facts without mutating the original course',()=>{
  const original=lessons.find(lesson=>Number(lesson.id)===64);
  const personalLessons=lessons.map(lesson=>Number(lesson.id)===64?{...lesson,definition:'A mooncart setting belongs to one explicit trust boundary.',title:'Mooncart configuration',customized:true}:lesson);
  const personalIndex=createSearchIndex({lessons:personalLessons});
  const result=searchCourse(personalIndex,'mooncart',{type:'lesson'}).results[0];
  assert.equal(result.lessonId,64);
  assert.equal(result.personal,true);
  assert.match(result.excerpt,/mooncart setting/);
  assert.equal(original.title,'Give every setting a trust level');
  assert.ok(!searchCourse(index,'mooncart').results.length);
});

test('explicit excluded or empty lesson arrays do not silently restore authored lessons',()=>{
  const partial=createSearchIndex({lessons:lessons.filter(lesson=>Number(lesson.id)!==72)});
  assert.deepEqual(searchCourse(partial,'lesson72').results,[]);
  assert.ok(!searchCourse(partial,'RLS').results.some(result=>result.id==='glossary:rls'));
  const none=createSearchIndex({lessons:[],activities:[],reference:{modules:[],glossary:[],sources:[]}});
  assert.equal(searchCourse(none,'lessons').total,0);
});

test('quiz distractors and standalone misconception claims never enter factual lesson snippets',()=>{
  const fixture={id:1001,module_id:1,title:'A complete cart request',question:'Who checks ownership?',definition:'The server validates ownership before a cart change.',why:'The browser is not trusted.',example:'Check the customer before saving.',steps:['Receive input.','Check ownership.','Save the change.'],exercise:'Who protects shared data?',answer:'The server enforces the ownership rule.',misconception:'Unicorn passwords prove ownership.',quiz:{choices:['Unicorn passwords prove ownership.','The server checks access.','A purple shirt checks access.'],correct:1,explanation:'The server verifies identity and checks ownership.'},isCustom:true};
  const own=createSearchIndex({lessons:[fixture],activities:[],reference:{modules:[],glossary:[],sources:[]}});
  assert.equal(searchCourse(own,'unicorn passwords').total,0);
  assert.ok(searchCourse(own,'ownership',{type:'lesson'}).results.every(result=>!result.excerpt.includes('Unicorn')));
});

test('result mutation cannot corrupt later searches and bad arguments return a safe bounded shape',()=>{
  const first=searchCourse(index,'lesson64').results[0];first.route.id=999;first.title='Changed';
  assert.equal(searchCourse(index,'lesson64').results[0].route.id,64);
  assert.notEqual(searchCourse(index,'lesson64').results[0].title,'Changed');
  for(const query of ['',null,{},'!!!'])assert.deepEqual(searchCourse(index,query).results,[]);
  assert.deepEqual(searchCourse(null,'payment').results,[]);
  assert.ok(searchCourse(index,'payment',null).results.length);
  assert.ok(createSearchIndex(null).documents.length);
});

test('reference destinations are HTTPS source links rather than executable or credential URLs',()=>{
  const unsafe=createSearchIndex({lessons:[],activities:[],reference:{modules:[],glossary:[],sources:[{title:'Fake script',url:'javascript:alert(1)'},{title:'Credential URL',url:'https://user:password@example.com'},{title:'Useful documentation',url:'https://example.com/docs',note:'API contract documentation.'}]}});
  const found=searchCourse(unsafe,'references').results;
  assert.deepEqual(found.map(result=>result.sourceUrl),['https://example.com/docs']);
});
