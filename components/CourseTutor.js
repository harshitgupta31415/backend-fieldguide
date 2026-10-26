'use client';

import { useEffect, useRef, useState } from 'react';
import { lessons, reference, lessonById } from '../lib/course.mjs';
import { useLanguage } from './LanguageProvider';
import { VoiceInput, VoiceOutput } from './TutorVoice';
import { useAIAccess, AIAccessNotice } from './AIAccess';
import interactions from '../lib/interactions.json';
import { makeTutorCourseContext } from '../lib/course-workspace.mjs';

const MAX_QUESTION = 2000;
const providerLabels = { openrouter: 'OpenRouter', gemini: 'Gemini', groq: 'Groq', freeai: 'Free.ai' };
const knownReferences = new Map([...reference.sources, ...lessons.flatMap(lesson => lesson.sources || [])].filter(source => typeof source.url === 'string' && source.url.startsWith('https://')).map(source => [source.url, source]));
const pad = value => String(value).padStart(2, '0');

function useTutorLanguage() {
  const { language } = useLanguage();
  // Keep interface labels familiar; the selected language changes teaching answers.
  return { language, t: value => value };
}

export function TutorIcon({ name = 'spark', size = 20 }) {
  const paths = {
    spark: <><path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7Z"/><path d="m20 2 .8 2.2L23 5l-2.2.8L20 8l-.8-2.2L17 5l2.2-.8Z"/></>,
    arrow: <><path d="M12 20V4m-6 6 6-6 6 6"/></>,
    book: <><path d="M12 6v15M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2Z"/></>,
    chat: <><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3h2A8.5 8.5 0 0 1 21 11.5Z"/><path d="M7 9h9M7 13h6"/></>,
    link: <><path d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/></>,
    reset: <><path d="M3 10a9 9 0 1 1 2 9M3 3v7h7"/></>,
    stop: <rect x="6" y="6" width="12" height="12" rx="2"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    mic: <><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.spark}</svg>;
}

function checkedSources(value, course = lessons) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((source, index) => {
    if (!source || typeof source !== 'object') return [];
    const lesson = course.find(item => Number(item.id) === Number(source.lessonId));
    if (!lesson) return [];
    const refs = (Array.isArray(source.references) ? source.references : []).flatMap(item => {
      const url = typeof item === 'string' ? item : item?.url;
      return knownReferences.has(url) ? [knownReferences.get(url)] : [];
    });
    return [{ id: String(source.id || `source-${index}`), lessonId: Number(lesson.id), title: lesson.title, section: typeof source.section === 'string' ? source.section.slice(0, 160) : 'Course excerpt', excerpt: typeof source.excerpt === 'string' ? source.excerpt.slice(0, 1600) : '', references: [...new Map(refs.map(item => [item.url, item])).values()] }];
  });
}

function InlineAnswer({ text, sources, onNavigate }) {
  const { t } = useTutorLanguage();
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[Lesson\s+\d+\])/gi);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    const citation = part.match(/^\[Lesson\s+(\d+)\]$/i);
    if (citation && sources.some(source => source.lessonId === Number(citation[1]))) return <a key={index} className="tutor-inline-citation" href={`#lesson/${Number(citation[1])}`} onClick={event => { event.preventDefault(); onNavigate(Number(citation[1])); }} title="Open cited lesson">{t("Lesson")}{" "}{citation[1]} ↗</a>;
    return part;
  });
}

