'use client';

import { useEffect, useRef, useState } from 'react';
import { lessons, reference, lessonById } from '../lib/course.mjs';
import { useLanguage } from './LanguageProvider';

const MAX_QUESTION = 2000;
const providerLabels = { openrouter: 'OpenRouter', gemini: 'Gemini', groq: 'Groq', freeai: 'Free.ai' };
const knownReferences = new Map([...reference.sources, ...lessons.flatMap(lesson => lesson.sources || [])].filter(source => typeof source.url === 'string' && source.url.startsWith('https://')).map(source => [source.url, source]));
const pad = value => String(value).padStart(2, '0');

const tutorHinglish = {
  'Open cited lesson in a new tab': 'Is source lesson ko naye tab mein kholein',
  'No course excerpts were attached to this answer. Use the lesson text to check its claims.': 'Is answer ke saath course excerpts nahi aaye. Claims ko lesson ke text se verify karein.',
  'CHECK THE COURSE EVIDENCE': 'COURSE KA EVIDENCE DEKHEIN',
  'excerpt': 'excerpt',
  'Open lesson': 'Lesson kholein',
  'in a new tab': 'naye tab mein',
  'Official references in this course': 'Is course ke official references',
  'YOUR COURSE COMPANION': 'AAPKA COURSE SAATHI',
  'Make the next': 'Agla concept',
  'idea click.': 'clear karte hain.',
  'Ask a question. Unpack a tricky example. Find the course evidence behind an explanation.': 'Sawaal poochhein, tricky example samjhein, aur explanation ke peeche course ka evidence dekhein.',
  'GIVE THE CONVERSATION CONTEXT': 'BAAT KO SAHI CONTEXT DEIN',
  'What are you exploring?': 'Kya samajhna chahte hain?',
  'Focus on a lesson': 'Ek lesson par focus karein',
  'Search across the fieldguide': 'Poore fieldguide mein dekhein',
  'Open the lesson': 'Lesson kholein',
  'THE WHOLE FIELDGUIDE': 'POORA FIELDGUIDE',
  'lessons.': 'lessons.',
  'One connected store.': 'Ek connected store.',
  'The tutor retrieves relevant course excerpts for your question. Choose a lesson to make the context more specific.': 'Tutor aapke sawaal se related course excerpts dhoondhta hai. Zyada specific context ke liye ek lesson choose karein.',
  'A GOOD WAY TO LEARN': 'SEEKHNE KA EK ACHHA TAREEKA',
  'Ask why.': 'Kyun, yeh poochhein.',
  'Start with the rule that feels unclear.': 'Jo rule clear nahi hai, wahin se shuru karein.',
  'Try an example.': 'Ek example try karein.',
  'Change one input and predict the result.': 'Ek input badlein aur result predict karein.',
  'Check the evidence.': 'Evidence check karein.',
  'Open the cited course excerpt.': 'Cited course excerpt kholkar dekhein.',
  'Course-grounded, still worth checking.': 'Course par based hai, phir bhi verify karein.',
  'The tutor can make mistakes. Its explanation is help with learning, not proof that an integration works.': 'Tutor se galti ho sakti hai. Explanation seekhne mein madad karta hai; isse live integration verify nahi hota.',
  'Course tutor conversation': 'Course tutor se baatcheet',
  'Fieldguide tutor': 'Fieldguide tutor',
  'Clear this conversation': 'Yeh conversation clear karein',
  'New conversation': 'Nayi conversation',
  'Show the local setup checklist': 'Local setup checklist dekhein',
  'Use': 'Use karein',
  'to find the supported server-side provider settings.': 'supported server-side provider settings dekhne ke liye.',
  'Place your private values in': 'Apni private values rakhein',
  '. Keep API keys out of this chat and browser code.': ' mein. API keys is chat ya browser code mein na daalein.',
  'Restart the local development server, then check the connection here.': 'Local development server restart karein, phir yahan connection check karein.',
  'Check connection again': 'Connection dobara check karein',
  'Questions and answers': 'Sawaal aur jawaab',
  'CURIOSITY IS A GOOD START.': 'CURIOSITY SE SHURU KAREIN.',
  'What would you like': 'Aaj kya',
  'to understand?': 'samajhna chahenge?',
  'YOU': 'AAP',
  'FIELDGUIDE TUTOR': 'FIELDGUIDE TUTOR',
  'Finding the useful connections in your course…': 'Aapke course mein useful connections dhoondh rahe hain…',
  'Answered by': 'Jawaab diya',
  'Tutor access code': 'Tutor access code',
  'Code shared by the app owner': 'App owner ka diya hua code',
  'This is the app’s access code, not your provider API key.': 'Yeh app ka access code hai, provider ki API key nahi.',
  'Your question': 'Aapka sawaal',
  'Ctrl / ⌘ + Enter to send': 'Bhejne ke liye Ctrl / ⌘ + Enter',
  'Cancel': 'Cancel karein',
  'Ask tutor': 'Tutor se poochhein',
  'Your question, recent chat and relevant course excerpts are sent to the configured AI provider. Notes and progress are not sent. Keep secrets and customer data out.': 'Aapka sawaal, recent chat aur relevant course excerpts configured AI provider ko bheje jaate hain. Notes aur progress nahi bheje jaate. Secrets aur customer data share na karein.',
  'Chat lives on this page only. Leaving or reloading clears it.': 'Chat sirf is page par rehti hai. Page chhodne ya reload karne par clear ho jaati hai.',
  'Source links open in a new tab.': 'Source links naye tab mein khulte hain.',
  'Checking connection': 'Connection check ho raha hai',
  'Connection needs attention': 'Connection check karna hoga',
  'Ready to explore': 'Seekhne ke liye ready',
  'Setup needed': 'Setup chahiye',
  'Let’s reconnect the tutor.': 'Tutor ko dobara connect karte hain.',
  'Your course tutor needs one setup step.': 'Course tutor ke liye ek setup step baaki hai.',
  'Configure an AI provider on the local server using the tutor instructions in README. Your course and practical missions remain available.': 'README ke tutor instructions se local server par AI provider configure karein. Course aur practical missions abhi bhi available hain.',
  'From your first request to a returned parcel, there is a reason behind every backend rule.': 'Pehli request se returned parcel tak, har backend rule ke peeche ek wajah hai.',
  'We can pick this up whenever you like.': 'Jab chahein, yahin se dobara shuru kar sakte hain.',
  'This answer didn’t come through.': 'Yeh jawaab poora nahi aa paaya.',
  'Try this question again': 'Yeh sawaal dobara poochhein',
  'Retry this question': 'Is sawaal ko retry karein',
  'What happens if…? Why does…? Help me understand…': 'Agar aisa ho toh…? Aisa kyun hota hai…? Mujhe samjhaayein…',
  'Explain it simply': 'Simple tareeke se samjhaayein',
  'Help me investigate': 'Problem investigate karne mein madad karein',
  'Check my understanding': 'Meri understanding check karein',
  'Make my prompt precise': 'Mera prompt precise banaayein',
  'Untangle a failure': 'Failure ka reason samjhein',
  'Explain what happens between clicking Add to cart and saving the result. Use the Fieldstore example.': 'Fieldstore example se samjhaayein: Add to cart click karne se result save hone tak kya hota hai?',
  'A shipment booking timed out. Why could retrying create a duplicate, and what evidence should I inspect?': 'Shipment booking timeout ho gayi. Retry se duplicate kyun ban sakta hai, aur kaunsa evidence inspect karna chahiye?',
  'Ask me one question about server-only secrets and browser-safe configuration. Wait for my answer before explaining.': 'Server-only secrets aur browser-safe configuration par mujhse ek sawaal poochhein. Explain karne se pehle mere jawaab ka wait karein.',
  'Help me write a precise prompt for implementing checkout, with ownership, trusted totals, stock and retry rules.': 'Checkout implement karne ka precise prompt likhne mein madad karein. Ownership, trusted totals, stock aur retry rules include karein.',
  'Tutor availability could not be checked. Make sure the local server is running, then check again.': 'Tutor availability check nahi ho paayi. Local server chal raha hai ya nahi dekhein, phir dobara check karein.',
  'Check the tutor connection before sending a question.': 'Sawaal bhejne se pehle tutor ka connection check karein.',
  'Enter the tutor access code shared by the person running this app.': 'App chalaane wale person ka diya hua tutor access code daalein.',
  'The server returned an unreadable response. Try again after checking the local server.': 'Server ka response padha nahi ja saka. Local server check karke dobara try karein.',
  'The tutor could not answer right now. Please try again.': 'Tutor abhi jawaab nahi de paaya. Dobara try karein.',
  'The tutor returned an empty answer. You can retry the same question.': 'Tutor ka answer khaali aaya. Isi sawaal ko retry kar sakte hain.',
  'Answer ready. Expand the course excerpts to check the explanation.': 'Jawaab ready hai. Explanation check karne ke liye course excerpts kholein.',
  'Request cancelled. Your question is kept here if you want to retry.': 'Request cancel ho gayi. Retry karne ke liye sawaal yahin rakha hai.',
  'The request failed. Check your connection and try again.': 'Request fail ho gayi. Connection check karke dobara try karein.',
  'Request cancelled.': 'Request cancel ho gayi.',
  'The tutor could not finish this answer. Your question is available to retry.': 'Tutor jawaab poora nahi kar paaya. Aap sawaal retry kar sakte hain.',
  'Request cancelled. You can retry this question when you’re ready.': 'Request cancel ho gayi. Ready hone par isi sawaal ko retry karein.',
  'Conversation cleared from this page.': 'Is page se conversation clear ho gayi.',
  'Open the tutor from this website to ask a question.': 'Sawaal poochhne ke liye isi website se tutor kholein.',
  'Enter a course question.': 'Course se related sawaal likhein.',
  'The owner must configure a server-side tutor access code of at least 16 characters.': 'Owner ko server par kam se kam 16 characters ka tutor access code configure karna hoga.',
  'Enter the tutor access code to continue.': 'Aage badhne ke liye tutor access code daalein.',
  'The tutor is busy. Wait a moment before asking another question.': 'Tutor abhi busy hai. Agla sawaal poochhne se pehle thoda rukkar try karein.',
  'The tutor could not finish this request. Try again shortly.': 'Tutor yeh request poori nahi kar paaya. Thodi der mein dobara try karein.',
  'Course excerpt': 'Course excerpt',
};

