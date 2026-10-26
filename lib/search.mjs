import defaultLessons from './lessons.json' with { type: 'json' };
import defaultInteractions from './interactions.json' with { type: 'json' };
import defaultReference from './reference.json' with { type: 'json' };
import defaultActivities from './activities.json' with { type: 'json' };
import { gameCatalog, pipelineRounds, trustCards, detectiveCases } from './game-data.js';

export const SEARCH_TYPES = Object.freeze(['lesson','part','practice','game','lab','glossary','prompt','reference','page']);
export const SEARCH_TYPE_LABELS = Object.freeze({all:'Everything',lesson:'Lessons',part:'Course parts',practice:'Practice missions',game:'Games',lab:'Labs',glossary:'Glossary',prompt:'Prompts',reference:'References',page:'Pages'});

/** Inherit conversation evidence only when wording refers back to a topic.
 * A question word alone is not enough: "why is the sky blue?" is a new topic. */
export function isContextualFollowup(question) {
  if (typeof question!=='string' || !question.trim() || question.length>=160) return false;
  const value=normalize(question).replace(/^(?:yes|no|okay|ok|and)\s+(?:please\s+)?/,'').replace(/^please\s+/,'');
  if (/^(?:why|why not|how|how so|how come|what next|what now|yes|no|okay|ok|continue|go on|tell me more|kyun|kyon|kaise)$/.test(value)) return true;
  if (/^what about\b/.test(value)) return true;
  // These subjects explicitly refer to the preceding explanation, unlike a
  // standalone question whose subject is a newly named thing.
  if (/^(?:why|how|what|where|when)(?: (?:is|are|was|were|do|does|did|can|could|will|would|should|isnt|arent|dont|doesnt|didnt|cant|wont|shouldnt))* (?:it|this|that|they|them|these|those)\b/.test(value)) return true;
  if (/^(?:how|why) (?:can|do|should|would) i (?:use|do|apply|test|check) (?:it|this|that)\b/.test(value)) return true;
  if (/^(?:(?:can|could|would) you )?(?:please )?(?:explain|clarify|summarize|simplify|expand|repeat|rephrase|describe|elaborate)(?: (?:it|this|that|these|those|them|the above|the previous (?:answer|example|step)))?(?: (?:again|more|further|simply|briefly|in simple words|in more detail))*$/.test(value)) return true;
  if (/^(?:(?:can|could|would) you )?(?:(?:give|show)(?: me)? )?(?:(?:an?|another|one|one more|a simple|a concrete|a practical|a small) )?example(?:s)?(?: (?:of|for) (?:it|this|that))?$/.test(value)) return true;
  return /^(?:iska|is ka|uska|us ka|ye|yeh|woh) (?:example|kaise|kyun|kyon)\b/.test(value);
}