// Small text-only Markdown renderer. Generated HTML and links are never executed.
function AnswerText({ answer, sources, onNavigate }) {
  const blocks = [];
  const lines = answer.split('\n');
  let paragraph = [], list = [], ordered = false, code = null;
  const flushParagraph = () => { if (paragraph.length) { blocks.push({ type: 'paragraph', text: paragraph.join('\n') }); paragraph = []; } };
  const flushList = () => { if (list.length) { blocks.push({ type: ordered ? 'ordered' : 'list', items: list }); list = []; } };
  for (const line of lines) {
    if (/^\s*```/.test(line)) { flushParagraph(); flushList(); if (code !== null) { blocks.push({ type: 'code', text: code.join('\n') }); code = null; } else code = []; continue; }
    if (code !== null) { code.push(line); continue; }
    if (!line.trim()) { flushParagraph(); flushList(); continue; }
    const heading = line.match(/^\s*#{1,6}\s+(.+)$/);
    if (heading) { flushParagraph(); flushList(); blocks.push({ type: 'heading', text: heading[1] }); continue; }
    const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.+)$/);
    if (bullet) { flushParagraph(); const isOrdered = /^\s*\d+\./.test(line); if (list.length && isOrdered !== ordered) flushList(); ordered = isOrdered; list.push(bullet[1]); continue; }
    flushList(); paragraph.push(line);
  }
  flushParagraph(); flushList();
  if (code !== null) blocks.push({ type: 'code', text: code.join('\n') });
  return <div className="tutor-answer-text">{blocks.map((block, index) => {
    if (block.type === 'code') return <pre key={index}><code>{block.text}</code></pre>;
    if (block.type === 'heading') return <h3 key={index}><InlineAnswer text={block.text} sources={sources} onNavigate={onNavigate}/></h3>;
    if (block.type === 'list' || block.type === 'ordered') { const Tag = block.type === 'ordered' ? 'ol' : 'ul'; return <Tag key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><InlineAnswer text={item} sources={sources} onNavigate={onNavigate}/></li>)}</Tag>; }
    return <p key={index}><InlineAnswer text={block.text} sources={sources} onNavigate={onNavigate}/></p>;
  })}</div>;
}

function SourceCards({ sources, onNavigate }) {
  const { t } = useTutorLanguage();
  if (!sources.length) return <p className="tutor-source-empty">{t("No course excerpts were attached to this answer. Use the lesson text to check its claims.")}</p>;
  return <div className="tutor-sources"><div className="tutor-sources-heading"><TutorIcon name="book" size={15}/><span>{t("CHECK THE COURSE EVIDENCE")}</span><small>{sources.length}{" "}{t("excerpt")}{sources.length === 1 ? '' : 's'}</small></div>{sources.map((source, index) => <details key={`${source.id}-${index}`} className="tutor-source"><summary><span className="tutor-source-number">{pad(source.lessonId)}</span><span><strong>{t(source.title)}</strong><small>{t(source.section)}</small></span><b aria-hidden="true">+</b></summary><div>{source.excerpt && <blockquote>{t(source.excerpt)}</blockquote>}<a className="tutor-source-link" href={`#lesson/${source.lessonId}`} onClick={event => { event.preventDefault(); onNavigate(source.lessonId); }}>{t("Open lesson")}{" "}{source.lessonId}{" "}{t("alongside this chat")}{" "}<TutorIcon name="link" size={13}/></a>{source.references.length > 0 && <div className="tutor-official-links"><span>{t("Official references in this course")}</span>{source.references.map(item => <a href={item.url} key={item.url} target="_blank" rel="noopener noreferrer">{item.title}<TutorIcon name="link" size={12}/></a>)}</div>}</div></details>)}</div>;
}

const EDIT_FIELDS = ['title', 'question', 'definition', 'why', 'example', 'steps', 'exercise', 'answer', 'quiz', 'completionChecks'];
const FIELD_LABELS = { title: 'Title', question: 'Opening question', definition: 'The concept', why: 'Why it matters', example: 'Worked example', steps: 'How it works', exercise: 'Practice question', answer: 'Teaching answer', quiz: 'Knowledge check', completionChecks: 'Completion checks' };

function prepareProposals(value, course) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).flatMap(action => {
    if (!action || typeof action !== 'object' || !['navigate', 'add_lesson', 'edit_lesson', 'move_lesson'].includes(action.type)) return [];
    const target = course.find(item => Number(item.id) === Number(action.lessonId));
    if (action.type !== 'add_lesson' && !target) return [];
    if (action.type === 'add_lesson' && (!action.lesson || typeof action.lesson.title !== 'string')) return [];
    if (action.type === 'edit_lesson' && (!action.patch || typeof action.patch !== 'object' || !EDIT_FIELDS.some(field => Object.hasOwn(action.patch, field)))) return [];
    if (action.type === 'move_lesson' && action.afterLessonId !== null && !course.some(item => Number(item.id) === Number(action.afterLessonId))) return [];
    const group = target ? course.filter(item => Number(item.module_id) === Number(target.module_id)) : [];
    const previous = target ? group[group.findIndex(item => Number(item.id) === Number(target.id)) - 1] : null;
    const before = target ? Object.fromEntries(EDIT_FIELDS.map(field => [field, field === 'quiz' ? target.quiz || interactions[pad(target.id)] : target[field]])) : null;
    return [{ action, before, title: target?.title, previousTitle: previous?.title || null }];
  });
}

