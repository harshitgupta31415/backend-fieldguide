'use client';

import { useRef, useState } from 'react';
import interactions from '../lib/interactions.json';
import '../app/course-manager.css';

const pad = value => String(value).padStart(2, '0');
const FIELDS = ['title', 'question', 'definition', 'why', 'example', 'steps', 'exercise', 'answer', 'quiz', 'completionChecks'];
const TEXT_FIELDS = [
  ['title', 'Lesson title', 'A specific concept or skill, in a few words.', 'Example: Recover an uncertain shipment booking', 160, 1],
  ['question', 'Opening question', 'Give the learner a reason to investigate.', 'What should the learner be able to explain?', 500, 2],
  ['definition', 'The concept', 'Explain what it is. Keep technical terms accurate.', 'Define the idea in plain language.', 4000, 4],
  ['why', 'Why it matters', 'Connect the idea to a concrete problem.', 'Which problem does this solve for a store?', 4000, 3],
  ['example', 'Worked example', 'Use a specific input, rule and observed result.', 'Describe a small, synthetic store example.', 4000, 4],
];

function lessonDraft(lesson) {
  const quiz = lesson?.quiz || interactions[pad(lesson?.id)] || {};
  return {
    ...Object.fromEntries(['title','question','definition','why','example','exercise','answer'].map(field => [field, lesson?.[field] || ''])),
    steps: lesson?.steps?.length ? [...lesson.steps].slice(0,6) : ['', '', ''],
    completionChecks: Array.from({length:3},(_,index) => lesson?.completionChecks?.[index] || ''),
    quiz: { choices: Array.from({length:3},(_,index) => quiz.choices?.[index] || ''), correct: Number.isInteger(quiz.correct) ? quiz.correct : null, explanation: quiz.explanation || '' },
  };
}
function cleanDraft(draft) {
  return {
    ...Object.fromEntries(['title','question','definition','why','example','exercise','answer'].map(field => [field, draft[field].trim()])),
    steps: draft.steps.map(value => value.trim()), completionChecks: draft.completionChecks.map(value => value.trim()),
    quiz: { choices: draft.quiz.choices.map(value => value.trim()), correct: draft.quiz.correct, explanation: draft.quiz.explanation.trim() },
  };
}