const INDEX = Symbol('course-search-index');
const MAX_QUERY = 2000;
const STOP = new Set(`a an and are as at be been being but by can cannot could did do does doing for from had has have having how i if in into is it its just may me might more most my need of on one only or our out please should so some than that the their them then there these they this those through to too us use used using very want was we were what when where which who why will with would you your about actually also any ask before after both course explain give help know learn make much must now other really show tell understand get getting got example existing fieldstore application app project thing things way work works working question answer all no yes information instructions previous prior earlier ignore reveal assistant developer begin end fix change changes relevant meaningful small minimal appropriate behavior behaviour result results check checks review inspect implement plan find search look looking happen happens happening thing things well keep simple words short brief hai hain ho hota hoti hote tha thi ka ki ke ko se mein me par pe aur ya kya kyun kyon kaise kab kahan kis kise kiske liye lekin agar toh bhi hi ye yeh vo woh yah us iska iski iske unka unki unke hum aap tum mujhe mera meri mere apna apni apne nahi nahin na mat kar karo karna karni karne karta karti karte kiya kiye karke chahiye sakta sakti sakte raha rahi rahe ab pehle baad sirf ek do teen sab kuch zyada kam jaise wale wali wala taaki kyuki kyunki batao samjhao dekho dikhao rakhna accha acha zaroori jab tak warna phir tab koi bina saath sath tarah beech alag kafi kaafi poora`.split(/\s+/));
const ALIASES = new Map(Object.entries({
  apis:'api',db:'database',databases:'database',postgresql:'postgres',env:'environment',envs:'environment',environments:'environment',config:'configuration',configure:'configuration',configured:'configuration',configuring:'configuration',configs:'configuration',variables:'variable',secrets:'secret',credentials:'credential',keys:'key',tokens:'token',cookies:'cookie',sessions:'session',users:'user',customers:'customer',owns:'ownership',owner:'ownership',owned:'ownership',auth:'authentication',login:'authentication',signin:'authentication',authenticate:'authentication',authenticated:'authentication',authorize:'authorization',authorized:'authorization',authorise:'authorization',authorised:'authorization',permissions:'permission',secure:'security',verify:'verification',verified:'verification',verifying:'verification',verifies:'verification',grants:'grant',policies:'policy',constraints:'constraint',migrations:'migration',payments:'payment',paid:'payment',paisa:'payment',paise:'payment',charges:'charge',charged:'charge',charging:'charge',kata:'charge',refunds:'refund',refunded:'refund',refunding:'refund',webhooks:'webhook',events:'event',shipping:'shipment',shipments:'shipment',shipped:'shipment',ship:'shipment',ships:'shipment',couriers:'courier',timeouts:'timeout',retries:'retry',retried:'retry',retrying:'retry',dobara:'retry',duplicated:'duplicate',duplicates:'duplicate',deduplication:'duplicate',deduplicate:'duplicate',idempotent:'idempotency',orders:'order',carts:'cart',reservations:'reservation',reserved:'reservation',reserve:'reservation',reserving:'reservation',uploads:'upload',uploaded:'upload',uploading:'upload',files:'file',callbacks:'callback',redirects:'redirect',redirected:'redirect',deployments:'deployment',deployed:'deployment',functions:'function',connections:'connection',pools:'pool',pooling:'pool',prices:'price',pricing:'price',browsers:'browser',servers:'server',builds:'build',building:'build',built:'build',tests:'test',testing:'test',tested:'test',failures:'failure',failed:'failure',fails:'failure',bharosa:'trust',bharose:'trust',trusted:'trust',trustworthy:'trust',farak:'difference',antar:'difference',prompts:'prompt',games:'game',labs:'lab',lessons:'lesson',parts:'part',missions:'mission',simulations:'simulation',caching:'cache',cached:'cache',indexes:'index',indices:'index',returns:'return',restores:'restore',backups:'backup',notifications:'notification',emails:'email',queues:'queue',workers:'worker',logs:'log',logging:'log',debugging:'debug',buttons:'button',frontend:'browser',backend:'server',ecommerce:'commerce',shop:'store',shops:'store',stocks:'stock'
}));
const TYPE_FACTOR = {lesson:1.15,part:.92,practice:.9,game:.94,lab:.96,glossary:1.1,prompt:.48,reference:.62,page:.8};
for(const [alias,term] of Object.entries({references:'reference',pages:'page',definitions:'definition',terms:'term',chapters:'part',exercises:'practice',prove:'verification',proves:'verification',proof:'verification',proven:'verification'}))ALIASES.set(alias,term);
STOP.add('not');
const TYPE_WORDS = {lesson:'lesson concept teaching',part:'part chapter section',practice:'practice mission exercise',game:'game arcade',lab:'lab simulation sandbox',glossary:'glossary definition vocabulary term',prompt:'prompt template',reference:'reference documentation docs',page:'page settings navigation'};
const text = (value,max=16000) => typeof value === 'string' ? value.trim().slice(0,max) : '';
const list = (value,max=200) => Array.isArray(value) ? value.slice(0,max) : [];
const idNumber = value => Number.isSafeInteger(Number(value)) && Number(value)>0 ? Number(value) : undefined;

function normalize(value) {
  return text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'')
    .replace(/\brow[\s-]+level[\s-]+security\b/g,' rls ')
    .replace(/\b(?:sign[\s-]?in|log[\s-]?in)\b/g,' authentication ')
    .replace(/\btimed?[\s-]+out\b/g,' timeout ')
    .replace(/\bnext_public_?/g,' nextpublic ')
    .replace(/[^a-z0-9]+/g,' ').trim();
}
function tokens(value) { return normalize(value).split(/\s+/).map(term=>ALIASES.get(term)||term).filter(term=>term.length>1&&!STOP.has(term)); }
function safeUrl(value) {
  try { const url=new URL(value); return url.protocol==='https:'&&!url.username&&!url.password?url.href:undefined; } catch { return undefined; }
}
const emptyCounts = () => Object.fromEntries(['all',...SEARCH_TYPES].map(type=>[type,0]));
const empty = () => ({results:[],total:0,counts:emptyCounts()});
function chunk(section,value,weight=1) { const body=text(value); return body?{section,text:body,weight,tokens:new Set(tokens(body)),normalized:normalize(body)}:null; }