function useTutorLanguage() {
  const { language } = useLanguage();
  // Keep interface labels familiar; the selected language changes teaching answers.
  return { language, t: value => value };
}

function TutorIcon({ name = 'spark', size = 20 }) {
  const paths = {
    spark: <><path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7Z"/><path d="m20 2 .8 2.2L23 5l-2.2.8L20 8l-.8-2.2L17 5l2.2-.8Z"/></>,
    arrow: <><path d="M12 20V4m-6 6 6-6 6 6"/></>,
    book: <><path d="M12 6v15M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2Z"/></>,
    chat: <><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3h2A8.5 8.5 0 0 1 21 11.5Z"/><path d="M7 9h9M7 13h6"/></>,
    link: <><path d="M14 3h7v7M21 3l-9 9M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/></>,
    reset: <><path d="M3 10a9 9 0 1 1 2 9M3 3v7h7"/></>,
    stop: <rect x="6" y="6" width="12" height="12" rx="2"/>,
    check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.spark}</svg>;
}

function checkedSources(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((source, index) => {
    if (!source || typeof source !== 'object') return [];
    const lesson = lessonById(source.lessonId);
    if (!lesson) return [];
    const refs = (Array.isArray(source.references) ? source.references : []).flatMap(item => {
      const url = typeof item === 'string' ? item : item?.url;
      return knownReferences.has(url) ? [knownReferences.get(url)] : [];
    });
    return [{ id: String(source.id || `source-${index}`), lessonId: Number(lesson.id), title: lesson.title, section: typeof source.section === 'string' ? source.section.slice(0, 160) : 'Course excerpt', excerpt: typeof source.excerpt === 'string' ? source.excerpt.slice(0, 1600) : '', references: [...new Map(refs.map(item => [item.url, item])).values()] }];
  });
}

