import { lessons as baseline, reference } from './course.mjs';
import interactions from './interactions.json' with { type: 'json' };

export const emptyCourseChanges = Object.freeze({ custom: Object.freeze([]), patches: Object.freeze({}), order: Object.freeze([]), nextId: 1001, history: Object.freeze([]) });
const MAX_CUSTOM = 50, MAX_PATCHES = 100, MAX_HISTORY = 5, MAX_CHARS = 1500000;
const MAX_ID = 99999, MAX_LESSON_CHARS = 12000;
const fields = ['title','question','definition','why','example','steps','exercise','answer','completionChecks','quiz'];
const textBounds = { title: [3,120], question: [8,600], definition: [15,2400], why: [10,1800], example: [10,2600], exercise: [8,1200], answer: [10,2400] };
const forbidden = new Set(['__proto__','prototype','constructor']);
const moduleIds = new Set(reference.modules.map(m => Number(m.id)));
const moduleRank = new Map(reference.modules.map((m,index) => [Number(m.id),index]));
const baselineIds = new Set(baseline.map(l => Number(l.id)));
const own = (value,key) => Boolean(value) && Object.hasOwn(value,key);
const clone = value => structuredClone(value);

function record(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.getOwnPropertySymbols(value).length) return false;
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.entries(Object.getOwnPropertyDescriptors(value)).every(([key,descriptor]) => !forbidden.has(key) && own(descriptor,'value'));
}
function array(value) {
  if (!Array.isArray(value) || value.length > 2000 || Object.getPrototypeOf(value) !== Array.prototype) return false;
  if (Object.getOwnPropertySymbols(value).length) return false;
  return Object.entries(Object.getOwnPropertyDescriptors(value)).every(([key,descriptor]) => (key === 'length' || /^(0|[1-9]\d*)$/.test(key)) && own(descriptor,'value'));
}
function keys(value,allowed) { return record(value) && Object.keys(value).every(key => allowed.includes(key)); }
function id(value) {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value))) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}
function text(value,min,max) {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (clean.length < min || clean.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(clean) || /<\/?[a-z][^>]*>/i.test(clean) || /\b(?:javascript|vbscript|data|file)\s*:/i.test(clean) || /\x60{3}/.test(clean)) return null;
  return clean;
}
function list(value,min,max,itemMin,itemMax) {
  if (!array(value) || value.length < min || value.length > max) return null;
  const output = Array.prototype.map.call(value,item => text(item,itemMin,itemMax));
  return output.length === value.length && output.every(Boolean) && Object.keys(value).length === value.length ? output : null;
}
function cleanQuiz(value) {
  if (!keys(value,['choices','correct','explanation'])) return null;
  const choices = list(value.choices,3,3,3,600);
  const explanation = text(value.explanation,10,1800);
  return choices && new Set(choices.map(choice=>choice.toLowerCase())).size === 3 && Number.isInteger(value.correct) && value.correct >= 0 && value.correct <= 2 && explanation ? { choices, correct:value.correct, explanation } : null;
}
export function cleanLessonPatch(value) {
  if (!keys(value,fields)) return {};
  const result = {};
  for (const field of Object.keys(value)) {
    let clean;
    if (field === 'quiz') clean = cleanQuiz(value[field]);
    else if (field === 'steps') clean = list(value[field],3,6,5,600);
    else if (field === 'completionChecks') clean = list(value[field],3,3,8,600);
    else clean = text(value[field],...textBounds[field]);
    if (!clean) return {};
    result[field] = clean;
  }
  return JSON.stringify(result).length <= MAX_LESSON_CHARS ? result : {};
}
function complete(patch) { return fields.every(field=>own(patch,field)); }
function customRecord(candidate) {
  if (!keys(candidate,[...fields,'id','module_id','nodes'])) return null;
  const lessonId = id(candidate.id), module_id = id(candidate.module_id);
  if (!lessonId || lessonId < 1001 || lessonId > MAX_ID || !moduleIds.has(module_id)) return null;
  const patch = cleanLessonPatch(Object.fromEntries(fields.filter(field=>own(candidate,field)).map(field=>[field,candidate[field]])));
  if (!complete(patch)) return null;
  const nodes = own(candidate,'nodes') ? list(candidate.nodes,3,4,2,80) : null;
  if (own(candidate,'nodes') && (!nodes || nodes.length > patch.steps.length)) return null;
  return { ...patch, id:lessonId, module_id, ...(nodes ? {nodes} : {}) };
}
function snapshot(value) {
  if (!record(value)) return { custom:[], patches:{}, order:[], nextId:1001 };
  const custom = [], seen = new Set();
  const candidates = array(value.custom) ? value.custom : [];
  for (const candidate of candidates.slice(0,MAX_CUSTOM)) {
    const item = customRecord(candidate);
    if (item && !seen.has(item.id)) { seen.add(item.id); custom.push(item); }
  }
  const valid = new Set([...baselineIds,...custom.map(item=>item.id)]);
  const patches = {};
  if (record(value.patches)) for (const [key,valuePatch] of Object.entries(value.patches).slice(0,MAX_PATCHES)) {
    const lessonId = id(key), patch = cleanLessonPatch(valuePatch);
    if (valid.has(lessonId) && Object.keys(patch).length) patches[lessonId] = patch;
  }
  const order = [...new Set((array(value.order) ? value.order.slice(0,baseline.length+MAX_CUSTOM) : []).map(id).filter(lessonId=>valid.has(lessonId)))];
  const requestedNext = id(value.nextId);
  const nextId = Math.min(MAX_ID+1,Math.max(1001,...custom.map(item=>item.id+1),requestedNext||1001));
  return { custom,patches,order,nextId };
}
function bounded(value) {
  // Discard oldest undo snapshots before rejecting an otherwise valid edit.
  // Current teaching text is never silently truncated to fit local storage.
  while (value.history.length && JSON.stringify(value).length > MAX_CHARS) value.history.shift();
  if (JSON.stringify(value).length > MAX_CHARS) throw new Error('This course copy is too large. Export it and reduce the lesson text.');
  return value;
}
export function cleanCourseChanges(value) {
  const result = snapshot(value);
  const history = record(value) && array(value.history) ? value.history.slice(-MAX_HISTORY).map(snapshot) : [];
  return bounded({ ...result,history });
}
function promptsFor(item) {
  const topic = item.title;
  return {
    understand: 'Explain '+topic+' using this rule: '+item.definition+' Give one store example and ask me a prediction question.',
    inspect: 'Inspect the repository before changing '+topic+'. Identify inputs, trust boundaries, data ownership and existing tests.',
    plan: 'Plan '+topic+' around this outcome: '+item.question+' List business rules, failure cases and acceptance checks before implementation.',
    implement: 'Implement the agreed '+topic+' change in a small reviewable step. Follow existing conventions and verify this rule: '+item.definition,
    debug: 'Investigate a failure in '+topic+'. Ask for redacted evidence, separate facts from hypotheses and test the smallest discriminating check.',
    verify: 'Verify '+topic+' with normal, invalid, unauthorized, repeated and concurrent requests where relevant. Report what actually ran.',
    review: 'Review '+topic+' for incorrect assumptions, missing validation, permission checks and incomplete failure recovery. Cite concrete evidence.',
  };
}
function stepVisual(steps,names) {
  const count = names?.length || Math.min(4,steps.length);
  const nodes = names || Array.from({length:count},(_,index)=>index === count-1 && steps.length > count ? 'Steps '+(index+1)+'–'+steps.length : 'Step '+(index+1));
  const nodeDetails = nodes.map((_,index)=>index === count-1 ? steps.slice(index).join(' ') : steps[index]);
  return { visual:{kind:'flow',nodes,caption:'Trace the steps, then check the proposed rule against evidence.'},nodeDetails };
}
function teachingLesson(item,custom,patch) {
  const merged = { ...clone(item),...clone(patch||{}), id:custom ? String(item.id) : item.id,module_id:Number(item.module_id) };
  if (custom) Object.assign(merged,{module_title:reference.modules.find(m=>Number(m.id)===merged.module_id)?.title,sources:[],details:[],debugClues:[],isCustom:true});
  if (custom || patch) { merged.prompts = promptsFor(merged);merged.prompt = merged.prompts.implement; }
  if (patch) merged.customized = true;
  if (custom || own(patch,'steps')) {
    const diagram = stepVisual(merged.steps,custom && !own(patch,'steps') ? item.nodes : undefined);
    merged.visual = diagram.visual;
    return {lesson:merged,nodeDetails:diagram.nodeDetails};
  }
  return {lesson:merged,nodeDetails:null};
}
export function buildCourse(changes = emptyCourseChanges) {
  const state = cleanCourseChanges(changes);
  const generated = [...baseline.map(item=>teachingLesson(item,false,state.patches[Number(item.id)])),...state.custom.map(item=>teachingLesson(item,true,state.patches[item.id]))];
  const rank = new Map(state.order.map((lessonId,index)=>[lessonId,index]));
  const stable = new Map(generated.map(({lesson},index)=>[Number(lesson.id),index]));
  generated.sort((a,b)=>moduleRank.get(a.lesson.module_id)-moduleRank.get(b.lesson.module_id) || (rank.get(Number(a.lesson.id)) ?? 10000)-(rank.get(Number(b.lesson.id)) ?? 10000) || stable.get(Number(a.lesson.id))-stable.get(Number(b.lesson.id)));
  const quizzes = clone(interactions);
  for (const {lesson,nodeDetails} of generated) {
    const key = String(lesson.id).padStart(2,'0');
    if (lesson.quiz || nodeDetails) {
      const existing = quizzes[key] || {};
      const reasoning = lesson.quiz || existing;
      quizzes[key] = { ...clone(reasoning),nodeDetails:nodeDetails || clone(existing.nodeDetails || lesson.visual.nodes.map(()=>lesson.definition)) };
    }
  }
  return { lessons:generated.map(item=>item.lesson),interactions:quizzes };
}
function reposition(order,lessonId,afterId,courseLessons) {
  const subject = courseLessons.find(lesson=>Number(lesson.id)===lessonId);
  const after = courseLessons.find(lesson=>Number(lesson.id)===afterId);
  if (!subject || afterId === lessonId || (afterId !== null && (!after || Number(after.module_id)!==Number(subject.module_id)))) throw new Error('Choose a different lesson in the same part for the new position.');
  const result = order.filter(item=>item!==lessonId);
  const index = afterId === null ? result.findIndex(item=>Number(courseLessons.find(lesson=>Number(lesson.id)===item)?.module_id)===Number(subject.module_id)) : result.indexOf(afterId)+1;
  result.splice(index < 0 ? result.length : index,0,lessonId);
  return result;
}
export function applyCourseChange(changes,action) {
  if (!record(action) || !['add_lesson','edit_lesson','move_lesson'].includes(action.type)) throw new Error('That course change is not supported.');
  const state = cleanCourseChanges(changes), before = snapshot(state), current = buildCourse(state).lessons;
  const next = { ...state,custom:clone(state.custom),patches:clone(state.patches),order:current.map(lesson=>Number(lesson.id)) };
  let lessonId = id(action.lessonId);
  if (action.type === 'add_lesson') {
    if (!keys(action,['type','lesson','afterLessonId','reason']) || !keys(action.lesson,[...fields,'module_id','nodes'])) throw new Error('The proposed new lesson contains unsupported fields.');
    if (next.custom.length >= MAX_CUSTOM || next.nextId > MAX_ID) throw new Error('This course copy supports up to 50 added lessons.');
    lessonId = next.nextId;
    const item = customRecord({...action.lesson,id:lessonId});
    if (!item) throw new Error('A new lesson needs its teaching text, 3–6 steps, three checks and a complete three-choice quiz.');
    const samePart = current.filter(lesson=>Number(lesson.module_id)===item.module_id);
    const after = own(action,'afterLessonId') ? action.afterLessonId : Number(samePart.at(-1)?.id)||null;
    if (after !== null && !Number.isSafeInteger(after)) throw new Error('Choose a registered lesson position.');
    next.custom.push(item);next.order.push(lessonId);next.nextId++;
    next.order = reposition(next.order,lessonId,after,[...current,item]);
  } else if (action.type === 'edit_lesson') {
    if (!keys(action,['type','lessonId','patch','reason']) || !lessonId || !current.some(lesson=>Number(lesson.id)===lessonId)) throw new Error('That lesson is no longer in this course copy.');
    if (!own(next.patches,lessonId) && Object.keys(next.patches).length >= MAX_PATCHES) throw new Error('This course copy supports up to 100 edited lessons.');
    const patch = cleanLessonPatch(action.patch);
    if (!Object.keys(patch).length) throw new Error('There are no valid bounded lesson fields to update.');
    next.patches[lessonId] = {...next.patches[lessonId],...patch};
    if (JSON.stringify(next.patches[lessonId]).length > MAX_LESSON_CHARS) throw new Error('The combined lesson patch is too large.');
    const effective = {...current.find(lesson=>Number(lesson.id)===lessonId),...next.patches[lessonId]};
    if (JSON.stringify(Object.fromEntries(fields.filter(field=>own(effective,field)).map(field=>[field,effective[field]]))).length > MAX_LESSON_CHARS) throw new Error('The updated lesson is too large.');
  } else {
    if (!keys(action,['type','lessonId','afterLessonId','reason']) || !own(action,'afterLessonId') || (action.afterLessonId !== null && !Number.isSafeInteger(action.afterLessonId))) throw new Error('Choose a registered lesson position.');
    next.order = reposition(next.order,lessonId,action.afterLessonId,current);
  }
  next.history = [...state.history,before].slice(-MAX_HISTORY);
  return {changes:bounded(next),lessonId};
}
export function undoCourseChange(changes) {
  const state = cleanCourseChanges(changes);
  if (!state.history.length) return state;
  return {...clone(state.history.at(-1)),nextId:state.nextId,history:clone(state.history.slice(0,-1))};
}
export function makeTutorCourseContext(courseLessons,currentId) {
  const valid = (Array.isArray(courseLessons) ? courseLessons : []).filter(lesson=>record(lesson)&&id(lesson.id)&&moduleIds.has(id(lesson.module_id))&&typeof lesson.title==='string').slice(0,baseline.length+MAX_CUSTOM);
  const candidates = valid.filter(lesson=>lesson.isCustom||lesson.customized).sort((a,b)=>Number(Number(b.id)===Number(currentId))-Number(Number(a.id)===Number(currentId))).slice(0,6);
  const preview = (value,max)=>typeof value==='string'?value.slice(0,max):'';
  return {
    registry:valid.map(lesson=>({id:Number(lesson.id),module_id:Number(lesson.module_id),title:preview(lesson.title,160),customized:Boolean(lesson.customized)})),
    excerpts:candidates.map(lesson=>({id:Number(lesson.id),module_id:Number(lesson.module_id),title:preview(lesson.title,160),question:preview(lesson.question,500),definition:preview(lesson.definition,1400),why:preview(lesson.why,800),example:preview(lesson.example,1000),steps:(Array.isArray(lesson.steps)?lesson.steps:[]).slice(0,6).map(step=>preview(step,300)),exercise:preview(lesson.exercise,500),answer:preview(lesson.answer,800)})),
  };
}