/** A reusable browser/server index. Explicit empty arrays remain empty. No notes,
 * credentials, files, network content, or translations are read implicitly. */
export function createSearchIndex(options={}) {
  const {lessons=defaultLessons,interactions=defaultInteractions,reference=defaultReference,activities=defaultActivities}=options&&typeof options==='object'&&!Array.isArray(options)?options:{};
  const docs=[]; const ids=new Set();
  const lessonRows=list(lessons,158).filter(row=>row&&idNumber(row.id)&&text(row.title));
  const moduleRows=list(reference?.modules,40);
  const modules=new Map(moduleRows.map(row=>[idNumber(row.id),row]));
  const add = (meta,sections=[]) => {
    if (ids.has(meta.id)||!text(meta.title)||!SEARCH_TYPES.includes(meta.type)) return;
    ids.add(meta.id);
    const chunks=[chunk('Title',meta.title,8),chunk('Summary',meta.description,3),chunk('Content type',TYPE_WORDS[meta.type],2.5),...sections.filter(Boolean)];
    const terms=new Set(chunks.flatMap(part=>[...part.tokens]));
    const anchorTerms=new Set(chunks.filter(part=>['Title','Summary','Core concept','Glossary definition'].includes(part.section)).flatMap(part=>[...part.tokens]));
    docs.push({...meta,position:docs.length,title:text(meta.title,220),description:text(meta.description,650),chunks,terms,anchorTerms,titleTerms:new Set(tokens(meta.title)),titleNormalized:normalize(meta.title)});
  };
  for (const lesson of lessonRows) {
    const id=idNumber(lesson.id), moduleId=idNumber(lesson.module_id), personal=Boolean(lesson.isCustom||lesson.customized||id>=1001);
    const quiz=lesson.quiz||interactions?.[String(id).padStart(2,'0')];
    const common={lessonId:id,moduleId,personal,route:{kind:'lesson',id}};
    const sections=[chunk('Core concept',lesson.definition,2.8),chunk('Why it matters',lesson.why,1.3),chunk('Worked example',lesson.example,1.6),chunk('How it works',list(lesson.steps,8).map(value=>text(value)).join('\n'),1.2),chunk('Practice and teaching answer',[text(lesson.exercise),text(lesson.answer)].filter(Boolean).join('\n'),1.8),...list(lesson.details,30).map(detail=>chunk(text(detail?.title)||'Practical detail',detail?.body,2)),chunk('Quiz reasoning',quiz?.explanation,1.3),chunk('Diagram explanation',list(quiz?.nodeDetails,8).map(value=>text(value)).join('\n'),1),chunk('Implementation example',[text(lesson.implementation?.code),text(lesson.implementation?.note)].filter(Boolean).join('\n'),1.3)];
    add({...common,id:`lesson:${id}`,type:'lesson',title:lesson.title,description:text(lesson.question)||text(lesson.definition)},sections);
    for (const [mode,prompt] of Object.entries(lesson.prompts||{implement:lesson.prompt}).slice(0,7)) {
      if (!['understand','inspect','plan','implement','debug','verify','review'].includes(mode)||!text(prompt)) continue;
      add({...common,id:`prompt:${id}:${mode}`,type:'prompt',title:`${mode[0].toUpperCase()+mode.slice(1)} prompt · ${lesson.title}`,description:`A reusable ${mode} prompt for lesson ${id}. Add your own project context.`,promptMode:mode,prompt:text(prompt),route:{...common.route,stage:'apply',promptMode:mode}},[chunk('Prompt template — instructions to adapt, not factual evidence',prompt,2.2)]);
    }
  }
  for (const module of moduleRows) {
    const id=idNumber(module?.id);if(!id)continue;
    const titles=lessonRows.filter(lesson=>idNumber(lesson.module_id)===id).map(lesson=>text(lesson.title));
    add({id:`part:${id}`,type:'part',title:text(module.title),description:text(module.outcome),moduleId:id,route:{kind:'part',id}},[chunk('Lessons in this part',titles.join('\n'),.8)]);
  }
  for (const activity of list(activities,40)) {
    if(!activity||!text(activity.id))continue;
    const sections=[chunk('Learning outcome',activity.completion,1.4)];
    for(const scenario of list(activity.scenarios,12)) {
      const correct=list(scenario?.choices,8)[scenario?.correct];
      sections.push(chunk('Scenario and correct reasoning',[text(scenario?.title),text(scenario?.question),text(correct?.text),text(correct?.why)].filter(Boolean).join('\n'),1.3));
    }
    for(const row of [...list(activity.orderItems,20),...list(activity.sortItems,20)]) sections.push(chunk('Practice rule',[text(row?.label),text(row?.why)].filter(Boolean).join('\n'),1.1));
    add({id:`practice:${activity.id}`,type:'practice',title:text(activity.title),description:text(activity.intro),moduleId:idNumber(activity.moduleId),route:{kind:'practice',id:text(activity.id,80)}},sections);
  }
  for(const game of gameCatalog) {
    const learning=game.id==='pipeline'?pipelineRounds.map(round=>[round.title,round.takeaway,...round.steps.map(step=>step.why)].join('\n')):game.id==='trust'?trustCards.map(card=>card.why):detectiveCases.map(item=>item.resolution);
    add({id:`game:${game.id}`,type:'game',title:game.name,description:`${game.tag}. ${game.description}`,lessonId:game.lesson,route:{kind:'arcade',id:game.id}},[chunk('Game skill',game.skill,3),...learning.map(value=>chunk('Game reasoning',value,1.1))]);
  }
  for(const lab of [
    {id:'inventory',title:'Inventory and stock lab',description:'Race for the last item. Change reservations, confirm payment and ship stock.',body:'Available stock is on-hand minus reserved stock in this simulation. Payment confirms allocation; shipment consumes the matching stock once.',lessonId:17},
    {id:'payments',title:'Payments and retries lab',description:'Explore payment timeouts and duplicate notifications without moving real money.',body:'A timeout does not prove failure. Reconcile the existing attempt and verify provider evidence before repeating an external effect.',lessonId:25},
    {id:'api',title:'API request explorer',description:'Change request inputs, cart ownership and a browser-submitted price.',body:'The server validates identity, ownership, quantity and trusted prices. A browser claim is not authoritative proof.',lessonId:4},
  ]) add({id:`lab:${lab.id}`,type:'lab',title:lab.title,description:lab.description,lessonId:lab.lessonId,route:{kind:'labs',id:lab.id}},[chunk('Simulation rule',lab.body,2)]);
  for(const entry of list(reference?.glossary,200)) if(text(entry?.term)&&text(entry?.meaning)) add({id:`glossary:${normalize(entry.term).replace(/ /g,'-')}`,type:'glossary',title:entry.term,description:entry.meaning,route:{kind:'resources',term:entry.term}},[chunk('Glossary definition',entry.meaning,3)]);
  const rls=lessonRows.find(lesson=>idNumber(lesson.id)===72&&tokens(lesson.definition).includes('rls'));
  if(rls&&!docs.some(doc=>doc.type==='glossary'&&doc.titleTerms.has('rls')))add({id:'glossary:rls',type:'glossary',title:'Row-level security (RLS)',description:text(rls.definition),lessonId:72,moduleId:idNumber(rls.module_id),personal:Boolean(rls.customized),route:{kind:'lesson',id:72}},[chunk('Definition from lesson 72',rls.definition,3)]);
  const refs=new Map();
  for(const source of [...list(reference?.sources,120),...lessonRows.flatMap(lesson=>list(lesson.sources,12))]) {
    const url=safeUrl(source?.url);if(!url)continue;
    const previous=refs.get(url);refs.set(url,{title:text(source.title)||previous?.title,note:text(source.note)||previous?.note,url});
  }
  for(const [url,source] of refs) add({id:`reference:${url}`,type:'reference',title:source.title,description:source.note||'An official reference linked from the course. Open the source to check current documentation.',sourceUrl:url,route:{kind:'resources'}},[chunk('Reference context',source.note,.8)]);
  for(const page of [
    ['home','Learning path','Explore all course parts, resume a lesson and see your progress.'],
    ['tutor','Course tutor','Ask questions, check understanding and discuss one next step. Voice input, read aloud and course-edit proposals are available.'],
    ['practice','Practice studio','Explore guided missions for local setup, environment variables, permissions, shipping and recovery.'],
    ['arcade','Backend arcade','Play Request relay, Boundary keeper and Incident detective to practice backend reasoning.'],
    ['labs','Interactive labs','Try the inventory, payments and API request simulations using synthetic data.'],
    ['prompts','Prompt workshop','Build a precise AI prompt with context, rules, failures and observable acceptance criteria.'],
    ['resources','Reference desk','Review prework, vocabulary and official documentation references.'],
    ['course','Edit course','Add, edit and reorder lessons in your personal course copy. Undo, import and export changes.'],
    ['settings','Settings','Choose English or light Hinglish for teaching explanations.'],
  ]) add({id:`page:${page[0]}`,type:'page',title:page[1],description:page[2],route:{kind:page[0]}},[]);
  const frequency=new Map(), vocabulary=new Map();
  for(const doc of docs) {
    for(const term of doc.terms) frequency.set(term,(frequency.get(term)||0)+1);
    for(const term of doc.titleTerms) vocabulary.set(term,(vocabulary.get(term)||0)+1);
  }
  for(const [alias,term] of ALIASES) if(frequency.has(term)) vocabulary.set(term,(vocabulary.get(term)||0)+1);
  return {[INDEX]:true,documents:docs,frequency,vocabulary};
}