export default function CourseManager({ course = [], modules = [], changes = {}, onAction, onUndo, onExport, onImport, onNavigate }) {
  const [partId, setPartId] = useState(Number(modules[0]?.id) || 1);
  const [editor, setEditor] = useState(null);
  const [draft, setDraft] = useState(null);
  const [afterId, setAfterId] = useState('');
  const [notice, setNotice] = useState(null);
  const [importing, setImporting] = useState(false);
  const headingRef = useRef(null), uploadRef = useRef(null), submitRef = useRef(false);
  const selectedPart = modules.find(module => Number(module.id) === Number(partId)) || modules[0];
  const group = course.filter(lesson => Number(lesson.module_id) === Number(selectedPart?.id));
  const addedCount = Array.isArray(changes.custom) ? changes.custom.length : course.filter(lesson => lesson.isCustom).length;
  const editedCount = Object.keys(changes.patches || {}).length;
  const undoCount = Array.isArray(changes.history) ? changes.history.length : 0;
  const isNew = editor?.kind === 'add';
  const original = editor?.lesson ? lessonDraft(editor.lesson) : null;
  const checksRequired = isNew || Boolean(editor?.lesson?.completionChecks?.length) || Boolean(draft?.completionChecks.some(value => value.trim()));

  function focusEditor() { requestAnimationFrame(() => { headingRef.current?.focus({preventScroll:true}); headingRef.current?.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.querySelector('.motion-quiet') ? 'instant' : 'smooth'}); }); }
  function begin(lesson) {
    setEditor(lesson ? {kind:'edit',lesson} : {kind:'add',moduleId:Number(selectedPart.id)});
    setDraft(lessonDraft(lesson)); setAfterId(String(group.at(-1)?.id || '')); setNotice(null); focusEditor();
  }
  function update(field, value) { setDraft(previous => ({...previous,[field]:value})); }
  function updateList(field, index, value) { setDraft(previous => ({...previous,[field]:previous[field].map((item,i) => i === index ? value : item)})); }
  function updateQuiz(field, value) { setDraft(previous => ({...previous,quiz:{...previous.quiz,[field]:value}})); }
  function runAction(action) {
    try {
      const result = onAction?.(action);
      const ok = result?.ok === true;
      setNotice({ok,message:result?.message || (ok ? 'Your course has been updated.' : 'This change could not be applied.')});
      return ok;
    } catch (error) { setNotice({ok:false,message:error.message || 'This change could not be applied.'}); return false; }
  }
  function save(event) {
    event.preventDefault(); if (submitRef.current || !draft) return;
    if (!Number.isInteger(draft.quiz.correct)) { setNotice({ok:false,message:'Choose the correct answer for the three-choice quiz.'}); return; }
    const cleaned = cleanDraft(draft);
    if (checksRequired && cleaned.completionChecks.some(value => !value)) { setNotice({ok:false,message:'Complete all three learning checks, or leave all three empty for an existing lesson without checks.'}); return; }
    submitRef.current = true;
    let action;
    if (isNew) action = {type:'add_lesson',lesson:{...cleaned,module_id:Number(editor.moduleId)},afterLessonId:afterId ? Number(afterId) : null};
    else {
      const previous = cleanDraft(original);
      const patch = Object.fromEntries(FIELDS.filter(field => (field !== 'completionChecks' || checksRequired) && JSON.stringify(cleaned[field]) !== JSON.stringify(previous[field])).map(field => [field,cleaned[field]]));
      if (!Object.keys(patch).length) { setNotice({ok:false,message:'No changes to save yet. Edit a field or close the draft.'}); submitRef.current = false; return; }
      action = {type:'edit_lesson',lessonId:Number(editor.lesson.id),patch};
    }
    if (runAction(action)) { setEditor(null); setDraft(null); }
    submitRef.current = false;
  }
  function move(index, direction) {
    const lesson = group[index];
    const after = direction === 'up' ? group[index - 2] : group[index + 1];
    runAction({type:'move_lesson',lessonId:Number(lesson.id),afterLessonId:after ? Number(after.id) : null});
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
    if (file.size > 1500000) { setNotice({ok:false,message:'Choose a course export smaller than 1.5 MB.'}); return; }
    setImporting(true); setNotice(null);
    try { const result = await onImport?.(file); setNotice({ok:result?.ok !== false,message:result?.message || 'Course import processed. Review the lessons below.'}); }
    catch (error) { setNotice({ok:false,message:error.message || 'The course file could not be imported.'}); }
    finally { setImporting(false); }
  }
  function undo() {
    try { const result = onUndo?.(); setNotice({ok:result?.ok !== false,message:result?.message || 'The last course change was undone.'}); }
    catch (error) { setNotice({ok:false,message:error.message || 'The last change could not be undone.'}); }
  }

  return <div className="page course-manager">
    <header className="cm-heading"><div><span className="cm-eyebrow">YOUR COURSE WORKSPACE</span><h1>Make the course<br/><em>work for you.</em></h1><p>Add a missing idea, refine an explanation, or put the lessons in a better order. Your course copy is yours to shape.</p></div><div className="cm-heading-mark" aria-hidden="true"><span>✎</span><i>+</i><b>↕</b></div></header>
    <div className="cm-toolbar"><div className="cm-counts"><span><b>{course.length}</b> lessons</span><span><b>{addedCount}</b> added</span><span><b>{editedCount}</b> edited</span></div><div className="cm-file-actions"><button type="button" onClick={undo} disabled={!undoCount || Boolean(editor) || importing || !onUndo} title={editor ? 'Finish or close the draft before undoing' : `Undo the last change (${undoCount} available)`}>↶ Undo <small>{undoCount}</small></button><button type="button" onClick={onExport} disabled={!onExport}>↓ Export</button><button type="button" onClick={() => uploadRef.current?.click()} disabled={importing || Boolean(editor) || !onImport}>{importing ? 'Importing…' : '↑ Import'}</button><input ref={uploadRef} type="file" accept=".json,application/json" onChange={importFile} hidden/></div></div>
    {notice && <div className={`cm-notice ${notice.ok ? 'is-success' : 'is-error'}`} role="status"><span>{notice.ok ? '✓' : '↳'}</span><p>{notice.message}</p><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">×</button></div>}
    <section className="cm-part-select"><label htmlFor="cm-part">Choose a course part<select id="cm-part" value={selectedPart?.id || ''} disabled={Boolean(editor)} onChange={event => { setPartId(Number(event.target.value)); setNotice(null); }}>{modules.map(module => <option key={module.id} value={module.id}>Part {pad(module.id)} · {module.title}</option>)}</select></label><button type="button" className="cm-primary" disabled={Boolean(editor) || !selectedPart || importing} onClick={() => begin(null)}>+ Add lesson</button></section>
    {editor && draft && <form className="cm-editor" onSubmit={save}>
      <header className="cm-editor-heading"><div><span className="cm-eyebrow">{isNew ? 'A NEW LESSON' : `EDIT LESSON ${pad(editor.lesson.id)}`}</span><h2 ref={headingRef} tabIndex={-1}>{isNew ? 'Teach one idea well.' : 'Make the explanation clearer.'}</h2><p>Part {pad(selectedPart?.id)} · {selectedPart?.title}</p></div><button type="button" onClick={() => { setEditor(null); setDraft(null); }} aria-label="Close and discard this draft">×</button></header>
      <section className="cm-form-section"><div className="cm-section-heading"><span>01</span><div><h3>The idea and the reason</h3><p>Write for someone who needs to understand the behavior before directing AI.</p></div></div><div className="cm-field-grid">{TEXT_FIELDS.map(([field,label,hint,placeholder,maxLength,rows]) => <label key={field} className={field === 'title' ? 'cm-full-width' : ''} htmlFor={`cm-${field}`}><strong>{label}</strong><small>{hint}</small>{rows === 1 ? <input id={`cm-${field}`} value={draft[field]} onChange={event => update(field,event.target.value)} placeholder={placeholder} maxLength={maxLength} required/> : <textarea id={`cm-${field}`} rows={rows} value={draft[field]} onChange={event => update(field,event.target.value)} placeholder={placeholder} maxLength={maxLength} required/>}</label>)}</div></section>
      <section className="cm-form-section"><div className="cm-section-heading"><span>02</span><div><h3>A small sequence</h3><p>Use 3–6 steps. Name what happens and why the order matters.</p></div></div><div className="cm-step-fields">{draft.steps.map((step,index) => <div key={index}><label htmlFor={`cm-step-${index}`}><span>Step {index+1}</span><textarea id={`cm-step-${index}`} rows={2} value={step} onChange={event => updateList('steps',index,event.target.value)} maxLength={800} placeholder="Describe one concrete step." required/></label>{draft.steps.length > 3 && <button type="button" aria-label={`Remove step ${index+1}`} onClick={() => update('steps',draft.steps.filter((_,i) => i !== index))}>×</button>}</div>)}</div><button type="button" className="cm-text-button" disabled={draft.steps.length >= 6} onClick={() => update('steps',[...draft.steps,''])}>+ Add a step <small>{draft.steps.length}/6</small></button></section>
      <section className="cm-form-section"><div className="cm-section-heading"><span>03</span><div><h3>Check the understanding</h3><p>Ask for a prediction, then explain the rule behind the answer.</p></div></div><div className="cm-field-grid"><label htmlFor="cm-exercise"><strong>Practice question</strong><textarea id="cm-exercise" rows={3} value={draft.exercise} onChange={event => update('exercise',event.target.value)} maxLength={4000} placeholder="What should the learner predict or investigate?" required/></label><label htmlFor="cm-answer"><strong>Teaching answer</strong><textarea id="cm-answer" rows={3} value={draft.answer} onChange={event => update('answer',event.target.value)} maxLength={4000} placeholder="Explain the answer using the rule and example." required/></label></div><fieldset className="cm-quiz"><legend>Three-choice quiz</legend><p>Select the correct option. Give each option a clear, distinct meaning.</p>{draft.quiz.choices.map((choice,index) => <div className={`cm-quiz-choice ${draft.quiz.correct === index ? 'is-correct' : ''}`} key={index}><label className="cm-correct-choice"><input type="radio" name="cm-correct-answer" checked={draft.quiz.correct === index} onChange={() => updateQuiz('correct',index)} required/><span>{String.fromCharCode(65+index)}</span><small>{draft.quiz.correct === index ? 'Correct' : 'Set correct'}</small></label><label className="cm-choice-text" htmlFor={`cm-choice-${index}`}><span className="cm-sr-only">Answer option {String.fromCharCode(65+index)}</span><textarea id={`cm-choice-${index}`} rows={2} value={choice} onChange={event => updateQuiz('choices',draft.quiz.choices.map((value,i) => i === index ? event.target.value : value))} maxLength={700} placeholder={`Write answer option ${String.fromCharCode(65+index)}.`} required/></label></div>)}<label htmlFor="cm-quiz-explanation"><strong>Why this answer is correct</strong><textarea id="cm-quiz-explanation" rows={3} value={draft.quiz.explanation} onChange={event => updateQuiz('explanation',event.target.value)} maxLength={1500} placeholder="Explain the reasoning, including what the other options miss." required/></label></fieldset></section>
      <section className="cm-form-section"><div className="cm-section-heading"><span>04</span><div><h3>Make learning observable</h3><p>Three checks a learner can explain or demonstrate. {isNew || editor.lesson?.completionChecks?.length ? 'All three are required.' : 'For this existing lesson, you may leave all three empty or add a complete set.'}</p></div></div><div className="cm-check-fields">{draft.completionChecks.map((check,index) => <label htmlFor={`cm-check-${index}`} key={index}><span>{index+1}</span><input id={`cm-check-${index}`} value={check} onChange={event => updateList('completionChecks',index,event.target.value)} maxLength={800} placeholder="I can explain or demonstrate…" required={checksRequired}/></label>)}</div>{isNew && <label className="cm-insertion" htmlFor="cm-position"><strong>Place the new lesson</strong><select id="cm-position" value={afterId} onChange={event => setAfterId(event.target.value)}><option value="">At the beginning of this part</option>{group.map(lesson => <option key={lesson.id} value={lesson.id}>After: {lesson.title}</option>)}</select></label>}</section>
      <footer className="cm-editor-footer"><p>This saves the lesson in your course copy. It does not mark it complete.</p><div><button type="button" className="cm-secondary" onClick={() => { setEditor(null); setDraft(null); }}>Discard draft</button><button type="submit" className="cm-primary">{isNew ? 'Add this lesson' : 'Save lesson changes'} →</button></div></footer>
    </form>}
    <section className="cm-lesson-section" aria-label="Lessons in selected part"><div className="cm-list-heading"><div><span className="cm-eyebrow">PART {pad(selectedPart?.id)}</span><h2>{selectedPart?.title || 'Your lessons'}</h2></div><span>{group.length} lessons</span></div><p className="cm-order-hint">Move lessons within this part using the arrow buttons. Lesson IDs and saved progress stay attached to their lessons.</p><ol className="cm-lessons">{group.map((lesson,index) => <li key={lesson.id}><span className="cm-lesson-number">{pad(index+1)}</span><div className="cm-lesson-copy"><div><small>LESSON {pad(lesson.id)}</small>{(lesson.isCustom || Number(lesson.id)>=1001) && <span className="cm-tag is-added">Added</span>}{(lesson.customized || changes.patches?.[lesson.id]) && <span className="cm-tag">Edited</span>}</div><h3>{lesson.title}</h3><p>{lesson.question || lesson.definition}</p></div><div className="cm-lesson-actions"><div>{onNavigate && <button type="button" disabled={Boolean(editor)} onClick={() => onNavigate(Number(lesson.id))}>Open ↗</button>}<button type="button" disabled={Boolean(editor) || importing} onClick={() => begin(lesson)}>Edit</button></div><div className="cm-move-controls"><button type="button" disabled={Boolean(editor) || index === 0 || importing} onClick={() => move(index,'up')} aria-label={`Move ${lesson.title} up`}>↑</button><button type="button" disabled={Boolean(editor) || index === group.length-1 || importing} onClick={() => move(index,'down')} aria-label={`Move ${lesson.title} down`}>↓</button></div></div></li>)}</ol>{!group.length && <div className="cm-empty"><span>+</span><h3>Room for a new idea.</h3><p>Add the first lesson in this part to start shaping its learning path.</p></div>}</section>
    <p className="cm-storage-note">Export a copy when you want to take your changes with you. Course edits and learner completion are separate.</p>
  </div>;
}