function ProposalValue({ value }) {
  if (Array.isArray(value)) return <ol>{value.map((item, index) => <li key={index}>{typeof item === 'string' ? item : JSON.stringify(item)}</li>)}</ol>;
  if (value && typeof value === 'object' && Array.isArray(value.choices)) return <><ol type="A">{value.choices.map((item,index) => <li key={index}>{String(item)}{index === value.correct && <strong> · Correct answer</strong>}</li>)}</ol><p>{value.explanation}</p></>;
  return <p>{typeof value === 'string' && value ? value : 'Not supplied'}</p>;
}

function ProposalCard({ proposal, course, result, onApply, onNavigate }) {
  const [reviewing, setReviewing] = useState(false);
  const { action, before, title, previousTitle } = proposal;
  const labels = { navigate: 'Explore a lesson', add_lesson: 'Add a lesson', edit_lesson: 'Improve a lesson', move_lesson: 'Reorder a lesson' };
  const proposed = action.type === 'add_lesson' ? action.lesson : action.patch;
  const fields = proposed ? EDIT_FIELDS.filter(field => Object.hasOwn(proposed, field)) : [];
  const afterId = action.afterLessonId;
  const afterTitle = course.find(item => Number(item.id) === Number(afterId))?.title;
  return <article className={`tutor-proposal proposal-${action.type} ${result?.ok ? 'is-applied' : ''}`}>
    <span className="tutor-proposal-kind">{result?.ok ? '✓ Applied to your course' : labels[action.type]}</span>
    <h3>{action.type === 'add_lesson' ? action.lesson.title : title}</h3>
    {typeof action.reason === 'string' && <p className="tutor-proposal-reason">{action.reason}</p>}
    {action.type === 'navigate' ? <button type="button" onClick={() => onNavigate(action.lessonId)}>Open lesson →</button> : <>
      <button type="button" className="tutor-review-toggle" aria-expanded={reviewing} onClick={() => setReviewing(value => !value)}>{reviewing ? 'Hide review' : 'Review proposed changes'} <span>{reviewing ? '−' : '+'}</span></button>
      {reviewing && <div className="tutor-change-review">
        {action.type === 'add_lesson' && <p className="tutor-placement-note">New lesson in part {action.lesson.module_id}{afterId === null ? ' · At the start of this part' : afterTitle ? ` · After ${afterTitle}` : ''}. Existing lessons are kept.</p>}
        {action.type === 'move_lesson' && <div className="tutor-field-change"><strong>Position in this part</strong><div><section><span>Before</span><p>{previousTitle ? `After ${previousTitle}` : 'At the start of this part'}</p></section><section><span>After</span><p>{afterId === null ? 'At the start of this part' : `After ${afterTitle || `lesson ${afterId}`}`}</p></section></div></div>}
        {fields.map(field => <div className="tutor-field-change" key={field}><strong>{FIELD_LABELS[field]}</strong><div>{before && <section><span>Before</span><ProposalValue value={before[field]}/></section>}<section><span>{before ? 'After' : 'Proposed content'}</span><ProposalValue value={proposed[field]}/></section></div></div>)}
      </div>}
      {result && <p className={`tutor-apply-result ${result.ok ? 'is-success' : ''}`} role="status">{result.message}</p>}
      <button type="button" className="tutor-apply" onClick={onApply} disabled={Boolean(result?.ok) || !reviewing}>{result?.ok ? 'Applied' : 'Apply this change'}</button>
      <small className="tutor-proposal-note">{result?.ok ? 'Undo is available in your course workspace.' : reviewing ? 'Changes happen only when you apply them.' : 'Open the review before applying.'}</small>
    </>}
  </article>;
}

function recentHistory(turns) {
  return turns.filter(turn => turn.status === 'complete').slice(-3).flatMap(turn => [{ role: 'user', content: turn.question.slice(0, 4000) }, { role: 'assistant', content: turn.answer.slice(0, 4000) }]);
}