// Bounded Damerau-Levenshtein distance supports a missing letter or transposition
// without expanding every valid term into a large, noisy set of near-matches.
function distance(left,right,limit) {
  if(Math.abs(left.length-right.length)>limit)return limit+1;
  let previous=Array.from({length:right.length+1},(_,i)=>i),beforePrevious;
  for(let i=1;i<=left.length;i++) {
    const row=[i];let best=i;
    for(let j=1;j<=right.length;j++) {
      row[j]=Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+Number(left[i-1]!==right[j-1]));
      if(beforePrevious&&i>1&&j>1&&left[i-1]===right[j-2]&&left[i-2]===right[j-1])row[j]=Math.min(row[j],beforePrevious[j-2]+1);
      best=Math.min(best,row[j]);
    }
    if(best>limit)return limit+1;
    beforePrevious=previous;previous=row;
  }
  return previous[right.length];
}
function correctedTerms(index,terms) {
  const changes=[];
  const result=terms.map((term,termIndex)=>{
    if(index.frequency.has(term)||term.length<4||term.length>24||/^\d+$/.test(term))return term;
    if(termIndex===terms.length-1&&term.length>=4) {
      const prefixes=[...index.vocabulary].filter(([candidate])=>candidate.startsWith(term)&&candidate.length>term.length&&candidate.length-term.length<=6);
      if(prefixes.length===1)return prefixes[0][0];
    }
    const limit=term.length>=9?2:1;let candidates=[];
    for(const [candidate,popularity]of index.vocabulary) {
      if(Math.abs(candidate.length-term.length)>limit||candidate[0]!==term[0])continue;
      const d=distance(term,candidate,limit);if(d<=limit)candidates.push({candidate,d,popularity});
    }
    candidates.sort((a,b)=>a.d-b.d||b.popularity-a.popularity||a.candidate.localeCompare(b.candidate));
    const first=candidates[0],second=candidates[1];
    if(!first||second&&first.d===second.d&&first.popularity<second.popularity*1.6)return term;
    changes.push({from:term,to:first.candidate});return first.candidate;
  });
  return {terms:[...new Set(result)],changes};
}
function bestChunks(doc,terms) {
  return doc.chunks.filter(part=>!['Title','Content type'].includes(part.section)).map((part,index)=>({part,index,score:terms.filter(term=>part.tokens.has(term)).length*part.weight})).sort((a,b)=>b.score-a.score||a.index-b.index).map(row=>row.part);
}
function excerptFor(doc,terms) {
  const ranked=bestChunks(doc,terms);
  const body=ranked.filter(part=>part.section!=='Summary').slice(0,3);
  return (body.length?body:ranked.slice(0,1)).map(part=>`${part.section}: ${part.text}`).join('\n\n').slice(0,3000);
}
function snippetFor(doc,terms) {
  const part=bestChunks(doc,terms)[0];const body=text(part?.text||doc.description,12000);
  if(body.length<=260)return body;
  const sentences=body.split(/(?<=[.!?])\s+|\n+/).filter(Boolean);
  const chosen=sentences.map((sentence,index)=>({sentence,index,hits:tokens(sentence).filter(term=>terms.includes(term)).length})).sort((a,b)=>b.hits-a.hits||a.index-b.index)[0]?.sentence||body;
  if(chosen.length<=260)return chosen;
  return chosen.slice(0,257).replace(/\s+\S*$/,'')+'…';
}
function publicResult(doc,terms,score) {
  const result={id:doc.id,type:doc.type,title:doc.title,description:doc.description,snippet:snippetFor(doc,terms),excerpt:excerptFor(doc,terms),section:doc.personal?'Your course copy · unverified personal content':doc.type==='prompt'?'Prompt template':SEARCH_TYPE_LABELS[doc.type],route:{...doc.route},score:Math.round(score*100)/100,matchedTerms:terms.filter(term=>doc.terms.has(term))};
  for(const key of ['lessonId','moduleId','sourceUrl','promptMode','prompt','personal'])if(doc[key]!==undefined)result[key]=doc[key];
  return result;
}

