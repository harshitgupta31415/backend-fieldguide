'use client';

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { createSearchIndex, searchCourse, isContextualFollowup, SEARCH_TYPES, SEARCH_TYPE_LABELS } from '../lib/search.mjs';
import { makeTutorCourseContext } from '../lib/course-workspace.mjs';
import { useCourse, useLanguage } from './LanguageProvider';
import { VoiceInput, VoiceOutput } from './TutorVoice';
import '../app/search.css';

const MAX_QUESTION = 2000;
const PROVIDERS = {openrouter:'OpenRouter',gemini:'Gemini',groq:'Groq',freeai:'Free.ai'};
const TYPE_ICONS = {lesson:'book',part:'layers',practice:'flask',game:'game',lab:'flask',glossary:'text',prompt:'spark',reference:'link',page:'grid'};
const SUGGESTIONS = [
  ['Understand a rule','Why is a payment success page not proof of payment?','pink'],
  ['Find a practical task','Practice environment variables and secrets','cyan'],
  ['Untangle a concept','Authentication vs authorization','violet'],
  ['Get a precise prompt','AI prompt for duplicate webhooks','peach'],
];

function SearchIcon({name='search',size=20}) {
  const paths = {
    search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
    spark:<><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/><path d="m20 2 .7 2.3L23 5l-2.3.7L20 8l-.7-2.3L17 5l2.3-.7Z"/></>,
    arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,
    book:<><path d="M12 5v16M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2Z"/></>,
    layers:<><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5"/></>,
    flask:<><path d="M9 3h6M10 3v6L4 19a1.3 1.3 0 0 0 1.2 2h13.6a1.3 1.3 0 0 0 1.2-2L14 9V3M7 15h10"/><path d="M10 17h.01M14 18h.01"/></>,
    game:<><path d="M7 8h10c3 0 5 9 3 11-2 2-4-3-5-3H9c-1 0-3 5-5 3-2-2 0-11 3-11Z"/><path d="M8 10v5m-2.5-2.5h5M15 11h.01M18 14h.01"/></>,
    text:<><path d="M5 5h14M12 5v14M8 19h8"/></>,
    link:<><path d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/></>,
    grid:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    close:<path d="m6 6 12 12M18 6 6 18"/>,
    check:<path d="m5 12 4 4L19 6"/>,
    copy:<><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
    reset:<><path d="M3 10a9 9 0 1 1 2 9M3 3v7h7"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.search}</svg>;
}

