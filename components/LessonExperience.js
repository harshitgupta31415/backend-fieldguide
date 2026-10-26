'use client';

import { useLanguage, useCourse } from './LanguageProvider';

import { useRef, useState } from 'react';
import { lessons, activities, moduleLessons, nextLesson, previousLesson } from '../lib/course.mjs';

const stages = [
  ['01', 'Understand', 'The idea & the reason'],
  ['02', 'Explore', 'See the system work'],
  ['03', 'Solve', 'Make a prediction'],
  ['04', 'Apply', 'Direct AI with precision'],
];

export default function LessonExperience({ lesson: d, module: m, quiz, go, copy, data, setData, complete, Diagram, Icon, nextTitle }) {
  const { t } = useLanguage();
  const { lessons, activities, moduleLessons, nextLesson, previousLesson } = useCourse();
  const id = Number(d.id);
  const [stage, setStage] = useState(0);
  const [visited, setVisited] = useState([0]);
  const [choice, setChoice] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [promptMode, setPromptMode] = useState('implement');
  const [promptEdits, setPromptEdits] = useState({});
  const [celebrate, setCelebrate] = useState(false);
  const panelRef = useRef(null);
  const correct = choice !== null && choice === quiz?.correct;
  const passed = correct || data.quizzes.includes(id);
  const finished = data.completed.includes(id);
  const group = moduleLessons(m.id);
  const moduleCount = group.filter(lesson => data.completed.includes(Number(lesson.id))).length;
  const next = nextLesson(id);
  const previous = previousLesson(id);
  const prompt = promptEdits[promptMode] ?? d.prompts?.[promptMode] ?? d.prompt;
  const checks = data.checks[id] || [];
  const checkCount = d.completionChecks?.length || 0;
  const readyToFinish = passed && checks.length === checkCount;
  const activity = activities.find(item => item.moduleId === m.id);
  const lessonNumber = String(id).padStart(2, '0');

  function changeStage(index) {
    setStage(index);
    setCelebrate(false);
    setVisited(v => v.includes(index) ? v : [...v, index]);
    requestAnimationFrame(() => {
      panelRef.current?.focus({ preventScroll: true });
      panelRef.current?.scrollIntoView({ block: 'start', behavior: data.reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    });
  }
  function answer(index) {
    setChoice(index);
    if (index === quiz.correct) setData(s => ({ ...s, quizzes: s.quizzes.includes(id) ? s.quizzes : [...s.quizzes, id] }));
  }
  function useBuilder() {
    setData(s => ({ ...s, draft: { context: 'Inspect the actual repository, stack and relevant files before proposing a change.', feature: d.title + ': ' + prompt, inputs: '', rules: '', constraints: 'Follow existing project conventions. Flag missing business decisions.', failures: '', evidence: 'Explain verification steps, report checks actually run, observed outcomes and remaining uncertainty.' } }));
    go('prompts');
  }
  function finish() {
    if (!finished && !readyToFinish) return;
    complete(id);
    setCelebrate(!finished);
  }

  return <article className="page lesson-page guided-lesson">
    <div className="lesson-topline"><button className="back-link" onClick={() => go('part', m.id)}>← {t(m.title)}</button><button className="tutor-lesson-link" onClick={() => go('tutor', id)}>{t("Ask the tutor ↗")}</button><span className="lesson-reward">✦ {t(finished ? '20 XP earned' : '20 XP to discover')}</span></div>
    <div className="lesson-heading"><span className="eyebrow">{t("PART ")}{t(String(m.id).padStart(2, '0'))}{t(" · LESSON ")}{t(lessonNumber)} / {t(lessons.length)}</span><span className="pill">{t(finished ? '✓ Lesson complete' : 'One concept. Four small steps.')}</span></div>
    <h1 className="page-title">{t(d.title)}</h1>
    <p className="lesson-question">{t(d.question)}</p>
    <nav className="lesson-steps" aria-label={t("Lesson steps")}>{stages.map(([num, label, detail], i) => <button key={label} aria-current={stage === i ? 'step' : undefined} onClick={() => changeStage(i)} className={`${stage === i ? 'is-current' : ''} ${visited.includes(i) ? 'is-visited' : ''}`}><span className="step-index">{t(i === 2 && passed ? '✓' : num)}</span><span><b>{t(label)}</b><small>{t(detail)}</small></span></button>)}</nav>
    <div className="lesson-stage-progress" aria-hidden="true"><span style={{ width: `${(stage + 1) * 25}%` }}/></div>
    <section ref={panelRef} tabIndex={-1} className="lesson-stage" aria-label={t(stages[stage][1])}>
      <div key={stage} className="stage-enter">
      {stage === 0 && <>
        <div className="stage-caption"><span>{t("THE STARTING POINT")}</span><small>01 / 04</small></div>
        <div className="idea-grid"><section><span className="eyebrow">{t("THE BASIC IDEA")}</span><p>{t(d.definition)}</p></section><section className="why-card"><span className="eyebrow">{t("WHY IT EXISTS")}</span><p>{t(d.why)}</p></section></div>
        <section className="worked-example"><span className="example-mark">↳</span><div><span className="eyebrow">{t("IMAGINE YOUR STORE")}</span><p>{t(d.example)}</p></div></section>
        <details className="assumption-flip"><summary><span>?</span><div><b>{t("Spot the mistaken assumption")}</b><small>{t("Think first, then open the card.")}</small></div><span>+</span></summary><div><p>“{t(d.misconception)}”</p><span>{t("Challenge this claim using the idea and example above. In the next step, trace what the system must actually do.")}</span></div></details>
      </>}
      {stage === 1 && <>
        <div className="stage-caption"><span>{t("MAKE THE INVISIBLE VISIBLE")}</span><small>02 / 04</small></div>
        <h2 className="stage-title">{t("Follow the connections.")}</h2><p className="stage-intro">{t("Select each node to uncover its job. Then explain the sequence in your own words.")}</p>
        <Diagram lesson={d} details={quiz?.nodeDetails}/>
        <section className="how-section"><span className="eyebrow">{t("HOW IT WORKS, STEP BY STEP")}</span><div className="step-grid">{d.steps.map((s, i) => <div key={s}><span>{t(String(i+1).padStart(2, '0'))}</span><p>{t(s)}</p></div>)}</div></section>
        {d.details?.length > 0 && <section className="practical-details"><span className="eyebrow">{t("THE PRACTICAL WALKTHROUGH")}</span>{d.details.map((detail, i) => <details key={detail.title} open={i === 0 ? true : undefined}><summary>{t(detail.title)}<span>+</span></summary><p>{t(detail.body)}</p></details>)}</section>}
        {d.implementation && <section className="implementation-example"><div><span className="eyebrow">{t("SMALL IMPLEMENTATION EXAMPLE")}</span><span>{t(d.implementation.language)}</span></div><pre><code>{d.implementation.code}</code></pre><p>{t(d.implementation.note)}</p></section>}
        {d.debugClues?.length > 0 && <section className="debug-clues"><span className="eyebrow">{t("WHEN THE RESULT IS WRONG")}</span><h3>{t("Follow evidence, not guesses.")}</h3><ul>{d.debugClues.map(clue => <li key={clue}>{t(clue)}</li>)}</ul></section>}
      </>}
      {stage === 2 && <>
        <div className="stage-caption"><span>{t("YOUR TURN TO THINK")}</span><small>03 / 04</small></div>
        <section className="quiz-section"><div className="section-heading compact"><div><span className="eyebrow">{t("PAUSE & PREDICT")}</span><h2>{t("What would happen?")}</h2></div><span className="pill">{t(passed ? '✓ Understanding checked' : 'Try as often as you like')}</span></div><p className="quiz-question">{t(d.exercise)}</p><div className="quiz-choices">{quiz?.choices.map((answerText, i) => <button key={i} className={`${choice === i ? 'chosen' : ''} ${choice === i && correct ? 'correct' : ''} ${choice === i && !correct ? 'incorrect' : ''}`} onClick={() => answer(i)} aria-pressed={choice === i}><span>{t(String.fromCharCode(65+i))}</span>{t(answerText)}{choice === i && correct && <Icon name="check" size={19}/>}</button>)}</div>{choice !== null && <div className={`quiz-feedback ${correct ? 'success' : 'try-again'}`} role="status"><strong>{t(correct ? 'You connected the dots.' : 'A useful wrong turn. Try another angle.')}</strong><p>{t(correct ? quiz.explanation : 'Which answer protects the rule from the example? Revisit Understand or Explore, or open the teaching answer below.')}</p></div>}<button className="text-button answer-toggle" onClick={() => setRevealed(!revealed)} aria-expanded={revealed}>{t(revealed ? 'Hide' : 'Reveal')}{t(" the teaching answer ")}<span>{t(revealed ? '−' : '+')}</span></button>{revealed && <div className="teaching-answer">{t(d.answer)}</div>}</section>
        <p className="challenge-note">{t("There is no timer and no lost progress. Reasoning improves with another attempt.")}</p>
        {activity && <div className="lesson-mission-link"><div><span className="eyebrow">{t("THIS PART’S PRACTICE MISSION")}</span><h3>{t(activity.title)}</h3><p>{t(activity.intro)}</p></div><button className="btn secondary" onClick={() => go('practice',activity.id)}>{t("Open the mission ↗")}</button></div>}
      </>}
      {stage === 3 && <>
        <div className="stage-caption"><span>{t("TURN UNDERSTANDING INTO DIRECTION")}</span><small>04 / 04</small></div>
        <section className="topic-prompt"><div className="prompt-heading"><div><span className="eyebrow">{t("ASK WITH INTENT")}</span><h2>{t("Make the prompt yours.")}</h2></div><button className="btn dark-secondary" onClick={() => copy(prompt)}><Icon name="copy" size={16}/>{t(" Copy prompt")}</button></div><p>{t("Choose the kind of help you need. Add your actual project, business rules and expected results.")}</p><div className="prompt-modes" role="group" aria-label={t("AI prompt purpose")}>{['understand','inspect','plan','implement','debug','verify','review'].map(mode => <button key={mode} aria-pressed={promptMode === mode} onClick={() => setPromptMode(mode)}>{t(mode)}</button>)}</div><textarea aria-label="Edit topic prompt" value={prompt} onChange={e => setPromptEdits(s => ({...s,[promptMode]:e.target.value}))} spellCheck="false"/><div className="prompt-footer"><span>{t("Context → rules → failures → evidence")}</span><button onClick={useBuilder}>{t("Expand in the prompt workshop ↗")}</button></div></section>
        <section className="notes-section"><label className="eyebrow" htmlFor="lesson-notes">{t("ONE TAKEAWAY, IN YOUR OWN WORDS")}</label><textarea id="lesson-notes" value={data.notes[id] || ''} onChange={e => setData(s => ({ ...s, notes: { ...s.notes, [id]: e.target.value } }))} placeholder="The rule is… It can fail when… I would verify it by…" maxLength={10000}/><small>{t("Saved in this browser. Export from the sidebar for a portable copy.")}</small></section>
        {checkCount > 0 && <fieldset className="completion-checklist"><legend>{t("Prove it to yourself")}</legend><p>{t("Mark each check after you can explain or demonstrate it using this lesson. These are learning checks, not proof of a live integration.")}</p>{d.completionChecks.map((check,index) => <label key={check}><input type="checkbox" checked={checks.includes(index)} onChange={() => setData(s => ({...s, checks:{...s.checks,[id]:(s.checks[id] || []).includes(index) ? s.checks[id].filter(n => n !== index) : [...(s.checks[id] || []),index]}}))}/><span>{t(check)}</span></label>)}</fieldset>}
        {d.sources?.length > 0 && <section className="lesson-sources"><span className="eyebrow">{t("CHECK THE OFFICIAL DOCUMENTATION")}</span>{d.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer noopener">{t(source.title)}<span>↗</span></a>)}<small>{t("Examples are illustrative. Check installed versions and current provider documentation before optional implementation in a separate test project.")}</small></section>}
        {!celebrate && <div className="lesson-completion"><div><strong>{t(finished ? 'You have this one in your toolkit.' : readyToFinish ? 'Ready to add this to your toolkit?' : 'Finish your learning checks.')}</strong><p>{t(passed || finished ? 'Explain the rule and tick the practical checks above.' : 'Solve the prediction in step 03, then complete the practical checklist.')}</p></div>{passed || finished ? <button disabled={!finished && !readyToFinish} className={`btn ${finished ? 'secondary' : ''}`} onClick={finish}><Icon name="check" size={18}/>{t(finished ? 'Mark incomplete' : 'Complete lesson · +20 XP')}</button> : <button className="btn" onClick={() => changeStage(2)}>{t("Try the challenge →")}</button>}</div>}
        {celebrate && <div className="lesson-celebration" role="status"><div className="celebration-sparkles" aria-hidden="true">{Array.from({length:12}, (_, i) => <i key={i} style={{'--i':i}}/>)}</div><span className="celebration-medal">✦</span><span className="eyebrow">{t("+20 XP · LESSON COMPLETE")}</span><h2>{t(data.completed.length === lessons.length ? 'Look how far you have come.' : moduleCount === group.length ? 'Another part of the system, understood.' : 'One more piece clicks into place.')}</h2><p>{t(data.completed.length === lessons.length ? `You have completed all ${lessons.length} lessons. Revisit your notes, test your reasoning in the practice studio, and put your prompts to work.` : `${data.completed.length} of ${lessons.length} concepts in your toolkit. Every small step counts.`)}</p><div className="celebration-actions"><button className="btn" onClick={() => next ? go('lesson',Number(next.id)) : go('home')}>{t(next ? `Next: ${next.title}` : 'See your completed journey')}<Icon name="arrow" size={18}/></button><button className="text-button" onClick={() => go(activity ? 'practice' : 'arcade',activity?.id)}>{t(activity ? 'Apply it in the practice studio ↗' : 'Take a game break ↗')}</button></div></div>}
      </>}
      </div>
    </section>
    {!celebrate && <div className="stage-navigation"><button className="text-button" disabled={stage === 0} onClick={() => changeStage(stage-1)}>{t("← Back a step")}</button><span>{t(stage+1)}{t(" of 4")}</span>{stage < 3 ? <button className="btn" onClick={() => changeStage(stage+1)}>{t(['Explore the concept', 'Try the challenge', 'Put it into practice'][stage])}<Icon name="arrow" size={17}/></button> : <button className="text-button" onClick={() => go('part', m.id)}>{t("Back to this part ↗")}</button>}</div>}
    <div className="lesson-pagination"><button className="text-button" disabled={!previous} onClick={() => go('lesson',Number(previous.id))}>{t("← Previous lesson")}</button><button className="text-button" onClick={() => next ? go('lesson',Number(next.id)) : go('home')}>{t(next ? 'Browse next lesson →' : 'Back to learning path →')}</button></div>
  </article>;
}