/** Multiword, typo-tolerant local search. Counts describe every matching type;
 * total describes the selected filter. Returned records never expose index state. */
export function searchCourse(index,query,options={}) {
  if(!index?.[INDEX]||typeof query!=='string'||!query.trim())return empty();
  const {type='all',limit=24}=options&&typeof options==='object'&&!Array.isArray(options)?options:{};
  const input=query.trim().slice(0,MAX_QUERY);
  const selected=SEARCH_TYPES.includes(type)?type:'all';
  const take=Number.isFinite(limit)?Math.min(200,Math.max(1,Math.floor(limit))):24;
  const numericInput=input.replace(/^(?:please\s+)?(?:explain|open|find|show|go to|take me to|summari[sz]e)\s+(?:me\s+)?(?:the\s+)?/i,'').replace(/[?.!]$/,'');
  const exact=numericInput.match(/^(?:(lesson|part|l)\s*[:#\/-]?\s*|#(?:lesson\/)?\s*)?0*(\d{1,5})\s*$/i);
  if(exact) {
    const kind=exact[1]?.toLowerCase()==='part'?'part':'lesson';const target=`${kind}:${Number(exact[2])}`;
    const doc=index.documents.find(item=>item.id===target);const counts=emptyCounts();
    if(doc){counts.all=1;counts[kind]=1;}
    const results=doc&&(selected==='all'||selected===kind)?[publicResult(doc,[],10000)]:[];
    return {results,total:results.length,counts};
  }
  // A named lesson/part is a destination, even inside a longer request. Keep
  // presentation constraints such as "in 80 words" out of numeric retrieval.
  const references=[...input.matchAll(/\b(lesson|part)\s*(?:number\s*)?[:#\/-]?\s*0*(\d{1,5})\b/gi)];
  if(references.length) {
    const lessonIds=new Set(references.filter(match=>match[1].toLowerCase()==='lesson').map(match=>Number(match[2])));
    const partIds=new Set(references.filter(match=>match[1].toLowerCase()==='part').map(match=>Number(match[2])));
    const wantsPrompt=/\bprompts?\b/i.test(input);
    const namedModes=['understand','inspect','plan','implement','debug','verify','review'].filter(mode=>new RegExp(`\\b${mode}\\b`,'i').test(input));
    const terms=[...new Set(tokens(input))].filter(term=>!/^\d+$/.test(term)&&!['lesson','part','prompt','word','words','briefly'].includes(term));
    const docs=index.documents.filter(doc=>wantsPrompt
      ? doc.type==='prompt'&&(lessonIds.size?lessonIds.has(doc.lessonId):partIds.has(doc.moduleId))
      : lessonIds.size?doc.type==='lesson'&&lessonIds.has(doc.lessonId):doc.type==='part'&&partIds.has(doc.moduleId));
    docs.sort((a,b)=>Number(namedModes.includes(b.promptMode))-Number(namedModes.includes(a.promptMode))||a.position-b.position);
    const counts=emptyCounts();for(const doc of docs){counts.all++;counts[doc.type]++;}
    const filtered=selected==='all'?docs:docs.filter(doc=>doc.type===selected);
    return {results:filtered.slice(0,take).map(doc=>publicResult(doc,terms,10000+Number(namedModes.includes(doc.promptMode))*100)),total:filtered.length,counts};
  }
  const rawTerms=[...new Set(tokens(input))].slice(0,24);
  if(!rawTerms.length)return empty();
  const corrected=correctedTerms(index,rawTerms), terms=corrected.terms;
  const idf=term=>index.frequency.has(term)?Math.max(.5,Math.log(1+(index.documents.length+1)/(index.frequency.get(term)+1))):6;
  const queryWeight=terms.reduce((sum,term)=>sum+idf(term),0);
  const phrase=normalize(input);
  const intent=terms.includes('prompt')?'prompt':terms.includes('game')?'game':terms.includes('lab')||terms.includes('simulation')?'lab':terms.includes('mission')||terms.includes('practice')?'practice':terms.includes('glossary')?'glossary':null;
  const categoryOnly=terms.length===1?({lesson:'lesson',part:'part',practice:'practice',mission:'practice',game:'game',lab:'lab',simulation:'lab',glossary:'glossary',prompt:'prompt',reference:'reference',page:'page'})[terms[0]]:null;
  const domain=terms.filter(term=>['payment','shipment','rls'].includes(term));
  const ranked=[];
  for(const doc of index.documents) {
    if(categoryOnly&&doc.type!==categoryOnly)continue;
    if(domain.some(term=>!doc.anchorTerms.has(term)))continue;
    const matched=terms.filter(term=>doc.terms.has(term));
    if(!matched.length)continue;
    const coverage=matched.reduce((sum,term)=>sum+idf(term),0)/queryWeight;
    if(coverage<.48||(terms.length>2&&matched.length===1))continue;
    let score=0;
    for(const part of doc.chunks) {
      const hits=matched.filter(term=>part.tokens.has(term));
      if(hits.length)score+=hits.reduce((sum,term)=>sum+idf(term),0)*part.weight/(1+Math.max(0,part.tokens.size-35)/180);
    }
    const titleCoverage=matched.filter(term=>doc.titleTerms.has(term)).length/terms.length;
    score*=.45+coverage*.55;
    score*=TYPE_FACTOR[doc.type];
    if(doc.titleNormalized===phrase||terms.length===1&&doc.titleTerms.size===1&&doc.titleTerms.has(terms[0]))score+=85;
    else if(phrase.length>3&&doc.titleNormalized.includes(phrase))score+=28;
    score+=titleCoverage*12;
    if(intent===doc.type)score*=3.1;
    if(intent==='practice'&&doc.type==='lab')score*=2.2;
    if(intent==='practice'&&doc.type==='game')score*=1.8;
    if(selected===doc.type)score*=1.1;
    ranked.push({doc,score});
  }
  ranked.sort((a,b)=>categoryOnly?a.doc.position-b.doc.position:b.score-a.score||SEARCH_TYPES.indexOf(a.doc.type)-SEARCH_TYPES.indexOf(b.doc.type)||a.doc.id.localeCompare(b.doc.id,undefined,{numeric:true}));
  const counts=emptyCounts();for(const item of ranked){counts.all++;counts[item.doc.type]++;}
  const filtered=selected==='all'?ranked:ranked.filter(item=>item.doc.type===selected);
  // A single lesson's seven prompt templates should not crowd out other useful
  // destinations in Everything. The Prompts filter still exposes every match.
  const seenPrompts=new Map();const visible=[];
  for(const item of filtered) {
    if(selected==='all'&&item.doc.type==='prompt'&&intent!=='prompt') {
      const used=seenPrompts.get(item.doc.lessonId)||0;if(used>=1)continue;seenPrompts.set(item.doc.lessonId,used+1);
    }
    visible.push(publicResult(item.doc,terms,item.score));if(visible.length>=take)break;
  }
  const result={results:visible,total:filtered.length,counts};
  if(corrected.changes.length&&visible.length)result.correction=corrected.changes.map(change=>`${change.from} → ${change.to}`).join(', ');
  return result;
}