function Highlight({text,terms=[]}) {
  const value = typeof text === 'string' ? text : '';
  const needles = [...new Set(terms.filter(term=>typeof term==='string' && term.length>1).slice(0,20))].sort((a,b)=>b.length-a.length);
  if (!needles.length) return value;
  const escaped = needles.map(term=>term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`,'gi');
  const matches = new Set(needles.map(term=>term.toLowerCase()));
  return value.split(pattern).map((part,index)=>matches.has(part.toLowerCase())?<mark key={index}>{part}</mark>:part);
}

function InlineAnswer({text,sources,onOpen}) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[Source\s*\d+\])/gi).map((part,index)=>{
    const citation=part.match(/^\[Source\s*(\d+)\]$/i);
    if(citation){const source=sources.find(item=>item.number===Number(citation[1]));return source?<button type="button" className="sx-citation" key={index} onClick={()=>onOpen(source.route)} aria-label={`Open source ${source.number}: ${source.title}`}>{source.number}<span>↗</span></button>:part;}
    if(part.startsWith('**')&&part.endsWith('**')) return <strong key={index}><InlineAnswer text={part.slice(2,-2)} sources={sources} onOpen={onOpen}/></strong>;
    if(part.startsWith('`')&&part.endsWith('`')) return <code key={index}>{part.slice(1,-1)}</code>;
    return part;
  });
}

// Model output is always plain React text. HTML and generated URLs are not run.
function AnswerText({text,sources,onOpen}) {
  const blocks=[];let paragraph=[],list=[],code=null,ordered=false,listStart=1;
  const flushP=()=>{if(paragraph.length){blocks.push({kind:'p',text:paragraph.join('\n')});paragraph=[];}};
  const flushL=()=>{if(list.length){blocks.push({kind:ordered?'ol':'ul',items:list,start:listStart});list=[];}};
  for(const line of text.split('\n')){
    if(/^\s*```/.test(line)){flushP();flushL();if(code!==null){blocks.push({kind:'pre',text:code.join('\n')});code=null;}else code=[];continue;}
    if(code!==null){code.push(line);continue;}
    if(!line.trim()){flushP();flushL();continue;}
    if(/^\s*([-*_])\1{2,}\s*$/.test(line)){flushP();flushL();blocks.push({kind:'hr'});continue;}
    const heading=line.match(/^\s*#{1,6}\s+(.+)$/);if(heading){flushP();flushL();blocks.push({kind:'h3',text:heading[1]});continue;}
    const bullet=line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
    if(bullet){flushP();const number=line.match(/^\s*(\d+)\./),nextOrdered=Boolean(number);if(list.length&&nextOrdered!==ordered)flushL();if(!list.length)listStart=nextOrdered?Number(number[1]):1;ordered=nextOrdered;list.push(bullet[1]);continue;}
    flushL();paragraph.push(line);
  }
  flushP();flushL();if(code!==null)blocks.push({kind:'pre',text:code.join('\n')});
  return <div className="sx-answer-text">{blocks.map((block,index)=>{
    if(block.kind==='pre')return <pre key={index}><code>{block.text}</code></pre>;
    if(block.kind==='hr')return <hr key={index}/>;
    if(block.items){const Tag=block.kind;return <Tag key={index} start={block.kind==='ol'?block.start:undefined}>{block.items.map((item,i)=><li key={i}><InlineAnswer text={item} sources={sources} onOpen={onOpen}/></li>)}</Tag>;}
    const Tag=block.kind;return <Tag key={index}><InlineAnswer text={block.text} sources={sources} onOpen={onOpen}/></Tag>;
  })}</div>;
}

function safeSources(value,lessons,reference,activities) {
  if(!Array.isArray(value))return [];
  const lessonIds=new Set(lessons.map(item=>Number(item.id))),partIds=new Set(reference.modules.map(item=>Number(item.id))),practiceIds=new Set(activities.map(item=>item.id));
  const urls=new Set([...(reference.sources||[]),...lessons.flatMap(item=>item.sources||[])].map(item=>item.url).filter(url=>typeof url==='string'&&url.startsWith('https://')));
  return value.slice(0,4).flatMap((source,index)=>{
    if(!source||typeof source.title!=='string'||typeof source.excerpt!=='string')return [];
    const raw=source.route;let route;
    if(raw?.kind==='lesson'&&lessonIds.has(Number(raw.id)))route={kind:'lesson',id:Number(raw.id),...(raw.stage==='apply'?{stage:'apply',...(['understand','inspect','plan','implement','debug','verify','review'].includes(raw.promptMode)?{promptMode:raw.promptMode}:{})}:{})};
    else if(raw?.kind==='part'&&partIds.has(Number(raw.id)))route={kind:'part',id:Number(raw.id)};
    else if(raw?.kind==='practice'&&(!raw.id||practiceIds.has(raw.id)))route={kind:'practice',...(raw.id?{id:raw.id}:{})};
    else if(raw?.kind==='labs'&&['inventory','payments','api'].includes(raw.id))route={kind:'labs',id:raw.id};
    else if(['home','arcade','prompts','resources','settings','course','tutor'].includes(raw?.kind))route={kind:raw.kind,...(raw.kind==='arcade'&&['pipeline','trust','detective'].includes(raw.id)?{id:raw.id}:{}),...(raw.kind==='resources'&&typeof raw.term==='string'?{term:raw.term.slice(0,100)}:{})};
    if(!route)return [];
    return [{number:index+1,id:String(source.id||`source-${index+1}`),title:source.title.slice(0,180),excerpt:source.excerpt.slice(0,3600),route,type:SEARCH_TYPES.includes(source.type)?source.type:'lesson',personal:source.personal===true,sourceUrl:urls.has(source.sourceUrl)?source.sourceUrl:null}];
  });
}