function InlineAnswer({ text, sources }) {
  const { t } = useTutorLanguage();
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[Lesson\s+\d+\])/gi);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index}>{part.slice(1, -1)}</code>;
    const citation = part.match(/^\[Lesson\s+(\d+)\]$/i);
    if (citation && sources.some(source => source.lessonId === Number(citation[1]))) return <a key={index} className="tutor-inline-citation" href={`#lesson/${Number(citation[1])}`} target="_blank" rel="noopener noreferrer" title={t("Open cited lesson in a new tab")}>{t("Lesson")}{" "}{citation[1]} ↗</a>;
    return part;
  });
}

// Small text-only Markdown renderer. Generated HTML and links are never executed.
function AnswerText({ answer, sources }) {
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
    if (block.type === 'heading') return <h3 key={index}><InlineAnswer text={block.text} sources={sources}/></h3>;
    if (block.type === 'list' || block.type === 'ordered') { const Tag = block.type === 'ordered' ? 'ol' : 'ul'; return <Tag key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}><InlineAnswer text={item} sources={sources}/></li>)}</Tag>; }
    return <p key={index}><InlineAnswer text={block.text} sources={sources}/></p>;
  })}</div>;
}

function SourceCards({ sources }) {
  const { t } = useTutorLanguage();
  if (!sources.length) return <p className="tutor-source-empty">{t("No course excerpts were attached to this answer. Use the lesson text to check its claims.")}</p>;
  return <div className="tutor-sources"><div className="tutor-sources-heading"><TutorIcon name="book" size={15}/><span>{t("CHECK THE COURSE EVIDENCE")}</span><small>{sources.length}{" "}{t("excerpt")}{sources.length === 1 ? '' : 's'}</small></div>{sources.map((source, index) => <details key={`${source.id}-${index}`} className="tutor-source"><summary><span className="tutor-source-number">{pad(source.lessonId)}</span><span><strong>{t(source.title)}</strong><small>{t(source.section)}</small></span><b aria-hidden="true">+</b></summary><div>{source.excerpt && <blockquote>{t(source.excerpt)}</blockquote>}<a className="tutor-source-link" href={`#lesson/${source.lessonId}`} target="_blank" rel="noopener noreferrer">{t("Open lesson")}{" "}{source.lessonId}{" "}{t("in a new tab")}{" "}<TutorIcon name="link" size={13}/></a>{source.references.length > 0 && <div className="tutor-official-links"><span>{t("Official references in this course")}</span>{source.references.map(item => <a href={item.url} key={item.url} target="_blank" rel="noopener noreferrer">{item.title}<TutorIcon name="link" size={12}/></a>)}</div>}</div></details>)}</div>;
}