export default function CourseTutor({ externalDraft, lessonId, onNavigate, onCourseAction, course = lessons, learnerSummary, courseContext, embedded = false, active = true }) {
  const availableCourse = Array.isArray(course) && course.length ? course : lessons;
  const findLesson = id => availableCourse.find(item => Number(item.id) === Number(id));
  const [intent, setIntent] = useState('explain');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [followLesson, setFollowLesson] = useState(true);
  const [actionResults, setActionResults] = useState({});
  const appliedRef = useRef(new Set());
  const navigate = id => onNavigate ? onNavigate(Number(id)) : (window.location.hash = `#lesson/${Number(id)}`);
  useEffect(() => { if (followLesson && findLesson(lessonId)) setContext(String(Number(lessonId))); }, [lessonId, followLesson, availableCourse]);
  const { language, t } = useTutorLanguage();
  const [context, setContext] = useState(findLesson(lessonId) ? String(Number(lessonId)) : '');
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState([]);
  const [status, setStatus] = useState({ loading: true, configured: false, accessCodeRequired: false, providers: [], error: '' });
  const { accessCode, invalidate } = useAIAccess();
  const [pendingId, setPendingId] = useState(null);
  const [notice, setNotice] = useState('');
  const inputRef = useRef(null);
  const transcriptRef = useRef(null);
  const requestRef = useRef(null);
  const statusRequestRef = useRef(null);
  const counterRef = useRef(0);
  useEffect(() => {if(!active)setVoiceOpen(false);}, [active]);
  useEffect(() => { if (context && !findLesson(context)) setContext(''); }, [availableCourse, context]);
  const consumedDraft = useRef(null);
  useEffect(() => {
    if (!externalDraft || consumedDraft.current === externalDraft.id || !active || pendingId !== null) return;
    consumedDraft.current = externalDraft.id;
    setQuestion(String(externalDraft.question || '').slice(0,MAX_QUESTION));
    if (externalDraft.lessonId && findLesson(externalDraft.lessonId)) { setContext(String(externalDraft.lessonId)); setFollowLesson(false); }
    setNotice('Question from search is ready. Review it, then send when you are ready.');
    const frame=requestAnimationFrame(()=>inputRef.current?.focus({preventScroll:true}));
    return ()=>cancelAnimationFrame(frame);
  },[externalDraft,active,pendingId]);
  const currentLesson = findLesson(context);
  const busy = pendingId !== null;
  const subject = currentLesson ? `“${currentLesson.title}”` : 'the ecommerce backend';
  const suggestions = {
    explain: [['Explain it simply', `Explain ${subject} with one small store example. Check what I understand before moving on.`], ['Find the missing piece', `I feel stuck on ${subject}. Help me identify what I am missing, one question at a time.`]],
    quiz: [['Ask me one question', `Ask one prediction question about ${subject}. Wait for my answer, then help me reason through it.`], ['Check my understanding', `Check whether I can explain the most important rule in ${subject}. Start with one question.`]],
    practice: [['Give me a small task', `Give me one practical exercise for ${subject}. Let me attempt it before showing the solution.`], ['Investigate a failure', `Show one realistic failure in ${subject}. Ask which evidence I would inspect first.`]],
    plan: [['Plan my next step', `Help me plan how to learn ${subject}. Ask about my understanding, then suggest a small next step.`], ['Improve my course', currentLesson ? `Review ${subject} and propose a useful lesson improvement. Explain why and let me review the changes.` : 'Help me identify a missing backend topic and propose a focused lesson I can review.']],
  }[intent];

  async function checkStatus() {
    statusRequestRef.current?.abort();
    const controller = new AbortController();
    statusRequestRef.current = controller;
    setStatus(value => ({ ...value, loading: true, error: '' }));
    try {
      const response = await fetch('/api/tutor', { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) throw new Error('The local server could not report tutor availability.');
      const value = await response.json();
      if (!value || typeof value.configured !== 'boolean') throw new Error('The tutor status response was not recognized.');
      if (statusRequestRef.current !== controller) return;
      setStatus({ loading: false, configured: value.configured, accessCodeRequired: value.accessCodeRequired === true, providers: Array.isArray(value.providers) ? value.providers.filter(item => typeof item === 'string') : [], error: '' });
    } catch (error) {
      if (controller.signal.aborted || statusRequestRef.current !== controller) return;
      setStatus(value => ({ ...value, loading: false, error: 'Tutor availability could not be checked. Make sure the local server is running, then check again.' }));
    }
  }

  useEffect(() => {
    checkStatus();
    return () => { statusRequestRef.current?.abort(); statusRequestRef.current = null; requestRef.current?.controller.abort(); requestRef.current = null; };
  }, []);

  useEffect(() => {
    const container = transcriptRef.current;
    if (!container) return;
    const quiet = window.matchMedia('(prefers-reduced-motion: reduce)').matches || Boolean(container.closest('.motion-quiet'));
    container.scrollTo({ top: container.scrollHeight, behavior: quiet ? 'instant' : 'smooth' });
  }, [turns, pendingId]);

  function chooseSuggestion(text) { setQuestion(text); setNotice(''); inputRef.current?.focus(); }

  async function send(existingTurn) {
    if (requestRef.current) return;
    const text = (existingTurn?.question || question).trim();
    if (!text) { inputRef.current?.focus(); return; }
    if (!status.configured || status.loading || status.error) { setNotice('Check the tutor connection before sending a question.'); return; }
    if (status.accessCodeRequired && !accessCode.trim()) { setNotice('Open Settings → AI access to unlock the tutor. Your message stays here.'); return; }
    const id = existingTurn?.id || `turn-${Date.now()}-${++counterRef.current}`;
    const history = existingTurn?.history || recentHistory(turns);
    const selectedId = existingTurn ? existingTurn.lessonId : currentLesson ? Number(currentLesson.id) : undefined;
    const selectedCourseContext = makeTutorCourseContext(availableCourse, selectedId);
    const payload = { question: text, language, intent: existingTurn?.intent || intent, history: [...history], ...(selectedId ? { lessonId: selectedId } : {}), ...(accessCode.trim() ? { accessCode: accessCode.trim() } : {}), courseContext: selectedCourseContext, ...(learnerSummary ? { learnerSummary } : {}) };
    while (payload.history.length && new TextEncoder().encode(JSON.stringify(payload)).length > 60 * 1024) payload.history.splice(0, 2);
    if (new TextEncoder().encode(JSON.stringify(payload)).length > 60 * 1024) { setNotice('The course context is too large to send. Open a specific lesson and try again.'); return; }
    const turn = { id, question: text, intent: payload.intent, lessonId: selectedId, history: payload.history, status: 'pending', answer: '', sources: [], proposals: [] };
    const request = { id, controller: new AbortController() };
    requestRef.current = request;
    setPendingId(id); setNotice('');
    setTurns(value => existingTurn ? value.map(item => item.id === id ? turn : item) : [...value, turn]);
    if (!existingTurn) setQuestion('');
    try {
      const response = await fetch('/api/tutor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: request.controller.signal });
      let result;
      try { result = await response.json(); } catch { throw new Error('The server returned an unreadable response. Try again after checking the local server.'); }
      if (requestRef.current !== request) return;
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('The server returned an unreadable response. Try again after checking the local server.');
      if (!response.ok) {
        if (result.accessCodeRequired || response.status === 401) { setStatus(value => ({ ...value, accessCodeRequired: true })); invalidate(accessCode); }
        const failure = new Error(typeof result.error === 'string' ? result.error.slice(0, 500) : 'The tutor could not answer right now. Please try again.');
        failure.code = typeof result.code === 'string' ? result.code : '';
        throw failure;
      }
      if (typeof result.answer !== 'string' || !result.answer.trim()) throw new Error('The tutor returned an empty answer. You can retry the same question.');
      setTurns(value => value.map(item => item.id === id ? { ...item, status: 'complete', answer: result.answer, sources: checkedSources(result.sources, availableCourse), proposals: prepareProposals(result.actions, availableCourse), warnings: Array.isArray(result.warnings) ? result.warnings.filter(item => typeof item === 'string').slice(0,5).map(item => item.slice(0,500)) : [], provider: typeof result.provider === 'string' ? result.provider : '', model: typeof result.model === 'string' ? result.model : '' } : item));
      setNotice('Answer ready. Expand the course excerpts to check the explanation.');
    } catch (error) {
      if (requestRef.current !== request) return;
      setTurns(value => value.map(item => item.id === id ? { ...item, status: request.controller.signal.aborted ? 'cancelled' : 'error', error: request.controller.signal.aborted ? 'Request cancelled. Your question is kept here if you want to retry.' : error.message || 'The request failed. Check your connection and try again.', errorCode: error.code || '' } : item));
      setNotice(request.controller.signal.aborted ? 'Request cancelled.' : 'The tutor could not finish this answer. Your question is available to retry.');
    } finally {
      if (requestRef.current === request) { requestRef.current = null; setPendingId(null); }
    }
  }

  function cancel() {
    const request = requestRef.current;
    if (!request) return;
    request.controller.abort(); requestRef.current = null; setPendingId(null);
    setTurns(value => value.map(item => item.id === request.id ? { ...item, status: 'cancelled', error: 'Request cancelled. You can retry this question when you’re ready.' } : item));
    setNotice('Request cancelled.'); inputRef.current?.focus();
  }

  function clearConversation() {
    requestRef.current?.controller.abort(); requestRef.current = null;
    setTurns([]); setPendingId(null); setQuestion(''); setActionResults({}); appliedRef.current.clear(); setNotice('Chat cleared. Applied course changes are kept.'); inputRef.current?.focus();
  }


  function applyAction(key, action) {
    if (appliedRef.current.has(key)) return;
    if (!onCourseAction) { setActionResults(previous => ({...previous,[key]:{ok:false,message:'Course editing is not available in this view.'}})); return; }
    appliedRef.current.add(key);
    try {
      const result = onCourseAction(action);
      if (!result?.ok) appliedRef.current.delete(key);
      setActionResults(previous => ({...previous,[key]:{ok:result?.ok === true,message:typeof result?.message === 'string' ? result.message : result?.ok ? 'Applied to your course.' : 'This change could not be applied.'}}));
    } catch { appliedRef.current.delete(key); setActionResults(previous => ({...previous,[key]:{ok:false,message:'The course could not be updated. Your proposal is still here.'}})); }
  }

  return <div className={`page tutor-page ${embedded ? "tutor-embedded" : ""}`}>
    <header className="tutor-page-heading"><div><span className="eyebrow">{t("YOUR COURSE COMPANION")}</span><h1>{t("Make the next")}<br/><em>{t("idea click.")}</em></h1><p>{t("Ask a question. Unpack a tricky example. Find the course evidence behind an explanation.")}</p></div><div className="tutor-heading-mark" aria-hidden="true"><span/><TutorIcon size={53}/><i>?</i></div></header>
    <div className="tutor-layout"><aside className="tutor-context-panel"><div className="tutor-context-title"><span className="tutor-mini-icon"><TutorIcon name="book" size={20}/></span><div><span className="eyebrow">{t("GIVE THE CONVERSATION CONTEXT")}</span><h2>{t("What are you exploring?")}</h2></div></div><label className="tutor-context-label" htmlFor="tutor-lesson-context">{t("Focus on a lesson")}</label><select id="tutor-lesson-context" value={context} onChange={event => { setContext(event.target.value); setFollowLesson(false); }} disabled={busy}><option value="">{t("Search across the fieldguide")}</option>{reference.modules.map(module => <optgroup key={module.id} label={`Part ${pad(module.id)} · ${t(module.title)}`}>{availableCourse.filter(lesson => Number(lesson.module_id) === module.id).map(lesson => <option key={lesson.id} value={String(Number(lesson.id))}>{pad(lesson.id)} · {t(lesson.title)}</option>)}</optgroup>)}</select>
      {currentLesson ? <div className="tutor-current-lesson"><span>{t("LESSON")}{" "}{pad(currentLesson.id)}</span><h3>{t(currentLesson.title)}</h3><p>{t(currentLesson.question)}</p><a href={`#lesson/${Number(currentLesson.id)}`} onClick={event => { event.preventDefault(); navigate(currentLesson.id); }}>{t("Open the lesson")}{" "}<TutorIcon name="link" size={13}/></a></div> : <div className="tutor-current-lesson"><span>{t("THE WHOLE FIELDGUIDE")}</span><h3>{availableCourse.length}{" "}{t("lessons.")}<br/>{t("One connected store.")}</h3><p>{t("The tutor retrieves relevant course excerpts for your question. Choose a lesson to make the context more specific.")}</p></div>}
      <div className="tutor-learning-tip"><span className="eyebrow">{t("A GOOD WAY TO LEARN")}</span><ol><li><b>{t("Ask why.")}</b>{" "}{t("Start with the rule that feels unclear.")}</li><li><b>{t("Try an example.")}</b>{" "}{t("Change one input and predict the result.")}</li><li><b>{t("Check the evidence.")}</b>{" "}{t("Open the cited course excerpt.")}</li></ol></div><div className="tutor-context-footer"><span className="tutor-small-dot"/>{t("Course-grounded, still worth checking.")}<p>{t("The tutor can make mistakes. Its explanation is help with learning, not proof that an integration works.")}</p></div>
    </aside>
    <section className="tutor-conversation" aria-label={t("Course tutor conversation")}>
      <div className="tutor-compact-toolbar"><button type="button" className="tutor-settings-toggle" aria-expanded={settingsOpen} aria-controls="tutor-chat-settings" onClick={()=>setSettingsOpen(value=>!value)} title={currentLesson?.title||'Across the whole course'}><TutorIcon name="book" size={15}/><span>{currentLesson?`Lesson ${pad(currentLesson.id)} · ${currentLesson.title}`:'Across the whole course'}</span><b>{settingsOpen?'Close settings':'Settings'}</b><span aria-hidden="true">{settingsOpen?'−':'+'}</span></button><button type="button" className="tutor-clear" onClick={clearConversation} disabled={!turns.length&&!question} title="Start a new conversation"><TutorIcon name="reset" size={14}/><span>New chat</span></button></div>
      <div className="tutor-chat-settings" id="tutor-chat-settings" hidden={!settingsOpen}>
        <div className="tutor-dock-context"><div><label htmlFor="tutor-dock-lesson">Lesson context</label><button type="button" aria-pressed={followLesson} onClick={()=>setFollowLesson(value=>!value)}>{followLesson?'Following your lesson':'Use current lesson'}</button></div><select id="tutor-dock-lesson" value={context} disabled={busy} onChange={event=>{setContext(event.target.value);setFollowLesson(false);}}><option value="">Across the whole course</option>{availableCourse.map(item=><option key={item.id} value={String(Number(item.id))}>{pad(item.id)} · {item.title}</option>)}</select></div>
        <p id="tutor-sharing-note" className="tutor-chat-details">Your question, recent chat and course context are sent when you press Send. Chat stays while you browse and clears on reload. Keep private data out. Course changes need your Apply click.</p>
        <div className="tutor-settings-footer"><span>Teaching language: {language==='hinglish'?'Hinglish':'English'}</span><button type="button" onClick={checkStatus} disabled={status.loading}>Check connection ↻</button></div>
      </div>
      <AIAccessNotice required={status.accessCodeRequired}/>
      <div className="tutor-mode-row" role="group" aria-label="How would you like to learn?">{[['explain','Explain','↳'],['quiz','Quiz me','?'],['practice','Practice','⌘'],['plan','Plan','≡']].map(([value,label,symbol])=><button type="button" key={value} disabled={busy} aria-pressed={intent===value} onClick={()=>setIntent(value)}><span aria-hidden="true">{symbol}</span>{label}</button>)}<span className={`tutor-connection-state ${status.configured&&!status.error?'is-ready':''}`} role="status"><i/>{status.loading?'Connecting':status.error?'Check connection':status.configured?'Ready':'Setup needed'}</span></div>
      {!status.loading && (!status.configured || status.error) && <div className="tutor-setup" role="status"><span className="tutor-setup-icon"><TutorIcon name="spark" size={20}/></span><div><strong>{status.error ? t("Let’s reconnect the tutor.") : t("Your course tutor needs one setup step.")}</strong><p>{t(status.error) || t("Configure an AI provider on the local server using the tutor instructions in README. Your course and practical missions remain available.")}</p>{!status.error && <details><summary>{t("Show the local setup checklist")}</summary><ol><li>{t("Use")}{" "}<code>.env.example</code>{" "}{t("to find the supported server-side provider settings.")}</li><li>{t("Place your private values in")}{" "}<code>.env.local</code>{t(". Keep API keys out of this chat and browser code.")}</li><li>{t("Restart the local development server, then check the connection here.")}</li></ol></details>}<button type="button" onClick={checkStatus}>{t("Check connection again")}{" "}<span>↻</span></button></div></div>}
      <div className={`tutor-transcript ${turns.length ? 'has-turns' : ''}`} ref={transcriptRef} role="log" aria-label={t("Questions and answers")} aria-live="off" tabIndex={0}>
        {!turns.length && <div className="tutor-welcome"><div className="tutor-welcome-symbol"><TutorIcon size={34}/></div><span className="eyebrow">{t("CURIOSITY IS A GOOD START.")}</span><h2>{t("What would you like")}<br/>{t("to understand?")}</h2><p>{currentLesson ? `We’re exploring “${currentLesson.title}”. What feels clear so far, and where do you get stuck?` : t("Bring a question, a confusing example, or a goal. We’ll work through it one step at a time.")}</p><div className="tutor-suggestions">{suggestions.map(([label, text], index) => <button key={label} onClick={() => chooseSuggestion(text)}><span>{['↳', '⌕', '?', '⌘'][index]}</span><div><strong>{label}</strong><small>{text}</small></div><b aria-hidden="true">↗</b></button>)}</div></div>}
        {turns.map(turn => <div className="tutor-turn" key={turn.id}><div className="tutor-user-message"><div><span>{t("YOU")}</span>{turn.lessonId && <small>{t("Lesson")}{" "}{pad(turn.lessonId)}</small>}</div><p>{turn.question}</p></div><div className="tutor-assistant-message"><span className="tutor-avatar"><TutorIcon size={18}/></span><div className="tutor-answer-body"><span className="tutor-answer-label">{t("FIELDGUIDE TUTOR")}</span>{turn.status === 'pending' ? <div className="tutor-thinking" role="status"><span className="tutor-thinking-dots" aria-hidden="true"><i/><i/><i/></span><p>{t("Finding the useful connections in your course…")}</p></div> : turn.status === 'complete' ? <><AnswerText answer={turn.answer} sources={turn.sources} onNavigate={navigate}/><>{turn.warnings?.length > 0 && <details className="tutor-action-warnings"><summary>Some proposed changes need attention</summary><ul>{turn.warnings.map((warning,index) => <li key={index}>{warning}</li>)}</ul></details>}</><VoiceOutput text={turn.answer} accessCode={accessCode} language={language} active={active}/>{(turn.proposals || []).map((proposal,index) => <ProposalCard key={`${turn.id}-${index}`} proposal={proposal} course={availableCourse} result={actionResults[`${turn.id}-${index}`]} onApply={() => applyAction(`${turn.id}-${index}`,proposal.action)} onNavigate={navigate}/>)}<SourceCards sources={turn.sources} onNavigate={navigate}/>{(turn.provider || turn.model) && <p className="tutor-response-meta">{t("Answered by")}{" "}{[providerLabels[turn.provider] || turn.provider, turn.model].filter(Boolean).join(' · ')}</p>}</> : <div className="tutor-request-error"><strong>{turn.status === 'cancelled' ? t("We can pick this up whenever you like.") : t("This answer didn’t come through.")}</strong><p>{t(turn.error)}</p><button type="button" disabled={busy || !status.configured} onClick={() => send(turn)}><TutorIcon name="reset" size={14}/>{turn.status === 'cancelled' ? t("Try this question again") : t("Retry this question")}</button></div>}</div></div></div>)}
      </div>
      <form className="tutor-composer" onSubmit={event => { event.preventDefault(); send(); }}>
        <div className="tutor-composer-title"><label className="tutor-composer-label" htmlFor="tutor-question">Your message</label><span id="tutor-question-count">{question.length.toLocaleString()} / {MAX_QUESTION.toLocaleString()}</span></div>
        <div className="tutor-input-wrap"><textarea ref={inputRef} id="tutor-question" rows={2} maxLength={MAX_QUESTION} value={question} onChange={event=>setQuestion(event.target.value)} placeholder="Ask a question, share an idea, or tell me where you’re stuck…" onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&!event.nativeEvent.isComposing){event.preventDefault();send();}}} aria-describedby="tutor-sharing-note tutor-question-count"/><div className="tutor-input-toolbar"><button type="button" className="tutor-voice-toggle" aria-expanded={voiceOpen} aria-controls="tutor-voice-tools" onClick={()=>setVoiceOpen(value=>!value)}><TutorIcon name="mic" size={16}/><span>{voiceOpen?'Close voice':'Voice input'}</span></button><span className="tutor-key-hint">Ctrl / ⌘ + Enter</span>{busy?<button type="button" className="tutor-cancel" onClick={cancel}><TutorIcon name="stop" size={15}/>Stop</button>:<button type="submit" className="tutor-send" disabled={!question.trim()||status.loading||!status.configured||Boolean(status.error)}><span>Send</span><TutorIcon name="arrow" size={17}/></button>}</div></div>
        <div id="tutor-voice-tools" className="tutor-voice-tools" hidden={!voiceOpen} role="region" aria-label="Voice input tools"><div className="tutor-voice-tools-heading"><strong>Speak your question</strong><button type="button" onClick={()=>setVoiceOpen(false)} aria-label="Close voice tools">×</button></div><VoiceInput onTranscript={text=>{setQuestion(text.slice(0,MAX_QUESTION));setNotice('Voice draft ready. Review it before sending.');setVoiceOpen(false);inputRef.current?.focus();}} accessCode={accessCode} disabled={busy||!active} language={language} active={active&&voiceOpen}/></div>
        <p className={`tutor-announcement ${notice.startsWith('The course context is too large')||notice.startsWith('Enter the tutor access code')?'is-visible':''}`} aria-live="polite" aria-atomic="true">{t(notice)}</p>
      </form>
    </section></div>
  </div>;
}