function Evidence({sources,onOpen}) {
  if(!sources.length)return null;
  return <div className="sx-evidence"><div className="sx-evidence-title"><SearchIcon name="book" size={15}/><span>Explore the evidence</span><small>{sources.length} {sources.length===1?'source':'sources'}</small></div><div className="sx-evidence-grid">{sources.map(source=><details key={source.id}><summary><span>{source.number}</span><strong>{source.title}</strong><i aria-hidden="true">+</i></summary><div><p className="sx-source-kind">{source.personal?'Your course copy · unverified personal content':SEARCH_TYPE_LABELS[source.type] || 'Course material'}</p><blockquote>{source.excerpt}</blockquote><button type="button" onClick={()=>onOpen(source.route)}>Open in the fieldguide <SearchIcon name="arrow" size={14}/></button>{source.sourceUrl&&<a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">Official reference <SearchIcon name="link" size={12}/></a>}</div></details>)}</div></div>;
}

function officialReference(value) {
  try {const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password?url.href:null;}catch{return null;}
}

export default function SearchExperience({query='',onQueryChange,onClose,onNavigate,course,completed=[],courseContext,onTutorQuestion,requestAnswer}) {
  const localized=useCourse();const {language}=useLanguage();
  const lessons=course?.lessons||localized.lessons;
  const index=useMemo(()=>createSearchIndex({lessons,interactions:course?.interactions||localized.interactions,reference:localized.reference,activities:localized.activities}),[lessons,course?.interactions,localized.interactions,localized.reference,localized.activities]);
  const [type,setType]=useState('all'),[limit,setLimit]=useState(24),[selected,setSelected]=useState(-1),[copiedPrompt,setCopiedPrompt]=useState(null);
  const deferredQuery=useDeferredValue(query);
  const result=useMemo(()=>searchCourse(index,deferredQuery,{type,limit}),[index,deferredQuery,type,limit]);
  const matches=result.results||[];const searching=query!==deferredQuery;const term=query.trim();
  const [status,setStatus]=useState({loading:true,configured:false,accessCodeRequired:false,error:''});
  const [accessCode,setAccessCode]=useState(''),[turns,setTurns]=useState([]),[followup,setFollowup]=useState(''),[pending,setPending]=useState(null),[notice,setNotice]=useState('');
  const queryRef=useRef(null),answerRef=useRef(null),followupRef=useRef(null),accessRef=useRef(null),buttons=useRef([]),requestRef=useRef(null),statusRef=useRef(null),handledRequest=useRef(null),sequence=useRef(0);
  const initialQuery=useRef(query),previousLanguage=useRef(language);

  const checkStatus=useCallback(async()=>{
    statusRef.current?.abort();const controller=new AbortController();statusRef.current=controller;
    setStatus(previous=>({...previous,loading:true,error:''}));
    try{
      const response=await fetch('/api/search',{signal:controller.signal,cache:'no-store'});
      if(!response.ok)throw new Error('Search status unavailable');
      const body=await response.json();if(typeof body?.configured!=='boolean')throw new Error('Invalid status');
      if(statusRef.current!==controller)return;
      setStatus({loading:false,configured:body.configured,accessCodeRequired:body.accessCodeRequired===true,error:''});
    }catch(error){if(!controller.signal.aborted&&statusRef.current===controller)setStatus(previous=>({...previous,loading:false,error:'The AI connection could not be checked. Local search is still ready.'}));}
  },[]);
  useEffect(()=>{checkStatus();return()=>{statusRef.current?.abort();statusRef.current=null;requestRef.current?.controller.abort();requestRef.current=null;};},[checkStatus]);
  useEffect(()=>{
    if(initialQuery.current===query&&previousLanguage.current===language)return;
    initialQuery.current=query;previousLanguage.current=language;
    requestRef.current?.controller.abort();requestRef.current=null;
    setPending(null);setTurns([]);setFollowup('');setNotice('');setSelected(-1);setLimit(24);setCopiedPrompt(null);
  },[query,language]);
  useEffect(()=>{setSelected(-1);setLimit(24);},[type]);
  useEffect(()=>{
    function keyboard(event){
      if(event.key==='ArrowDown'&&event.target?.closest?.('.searchbox')&&matches.length){event.preventDefault();buttons.current[0]?.focus();setSelected(0);}
    }
    window.addEventListener('keydown',keyboard);return()=>window.removeEventListener('keydown',keyboard);
  },[matches.length]);

  function open(route){if(route)onNavigate?.(route);}
  async function copyPrompt(item){
    try{await navigator.clipboard.writeText(item.prompt);setCopiedPrompt(item.id);setNotice('Prompt copied. Add your project details before using it.');}
    catch{setNotice('Copy was unavailable. Open the prompt preview to select and copy its text.');}
  }
  function updateQuery(value){onQueryChange?.(value.slice(0,MAX_QUESTION));}
  function chooseSuggestion(value){updateQuery(value);queryRef.current?.focus();}
  function moveResult(event,current){
    let next=current;
    if(event.key==='ArrowDown')next=Math.min(matches.length-1,current+1);
    else if(event.key==='ArrowUp'){if(current===0){event.preventDefault();queryRef.current?.focus();setSelected(-1);return;}next=current-1;}
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=matches.length-1;
    else return;
    event.preventDefault();setSelected(next);buttons.current[next]?.focus();
  }
  function focusAnswer(){requestAnimationFrame(()=>answerRef.current?.scrollIntoView({block:'nearest',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches||document.querySelector('.motion-quiet')?'instant':'smooth'}));}
  function cancel(){
    const request=requestRef.current;if(!request)return;
    request.controller.abort();requestRef.current=null;setPending(null);
    setTurns(previous=>previous.map(turn=>turn.id===request.id?{...turn,state:'cancelled',error:'Stopped. Your question is here when you want to try again.'}:turn));
    setNotice('Answer request cancelled.');
  }
  async function ask(value=term,{retry=null,continuation=false}={}){
    if(requestRef.current)return;
    const question=String(value||'').trim();
    if(!question||question.length>MAX_QUESTION){setNotice('Enter a question between 1 and 2,000 characters.');queryRef.current?.focus();return;}
    if(status.loading){setNotice('Checking the AI connection…');return;}
    if(!status.configured||status.error){setNotice('AI answers need a configured provider connection. You can still open every local result below.');return;}
    if(status.accessCodeRequired&&!accessCode.trim()){setNotice('Enter the access code to ask AI.');accessRef.current?.focus();return;}
    const history=retry?.history|| (continuation?turns.filter(turn=>turn.state==='complete').slice(-3).flatMap(turn=>[{role:'user',content:turn.question.slice(0,4000)},{role:'assistant',content:turn.answer.slice(0,4000)}]):[]);
    const relevant=searchCourse(index,question,{limit:8}).results||[];
    const previousQuestion=[...history].reverse().find(message=>message.role==='user')?.content;
    const inherited=previousQuestion&&isContextualFollowup(question)?searchCourse(index,`${previousQuestion} ${question}`,{limit:8}).results:[];
    const personal=relevant.find(item=>item.personal&&item.lessonId)||inherited.find(item=>item.personal&&item.lessonId);
    const priorPersonal=history.length&&isContextualFollowup(question)?[...turns].reverse().find(turn=>turn.state==='complete')?.sources.find(source=>source.personal&&source.route.kind==='lesson'):null;
    const personalId=personal?.lessonId||priorPersonal?.route.id;
    const context=personalId?makeTutorCourseContext(lessons,personalId):courseContext||makeTutorCourseContext(lessons,relevant.find(item=>item.lessonId)?.lessonId);
    const payload={question,language,history:[...history],courseContext:context,...(accessCode.trim()?{accessCode:accessCode.trim()}:{})};
    while(payload.history.length&&new TextEncoder().encode(JSON.stringify(payload)).length>60*1024)payload.history.splice(0,2);
    if(new TextEncoder().encode(JSON.stringify(payload)).length>60*1024){setNotice('This course context is too large for one answer. Try a more specific lesson question.');return;}
    const id=retry?.id||`search-answer-${++sequence.current}`;
    const turn={id,question,history:payload.history,state:'pending',answer:'',sources:[],kind:'course'};
    const request={id,controller:new AbortController()};requestRef.current=request;
    setPending(id);setNotice('');setFollowup('');setTurns(previous=>retry?previous.map(item=>item.id===id?turn:item):continuation?[...previous.slice(-5),turn]:[turn]);focusAnswer();
    try{
      const response=await fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:request.controller.signal});
      let body;try{body=await response.json();}catch{throw new Error('The server returned an unreadable answer. Please try again.');}
      if(requestRef.current!==request)return;
      if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('The answer response was not recognized. Please try again.');
      if(!response.ok){
        if(response.status===401||body.accessCodeRequired)setStatus(previous=>({...previous,accessCodeRequired:true}));
        throw new Error(typeof body.error==='string'?body.error.slice(0,500):'AI could not finish this answer. Please try again.');
      }
      if(typeof body.answer!=='string'||!body.answer.trim())throw new Error('AI returned an empty answer. Please try again.');
      const sources=safeSources(body.sources,lessons,localized.reference,localized.activities);
      setTurns(previous=>previous.map(item=>item.id===id?{...item,state:'complete',answer:body.answer.slice(0,16000),sources,kind:body.kind==='general'?'general':'course',provider:typeof body.provider==='string'?body.provider:'',model:typeof body.model==='string'?body.model.slice(0,120):''}:item));
      setNotice(body.kind==='general'?'Answer ready. This is a general explanation without course sources.':'Answer ready. Open the sources to explore further.');
    }catch(error){
      if(requestRef.current!==request)return;
      setTurns(previous=>previous.map(item=>item.id===id?{...item,state:request.controller.signal.aborted?'cancelled':'error',error:request.controller.signal.aborted?'Stopped. You can retry this question.':error.message||'The request failed. Please try again.'}:item));
      setNotice('This answer did not finish. Your local results are still available.');
    }finally{if(requestRef.current===request){requestRef.current=null;setPending(null);}}
  }
  useEffect(()=>{
    if(requestAnswer?.id==null||handledRequest.current===requestAnswer.id||status.loading)return;
    if(String(requestAnswer.query||'').trim()!==term)return;
    handledRequest.current=requestAnswer.id;ask(requestAnswer.query);
  },[requestAnswer?.id,requestAnswer?.query,status.loading,status.configured,status.error,term]);

  const latest=turns.at(-1);
  const counts=result.counts||{};
  const displayedTypes=['all',...SEARCH_TYPES];
  const queryTerms=term.match(/[a-zA-Z0-9_]{2,}/g)||[];

  return <section id="search-experience" className="page search-experience" aria-label="Search and understand the fieldguide">
    <header className="sx-heading"><div><span className="sx-eyebrow"><i/> EVERY CONNECTION, ONE PLACE</span><h1>Find anything.<br/><em>Understand it.</em></h1><p>Search the whole fieldguide. Ask a question. Follow the idea wherever it takes you.</p></div><button type="button" className="sx-close" onClick={onClose} aria-label="Close search"><SearchIcon name="close" size={17}/><span>Back to learning</span><kbd>Esc</kbd></button></header>
    <form className="sx-search-form" onSubmit={event=>{event.preventDefault();ask();}}>
      <div className="sx-search-input"><SearchIcon size={24}/><input ref={queryRef} id="fieldguide-search-query" value={query} onChange={event=>updateQuery(event.target.value)} onKeyDown={event=>{if(event.key==='ArrowDown'&&matches.length){event.preventDefault();setSelected(0);buttons.current[0]?.focus();}}} placeholder="A topic, a question, a lesson number…" aria-label="Search the entire fieldguide" aria-describedby="search-keyboard-help" maxLength={MAX_QUESTION} autoComplete="off" spellCheck="false"/>{query&&<button type="button" className="sx-clear" onClick={()=>{updateQuery('');queryRef.current?.focus();}} aria-label="Clear search"><SearchIcon name="close" size={16}/></button>}<button type="submit" className="sx-ask" disabled={!term||Boolean(pending)||status.loading}><SearchIcon name="spark" size={17}/><span>{status.loading?'Connecting…':'Ask AI'}</span><span aria-hidden="true">↵</span></button></div>
      <div className="sx-search-meta"><p id="search-keyboard-help"><span><kbd>↓</kbd> browse results</span><span><kbd>Enter</kbd> ask AI</span><span>English or Hinglish</span></p><span className={`sx-ai-status ${status.configured&&!status.error?'is-ready':''}`}><i/>{status.loading?'Checking AI':status.error?'Local search ready':status.configured?'AI ready':'Local search ready'}</span></div>
    </form>
    <div className="sx-voice-row"><VoiceInput onTranscript={text=>{updateQuery(text);setNotice('Spoken search is ready. Review it, then choose Ask AI or a result.');queryRef.current?.focus();}} accessCode={accessCode} disabled={Boolean(pending)} language={language}/></div>
    {status.accessCodeRequired&&<div className="sx-access"><label htmlFor="search-access-code">AI access code</label><input id="search-access-code" ref={accessRef} type="password" autoComplete="off" value={accessCode} maxLength={256} onChange={event=>setAccessCode(event.target.value)} placeholder="Code shared by the app owner"/><small>Kept only for this search session.</small></div>}
    {!status.loading&&(!status.configured||status.error)&&<div className="sx-connection" role="status"><SearchIcon name="spark" size={19}/><div><strong>{status.error?'AI connection needs attention':'Explore now. Connect AI when you need an explanation.'}</strong><p>{status.error||'Local course search works without an API key. Configure a provider in the local server environment to enable AI answers.'}</p></div><button type="button" onClick={checkStatus}>Check again <SearchIcon name="reset" size={13}/></button></div>}
    {notice&&<p className="sx-notice" role="status">{notice}</p>}

    {turns.length>0&&<section className="sx-answer-panel" ref={answerRef} aria-label="AI search answers">
      <div className="sx-answer-heading"><span className="sx-answer-symbol"><SearchIcon name="spark" size={21}/></span><div><span className="sx-eyebrow">MAKE THE CONNECTION</span><h2>An answer to build on.</h2></div>{pending&&<button type="button" className="sx-stop" onClick={cancel}>Stop answer <span aria-hidden="true">■</span></button>}</div>
      <div className="sx-answer-turns">{turns.map((turn,turnIndex)=><article className={`sx-answer-turn ${turn.state==='pending'?'is-loading':''}`} key={turn.id}><div className="sx-asked"><span>{turnIndex?'FOLLOW-UP':'YOU ASKED'}</span><p>{turn.question}</p></div>{turn.state==='pending'?<div className="sx-thinking" role="status"><span aria-hidden="true"><i/><i/><i/></span><div><strong>Following the useful connections…</strong><p>Finding context and shaping an explanation.</p></div></div>:turn.state==='complete'?<>
        <div className={`sx-answer-kind ${turn.kind==='general'?'is-general':''}`}><SearchIcon name={turn.kind==='general'?'spark':'book'} size={14}/>{turn.kind==='general'?'General AI explanation · outside the course':'Explanation using course material'}</div>
        {turn.kind==='general'&&<p className="sx-general-note">This answer is not supported by course excerpts and has not checked the live web.</p>}
        <AnswerText text={turn.answer} sources={turn.sources} onOpen={open}/>
        <VoiceOutput text={turn.answer} accessCode={accessCode} language={language}/>
        <Evidence sources={turn.sources} onOpen={open}/>
        <div className="sx-answer-footer"><small>{[PROVIDERS[turn.provider]||turn.provider,turn.model].filter(Boolean).join(' · ')}</small>{onTutorQuestion&&<button type="button" onClick={()=>onTutorQuestion(turn.question,turn.sources.find(source=>source.route.kind==='lesson')?.route.id)}>Ask tutor about this <SearchIcon name="arrow" size={14}/></button>}</div>
      </>:<div className="sx-answer-error" role="status"><strong>{turn.state==='cancelled'?'We can come back to this.':'The answer did not come through.'}</strong><p>{turn.error}</p><button type="button" disabled={Boolean(pending)||status.loading} onClick={()=>ask(turn.question,{retry:turn})}>Try this question again <SearchIcon name="reset" size={14}/></button></div>}</article>)}</div>
      {latest?.state==='complete'&&<form className="sx-followup" onSubmit={event=>{event.preventDefault();ask(followup,{continuation:true});}}><label htmlFor="search-followup">Keep the thought going</label><div><input ref={followupRef} id="search-followup" value={followup} maxLength={MAX_QUESTION} disabled={Boolean(pending)} onChange={event=>setFollowup(event.target.value)} placeholder="Ask why, request an example, or change one detail…"/><button type="submit" disabled={!followup.trim()||Boolean(pending)} aria-label="Ask follow-up question"><SearchIcon name="arrow" size={18}/></button></div></form>}
      <p className="sx-sharing-note">AI answers can make mistakes. Your question, recent search conversation and relevant course content are sent only when you ask. Keep secrets and customer data out.</p>
    </section>}

    {!term?<div className="sx-discover"><div className="sx-section-heading"><div><span className="sx-eyebrow">START WITH CURIOSITY</span><h2>What are you looking for?</h2></div><span>{lessons.length} lessons. Many ways in.</span></div><div className="sx-suggestion-grid">{SUGGESTIONS.map(([label,text,color])=><button type="button" key={label} className={`sx-suggestion is-${color}`} onClick={()=>chooseSuggestion(text)}><span>{label}</span><strong>{text}</strong><SearchIcon name="arrow" size={19}/></button>)}</div><div className="sx-search-tips"><div><span>01</span><p><strong>Name the thing.</strong> “RLS”, “webhooks”, “lesson 64”, or “payment game”.</p></div><div><span>02</span><p><strong>Describe the problem.</strong> “My shipment timed out” or “Why is this secret public?”</p></div><div><span>03</span><p><strong>Ask for understanding.</strong> Choose Ask AI for an explanation, then explore the evidence.</p></div></div></div>:<section className="sx-results" aria-label="Search results">
      <div className="sx-results-heading"><div><span className="sx-eyebrow">IN YOUR FIELDGUIDE</span><h2>{searching?'Finding connections…':`${result.total||0} ${result.total===1?'connection':'connections'}`}</h2></div><p aria-live="polite">{searching?'Updating local results':`${result.total||0} ${result.total===1?'result':'results'}${type==='all'?'':` in ${(SEARCH_TYPE_LABELS[type]||type).toLowerCase()}`}`}</p></div>
      <div className="sx-filters" role="group" aria-label="Filter search results">{displayedTypes.map(value=><button type="button" key={value} aria-pressed={type===value} className={type===value?'is-active':''} onClick={()=>setType(value)}>{value==='all'?'Everything':SEARCH_TYPE_LABELS[value]||value}<span>{counts[value]||0}</span></button>)}</div>
      {typeof result.correction==='string'&&<p className="sx-correction"><SearchIcon name="spark" size={14}/><span>Matched similar wording: <strong>{result.correction}</strong></span></p>}
      {matches.length?<><ol className="sx-result-list" aria-label="Matching fieldguide content" aria-busy={searching}>{matches.map((item,i)=>{
        const terms=item.matchedTerms?.length?item.matchedTerms:queryTerms;
        const complete=item.type==='lesson'&&completed.includes(Number(item.lessonId));
        const referenceUrl=officialReference(item.sourceUrl);
        const hasPrompt=item.type==='prompt'&&typeof item.prompt==='string'&&Boolean(item.prompt.trim());
        return <li key={item.id} className={`sx-result type-${item.type} ${selected===i?'is-selected':''}`}>
          <button type="button" id={`search-result-${i}`} ref={element=>{buttons.current[i]=element;}} onFocus={()=>setSelected(i)} onKeyDown={event=>moveResult(event,i)} onClick={()=>open(item.route)}><span className="sx-result-icon"><SearchIcon name={TYPE_ICONS[item.type]} size={22}/></span><span className="sx-result-copy"><span className="sx-result-meta"><b>{SEARCH_TYPE_LABELS[item.type]||item.type}</b>{item.lessonId&&<span>Lesson {String(item.lessonId).padStart(2,'0')}</span>}{item.moduleId&&item.type!=='part'&&<span>Part {String(item.moduleId).padStart(2,'0')}</span>}{item.personal&&<em>Your course copy</em>}{complete&&<em className="is-complete"><SearchIcon name="check" size={11}/>Complete</em>}</span><strong className="sx-result-title"><Highlight text={item.title} terms={terms}/></strong><span className="sx-result-snippet"><Highlight text={item.snippet||item.description||item.excerpt} terms={terms}/></span><span className="sx-result-open">{item.type==='prompt'?'Open this prompt':item.type==='game'?'Play and learn':item.type==='practice'||item.type==='lab'?'Try it yourself':item.type==='reference'?'Find the reference':'Explore this connection'} <span aria-hidden="true">↗</span></span></span><span className="sx-result-arrow" aria-hidden="true"><SearchIcon name="arrow" size={18}/></span></button>
          {(hasPrompt||referenceUrl)&&<div className="sx-result-tools">{hasPrompt&&<><details className="sx-prompt-preview"><summary>Preview prompt <span aria-hidden="true">+</span></summary><pre>{item.prompt}</pre></details><button type="button" onClick={()=>copyPrompt(item)} aria-label={`Copy ${item.title}`}><SearchIcon name={copiedPrompt===item.id?'check':'copy'} size={14}/>{copiedPrompt===item.id?'Copied':'Copy prompt'}</button></>}{referenceUrl&&<a href={referenceUrl} target="_blank" rel="noopener noreferrer">Open official reference <SearchIcon name="link" size={13}/></a>}</div>}
        </li>;
      })}</ol>{result.total>matches.length&&limit<160&&<button type="button" className="sx-more" onClick={()=>setLimit(value=>Math.min(160,value+24))}>Show more connections <span>{matches.length} of {result.total}</span></button>}</>:<div className="sx-empty"><span><SearchIcon size={30}/></span><h3>{type==='all'?'No exact connection yet.':'Try a wider view.'}</h3><p>{type==='all'?'Try a shorter topic, describe the problem another way, or ask AI to explain it.':'There are no matches in this category. Everything brings all types of course material back into view.'}</p><div>{type!=='all'&&<button type="button" onClick={()=>setType('all')}>Search everything</button>}<button type="button" disabled={Boolean(pending)||status.loading} onClick={()=>ask()}><SearchIcon name="spark" size={15}/>Ask AI about this</button></div></div>}
    </section>}
  </section>;
}