function recentHistory(turns) {
  return turns.filter(turn => turn.status === 'complete').slice(-3).flatMap(turn => [{ role: 'user', content: turn.question.slice(0, 4000) }, { role: 'assistant', content: turn.answer.slice(0, 4000) }]);
}

export default function CourseTutor({ lessonId }) {
  const { language, t } = useTutorLanguage();
  const [context, setContext] = useState(lessonById(lessonId) ? String(Number(lessonId)) : '');
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState([]);
  const [status, setStatus] = useState({ loading: true, configured: false, accessCodeRequired: false, providers: [], error: '' });
  const [accessCode, setAccessCode] = useState('');
  const [pendingId, setPendingId] = useState(null);
  const [notice, setNotice] = useState('');
  const inputRef = useRef(null);
  const accessRef = useRef(null);
  const transcriptRef = useRef(null);
  const requestRef = useRef(null);
  const statusRequestRef = useRef(null);
  const counterRef = useRef(0);
  const currentLesson = lessonById(context);
  const busy = pendingId !== null;
  const englishSuggestions = currentLesson ? [
    ['Explain it simply', `Explain “${currentLesson.title}” using the Fieldstore example. What rule matters most, and why?`],
    ['Help me investigate', `For “${currentLesson.title}”, show a realistic failure and the evidence I should inspect first.`],
    ['Check my understanding', `Ask me one prediction question about “${currentLesson.title}”. Wait for my answer before explaining.`],
    ['Make my prompt precise', `Help me write a precise AI prompt for “${currentLesson.title}”, including rules, failure cases and verification.`],
  ] : [
    ['Explain it simply', 'Explain what happens between clicking Add to cart and saving the result. Use the Fieldstore example.'],
    ['Untangle a failure', 'A shipment booking timed out. Why could retrying create a duplicate, and what evidence should I inspect?'],
    ['Check my understanding', 'Ask me one question about server-only secrets and browser-safe configuration. Wait for my answer before explaining.'],
    ['Make my prompt precise', 'Help me write a precise prompt for implementing checkout, with ownership, trusted totals, stock and retry rules.'],
  ];
  const suggestions = currentLesson && language === 'hinglish' ? [
    [t('Explain it simply'), `Fieldstore example se “${currentLesson.title}” samjhaayein. Sabse important rule kya hai aur kyun?`],
    [t('Help me investigate'), `“${currentLesson.title}” mein ek realistic failure dikhaayein. Mujhe pehle kaunsa evidence inspect karna chahiye?`],
    [t('Check my understanding'), `“${currentLesson.title}” par mujhse ek prediction question poochhein. Explain karne se pehle mere jawaab ka wait karein.`],
    [t('Make my prompt precise'), `“${currentLesson.title}” ke liye precise AI prompt likhne mein madad karein. Rules, failure cases aur verification include karein.`],
  ] : englishSuggestions.map(([label, text]) => [t(label), t(text)]);

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
    if (status.accessCodeRequired && !accessCode.trim()) { setNotice('Enter the tutor access code shared by the person running this app.'); accessRef.current?.focus(); return; }
    const id = existingTurn?.id || `turn-${Date.now()}-${++counterRef.current}`;
    const history = existingTurn?.history || recentHistory(turns);
    const selectedId = existingTurn ? existingTurn.lessonId : currentLesson ? Number(currentLesson.id) : undefined;
    const payload = { question: text, language, history: [...history], ...(selectedId ? { lessonId: selectedId } : {}), ...(accessCode.trim() ? { accessCode: accessCode.trim() } : {}) };
    while (payload.history.length && new TextEncoder().encode(JSON.stringify(payload)).length > 30000) payload.history.splice(0, 2);
    const turn = { id, question: text, lessonId: selectedId, history: payload.history, status: 'pending', answer: '', sources: [] };
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
        if (result.accessCodeRequired || response.status === 401) { setStatus(value => ({ ...value, accessCodeRequired: true })); accessRef.current?.focus(); }
        const failure = new Error(typeof result.error === 'string' ? result.error.slice(0, 500) : 'The tutor could not answer right now. Please try again.');
        failure.code = typeof result.code === 'string' ? result.code : '';
        throw failure;
      }
      if (typeof result.answer !== 'string' || !result.answer.trim()) throw new Error('The tutor returned an empty answer. You can retry the same question.');
      setTurns(value => value.map(item => item.id === id ? { ...item, status: 'complete', answer: result.answer, sources: checkedSources(result.sources), provider: typeof result.provider === 'string' ? result.provider : '', model: typeof result.model === 'string' ? result.model : '' } : item));
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
    setTurns([]); setPendingId(null); setQuestion(''); setNotice('Conversation cleared from this page.'); inputRef.current?.focus();
  }

  return <div className="page tutor-page">
    <header className="tutor-page-heading"><div><span className="eyebrow">{t("YOUR COURSE COMPANION")}</span><h1>{t("Make the next")}<br/><em>{t("idea click.")}</em></h1><p>{t("Ask a question. Unpack a tricky example. Find the course evidence behind an explanation.")}</p></div><div className="tutor-heading-mark" aria-hidden="true"><span/><TutorIcon size={53}/><i>?</i></div></header>
    <div className="tutor-layout"><aside className="tutor-context-panel"><div className="tutor-context-title"><span className="tutor-mini-icon"><TutorIcon name="book" size={20}/></span><div><span className="eyebrow">{t("GIVE THE CONVERSATION CONTEXT")}</span><h2>{t("What are you exploring?")}</h2></div></div><label className="tutor-context-label" htmlFor="tutor-lesson-context">{t("Focus on a lesson")}</label><select id="tutor-lesson-context" value={context} onChange={event => setContext(event.target.value)} disabled={busy}><option value="">{t("Search across the fieldguide")}</option>{reference.modules.map(module => <optgroup key={module.id} label={`Part ${pad(module.id)} · ${t(module.title)}`}>{lessons.filter(lesson => Number(lesson.module_id) === module.id).map(lesson => <option key={lesson.id} value={String(Number(lesson.id))}>{pad(lesson.id)} · {t(lesson.title)}</option>)}</optgroup>)}</select>
      {currentLesson ? <div className="tutor-current-lesson"><span>{t("LESSON")}{" "}{pad(currentLesson.id)}</span><h3>{t(currentLesson.title)}</h3><p>{t(currentLesson.question)}</p><a href={`#lesson/${Number(currentLesson.id)}`} target="_blank" rel="noopener noreferrer">{t("Open the lesson")}{" "}<TutorIcon name="link" size={13}/></a></div> : <div className="tutor-current-lesson"><span>{t("THE WHOLE FIELDGUIDE")}</span><h3>{lessons.length}{" "}{t("lessons.")}<br/>{t("One connected store.")}</h3><p>{t("The tutor retrieves relevant course excerpts for your question. Choose a lesson to make the context more specific.")}</p></div>}
      <div className="tutor-learning-tip"><span className="eyebrow">{t("A GOOD WAY TO LEARN")}</span><ol><li><b>{t("Ask why.")}</b>{" "}{t("Start with the rule that feels unclear.")}</li><li><b>{t("Try an example.")}</b>{" "}{t("Change one input and predict the result.")}</li><li><b>{t("Check the evidence.")}</b>{" "}{t("Open the cited course excerpt.")}</li></ol></div><div className="tutor-context-footer"><span className="tutor-small-dot"/>{t("Course-grounded, still worth checking.")}<p>{t("The tutor can make mistakes. Its explanation is help with learning, not proof that an integration works.")}</p></div>
    </aside>
    <section className="tutor-conversation" aria-label={t("Course tutor conversation")}><div className="tutor-conversation-bar"><div><span className="tutor-avatar"><TutorIcon size={20}/></span><span><strong>{t("Fieldguide tutor")}</strong><small className={status.configured && !status.error ? 'is-ready' : ''}><i/>{status.loading ? t("Checking connection") : status.error ? t("Connection needs attention") : status.configured ? t("Ready to explore") : t("Setup needed")}</small></span></div><button className="tutor-clear" onClick={clearConversation} disabled={!turns.length && !question} title={t("Clear this conversation")}><TutorIcon name="reset" size={15}/><span>{t("New conversation")}</span></button></div>
      {!status.loading && (!status.configured || status.error) && <div className="tutor-setup" role="status"><span className="tutor-setup-icon"><TutorIcon name="spark" size={20}/></span><div><strong>{status.error ? t("Let’s reconnect the tutor.") : t("Your course tutor needs one setup step.")}</strong><p>{t(status.error) || t("Configure an AI provider on the local server using the tutor instructions in README. Your course and practical missions remain available.")}</p>{!status.error && <details><summary>{t("Show the local setup checklist")}</summary><ol><li>{t("Use")}{" "}<code>.env.example</code>{" "}{t("to find the supported server-side provider settings.")}</li><li>{t("Place your private values in")}{" "}<code>.env.local</code>{t(". Keep API keys out of this chat and browser code.")}</li><li>{t("Restart the local development server, then check the connection here.")}</li></ol></details>}<button type="button" onClick={checkStatus}>{t("Check connection again")}{" "}<span>↻</span></button></div></div>}
      <div className={`tutor-transcript ${turns.length ? 'has-turns' : ''}`} ref={transcriptRef} role="log" aria-label={t("Questions and answers")} aria-live="off" tabIndex={0}>
        {!turns.length && <div className="tutor-welcome"><div className="tutor-welcome-symbol"><TutorIcon size={34}/></div><span className="eyebrow">{t("CURIOSITY IS A GOOD START.")}</span><h2>{t("What would you like")}<br/>{t("to understand?")}</h2><p>{currentLesson ? (language === 'hinglish' ? `Aaiye, “${t(currentLesson.title)}” saath samajhte hain.` : `Let’s work through “${currentLesson.title}” together.`) : t("From your first request to a returned parcel, there is a reason behind every backend rule.")}</p><div className="tutor-suggestions">{suggestions.map(([label, text], index) => <button key={label} onClick={() => chooseSuggestion(text)}><span>{['↳', '⌕', '?', '⌘'][index]}</span><div><strong>{label}</strong><small>{text}</small></div><b aria-hidden="true">↗</b></button>)}</div></div>}
        {turns.map(turn => <div className="tutor-turn" key={turn.id}><div className="tutor-user-message"><div><span>{t("YOU")}</span>{turn.lessonId && <small>{t("Lesson")}{" "}{pad(turn.lessonId)}</small>}</div><p>{turn.question}</p></div><div className="tutor-assistant-message"><span className="tutor-avatar"><TutorIcon size={18}/></span><div className="tutor-answer-body"><span className="tutor-answer-label">{t("FIELDGUIDE TUTOR")}</span>{turn.status === 'pending' ? <div className="tutor-thinking" role="status"><span className="tutor-thinking-dots" aria-hidden="true"><i/><i/><i/></span><p>{t("Finding the useful connections in your course…")}</p></div> : turn.status === 'complete' ? <><AnswerText answer={turn.answer} sources={turn.sources}/><SourceCards sources={turn.sources}/>{(turn.provider || turn.model) && <p className="tutor-response-meta">{t("Answered by")}{" "}{[providerLabels[turn.provider] || turn.provider, turn.model].filter(Boolean).join(' · ')}</p>}</> : <div className="tutor-request-error"><strong>{turn.status === 'cancelled' ? t("We can pick this up whenever you like.") : t("This answer didn’t come through.")}</strong><p>{t(turn.error)}</p><button type="button" disabled={busy || !status.configured} onClick={() => send(turn)}><TutorIcon name="reset" size={14}/>{turn.status === 'cancelled' ? t("Try this question again") : t("Retry this question")}</button></div>}</div></div></div>)}
      </div>
      <form className="tutor-composer" onSubmit={event => { event.preventDefault(); send(); }}>
        {status.accessCodeRequired && <div className="tutor-access"><label htmlFor="tutor-access-code">{t("Tutor access code")}</label><input ref={accessRef} id="tutor-access-code" type="password" value={accessCode} onChange={event => { setAccessCode(event.target.value); if (notice === 'Enter the tutor access code shared by the person running this app.') setNotice(''); }} autoComplete="off" maxLength={256} placeholder={t("Code shared by the app owner")} aria-describedby="tutor-access-hint" aria-invalid={notice === 'Enter the tutor access code shared by the person running this app.'}/><small id="tutor-access-hint">{t(notice === 'Enter the tutor access code shared by the person running this app.' ? notice : "This is the app’s access code, not your provider API key.")}</small></div>}
        <label className="tutor-composer-label" htmlFor="tutor-question">{t("Your question")}</label><div className="tutor-input-wrap"><textarea ref={inputRef} id="tutor-question" rows={3} maxLength={MAX_QUESTION} value={question} onChange={event => setQuestion(event.target.value)} placeholder={currentLesson ? (language === 'hinglish' ? `“${t(currentLesson.title)}” mein kya unclear lag raha hai?` : `What feels unclear about ${currentLesson.title.toLowerCase()}?`) : t("What happens if…? Why does…? Help me understand…")} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} aria-describedby="tutor-sharing-note tutor-question-count"/><div className="tutor-input-toolbar"><span id="tutor-question-count">{question.length.toLocaleString()} / {MAX_QUESTION.toLocaleString()}<span className="tutor-key-hint">{t("Ctrl / ⌘ + Enter to send")}</span></span>{busy ? <button type="button" className="tutor-cancel" onClick={cancel}><TutorIcon name="stop" size={15}/>{t("Cancel")}</button> : <button type="submit" className="tutor-send" disabled={!question.trim() || status.loading || !status.configured || Boolean(status.error)}><span>{t("Ask tutor")}</span><TutorIcon name="arrow" size={17}/></button>}</div></div>
        <p id="tutor-sharing-note" className="tutor-sharing-note">{t("Your question, recent chat and relevant course excerpts are sent to the configured AI provider. Notes and progress are not sent. Keep secrets and customer data out.")}</p><div className="tutor-session-note"><span>{t("Chat lives on this page only. Leaving or reloading clears it.")}</span><span>{t("Source links open in a new tab.")}</span></div><p className="tutor-announcement" aria-live="polite" aria-atomic="true">{t(notice)}</p>
      </form>
    </section></div>
  </div>;
}
