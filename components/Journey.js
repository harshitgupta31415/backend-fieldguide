'use client';

import { useLanguage, useCourse } from './LanguageProvider';

import { useState } from 'react';
import { lessons, reference, activities, earnedXP } from '../lib/course.mjs';
import '../app/journey.css';

const pad = value => String(value).padStart(2, '0');
const groupLessons = id => lessons.filter(lesson => Number(lesson.module_id) === Number(id));
const stageLabels = [
 ['Understand the system','The foundations','Requests, data, trust, and the catalog.'],
 ['Make the store work','The moving parts','Payments, orders, background work, and speed.'],
 ['Build with confidence','The complete picture','Test, operate, guide AI, and connect it all.'],
 ['Start & connect locally','Practical setup','Projects, configuration, Next.js, and database access.'],
 ['Run the connected app','Service walkthroughs','Accounts, storage, and simulated deployments.'],
 ['Connect the purchase','Integration practice','Architecture, delivery, and verified payments.'],
 ['Operate & recover','The practical capstone','Notifications, security, incidents, and the complete store.'],
];
const stages = Array.from({length: Math.ceil(reference.modules.length / 4)}, (_, index) => {
 const parts = reference.modules.slice(index*4, index*4+4);
 const [title,label,description] = stageLabels[index] || [parts[0].title,'More to explore','Connect the next set of responsibilities.'];
 return {title,label,description,ids:parts.map(m => m.id)};
});

function Glyph({ name, size = 22 }) {
  const paths = {
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    spark: <><path d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6Z" /><path d="m20 3 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" /></>,
    cart: <><path d="M3 4h2l3 12h10l3-9H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
    server: <><rect x="4" y="3" width="16" height="7" rx="2" /><rect x="4" y="14" width="16" height="7" rx="2" /><path d="M8 6.5h.01M8 17.5h.01M12 6.5h5M12 17.5h5" /></>,
    data: <><ellipse cx="12" cy="5" rx="8" ry="3" /><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0" /></>,
    return: <><path d="M5 8h9a6 6 0 0 1 0 12h-3M10 3 5 8l5 5" /></>,
    game: <><path d="M7 7h10c3 0 4 5 4 9 0 3-3 4-5 1H8c-2 3-5 2-5-1 0-4 1-9 4-9Z" /><path d="M6 11v5m-2.5-2.5h5M15 12h.01M18 15h.01" /></>,
    flask: <><path d="M9 3h6M10 3v7L4 19a1.3 1.3 0 0 0 1.2 2h13.6A1.3 1.3 0 0 0 20 19l-6-9V3M7 15h10" /><path d="M10 18h.01M14 17h.01" /></>,
    code: <><path d="m8 7-5 5 5 5m8-10 5 5-5 5m-2-13-4 16" /></>,
    flag: <><path d="M5 22V3m0 0c5-3 9 3 15 0v10c-6 3-10-3-15 0" /></>,
    star: <path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1 6.2-5.6-2.9-5.6 2.9 1-6.2-4.5-4.4 6.3-.9Z" />,
    book: <><path d="M12 6v15M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2Z" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.spark}</svg>;
}

function ProgressRing({ value, size = 58, children }) {
  return <span className="journey-ring" style={{ width: size, height: size }}>
    <svg viewBox="0 0 64 64" aria-hidden="true"><circle className="journey-ring-track" cx="32" cy="32" r="27" /><circle className="journey-ring-fill" cx="32" cy="32" r="27" pathLength="100" strokeDasharray={`${value} 100`} /></svg>
    <span>{children}</span>
  </span>;
}

const requestSteps = [
  { label: 'The customer asks', tag: 'BROWSER', icon: 'cart', code: 'POST /cart/items', detail: 'A click sends the variant and quantity. The request is an instruction to check, not proof that the cart changed.' },
  { label: 'The server checks', tag: 'BUSINESS RULES', icon: 'server', code: 'owner + quantity ✓', detail: 'The server identifies the customer, checks cart ownership, and validates the requested item and quantity.' },
  { label: 'The data changes', tag: 'DATABASE', icon: 'data', code: 'save cart item', detail: 'A successful database write makes the cart change durable. Adding to a cart does not automatically reserve stock.' },
  { label: 'The result returns', tag: 'RESPONSE', icon: 'return', code: 'updated cart → UI', detail: 'The server returns the saved result. The screen can now show what actually happened, or explain a failure.' },
];

function RequestPlayground() {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  return <div className="journey-system">
    <div className="journey-system-heading"><span><i />{t(" A SMALL SYSTEM. A BIG IDEA.")}</span><span className="journey-live-label">{t("Interactive")}</span></div>
    <div className="journey-system-board">
      <svg className="journey-wires" viewBox="0 0 400 230" preserveAspectRatio="none" aria-hidden="true"><path d="M100 58H300V173H100V58" /><path className={`journey-wire-trace trace-${step}`} d="M100 58H300V173H100V58" /></svg>
      {requestSteps.map((item, index) => <button key={item.tag} className={`journey-node journey-node-${index} ${step === index ? 'is-active' : ''}`} aria-pressed={step === index} onClick={() => setStep(index)}>
        <span className="journey-node-icon"><Glyph name={item.icon} /></span><span><small>{t(pad(index + 1))} · {t(item.tag)}</small><strong>{t(item.label)}</strong><code>{item.code}</code></span>
      </button>)}
      <span className="journey-system-center" aria-hidden="true"><Glyph name="spark" size={17}/></span>
    </div>
    <div className="journey-system-detail" key={step} aria-live="polite"><span>{t(pad(step + 1))}</span><p>{t(requestSteps[step].detail)}</p></div>
    <button className="journey-trace-button" onClick={() => setStep((step + 1) % requestSteps.length)}>{t("Follow the request ")}<span>{t(step + 1)} / 4</span><Glyph name="arrow" size={16}/></button>
  </div>;
}

function PartCard({ part, completed, expanded, setExpanded, go, current }) {
  const { t } = useLanguage();
  const { lessons, reference, activities, earnedXP, moduleLessons: groupLessons } = useCourse();
  const group = groupLessons(part.id);
  const count = group.filter(lesson => completed.includes(Number(lesson.id))).length;
  const next = group.find(lesson => !completed.includes(Number(lesson.id))) || group[0];
  return <article className={`journey-part ${current ? 'is-current' : ''} ${count === group.length ? 'is-complete' : ''}`} style={{ '--journey-part-color': part.color }}>
    <div className="journey-part-meta"><span>{t("PART ")}{t(pad(part.id))}</span><span>{t(count === group.length ? '✓ Complete' : current ? 'Your next chapter' : count ? `${count} of ${group.length} complete` : 'Ready to explore')}</span></div>
    <div className="journey-part-title"><span className="journey-part-art"><Glyph name={['server','data','flag','cart','star','cart','return','spark','flask','flag','code','book'][(part.id - 1)]} size={25}/></span><h3><button onClick={() => go('part', part.id)}>{t(part.title)}<span aria-hidden="true">↗</span></button></h3></div>
    <p>{t(part.outcome)}</p>
    <div className="journey-lesson-dots" aria-label={t(`${count} of ${group.length} lessons complete`)}>{group.map(lesson => <button className={completed.includes(Number(lesson.id)) ? 'is-done' : ''} key={lesson.id} onClick={() => go('lesson', Number(lesson.id))} aria-label={t(`Lesson ${Number(lesson.id)}: ${lesson.title}${completed.includes(Number(lesson.id)) ? ', complete' : ''}`)}>{completed.includes(Number(lesson.id)) ? <Glyph name="check" size={12}/> : pad(lesson.id)}</button>)}</div>
    <div className="journey-part-actions"><button onClick={() => go('lesson', Number(next.id))}>{t(count === group.length ? 'Revisit this part' : count ? 'Keep going' : 'Begin this part')}<Glyph name="arrow" size={16}/></button><button aria-expanded={expanded} aria-controls={`journey-part-${part.id}`} onClick={() => setExpanded(expanded ? null : part.id)}>{t(group.length)}{t(" lessons ")}<span aria-hidden="true">{t(expanded ? '−' : '+')}</span></button></div>
    {expanded && <div className="journey-part-lessons" id={`journey-part-${part.id}`}>{group.map(lesson => <button key={lesson.id} onClick={() => go('lesson', Number(lesson.id))}><span>{t(completed.includes(Number(lesson.id)) ? '✓' : pad(lesson.id))}</span>{t(lesson.title)}<span aria-hidden="true">→</span></button>)}</div>}
  </article>;
}

function AchievementShelf({ completed, games }) {
  const { t } = useLanguage();
  const { lessons, reference, activities, earnedXP, moduleLessons: groupLessons } = useCourse();
  const badges = [
    { name: 'First step', goal: 'Finish one lesson', earned: completed.length >= 1, icon: 'flag' },
    { name: 'Chapter closer', goal: 'Finish every lesson in any part', earned: reference.modules.some(part => groupLessons(part.id).every(lesson => completed.includes(Number(lesson.id)))), icon: 'book' },
    { name: 'System thinker', goal: 'Finish 20 lessons', earned: completed.length >= 20, icon: 'server' },
    { name: 'Game changer', goal: 'Solve all three arcade games', earned: games.length >= 3, icon: 'game' },
    { name: 'Full picture', goal: `Finish all ${lessons.length} lessons`, earned: completed.length === lessons.length, icon: 'star' },
  ];
  return <section className="journey-achievements" aria-labelledby="journey-achievement-title"><div><span className="journey-eyebrow">{t("SMALL WINS, REAL UNDERSTANDING")}</span><h2 id="journey-achievement-title">{t("A little further, every time.")}</h2><p>{t("Your milestones are saved on this browser. Export your progress to take them with you.")}</p></div><div className="journey-badges">{badges.map(badge => <div className={`journey-badge ${badge.earned ? 'is-earned' : ''}`} key={badge.name} title={t(badge.goal)}><span><Glyph name={badge.icon} size={24}/>{badge.earned && <i>✓</i>}</span><strong>{t(badge.name)}</strong><small>{t(badge.earned ? 'Earned' : badge.goal)}</small></div>)}</div></section>;
}

export default function JourneyHome({ go, data, resume }) {
  const { t } = useLanguage();
  const { lessons, reference, activities, earnedXP, moduleLessons: groupLessons } = useCourse();
  const completed = data.completed || [];
  const games = [...new Set((data.achievements || []).filter(id => ['pipeline', 'trust', 'detective'].includes(id)))];
  const current = lessons.find(lesson => Number(lesson.id) === Number(resume)) || lessons[0];
  const [stage, setStage] = useState(Math.floor((Number(current.module_id) - 1) / 4));
  const [expanded, setExpanded] = useState(null);
  const percent = Math.round(completed.length / lessons.length * 100);
  const xp = earnedXP(data);
  const finished = completed.length === lessons.length;
  const activeStage = stages[stage];
  function selectStage(index) { setStage(index); setExpanded(null); }
  return <div className="page journey-page">
    <div className="journey-welcome"><span className="journey-eyebrow"><span className="journey-small-star">✳</span>{t(" YOUR BACKEND ADVENTURE")}</span><span className="journey-xp"><Glyph name="spark" size={15}/><b>{t(xp.toLocaleString())}{t(" XP")}</b><span>{t(completed.length ? 'Keep your curiosity going' : 'A fresh start')}</span></span></div>
    <section className="journey-hero"><div className="journey-hero-copy"><h1>{t("Go beyond")}<br/>{t("the ")}<span>{t("storefront.")}</span></h1><p>{t("Understand the system behind every click. Learn the concepts, play with the rules, and guide AI with confidence.")}</p><button className="journey-primary" onClick={() => go('lesson', Number(current.id))}>{t(finished ? 'Revisit the course' : completed.length ? 'Continue your journey' : 'Let’s start learning')}<Glyph name="arrow" size={19}/></button><div className="journey-hero-facts"><span><strong>{t(lessons.length)}</strong>{t(" focused lessons")}</span><i/><span><strong>3</strong>{t(" learning games")}</span><i/><span>{t("At your own pace")}</span></div></div><RequestPlayground/></section>
    <section className="journey-next" aria-label={t(finished ? 'Course complete' : 'Your next lesson')}><ProgressRing value={percent} size={70}><strong>{t(percent)}<small>%</small></strong></ProgressRing><div className="journey-next-copy"><span>{t(finished ? 'YOU CONNECTED THE WHOLE SYSTEM' : completed.length ? 'PICK UP WHERE YOU LEFT OFF' : 'YOUR FIRST MISSION')}</span><h2>{t(finished ? `All ${lessons.length} lessons, one complete picture.` : current.title)}</h2><p>{t(finished ? 'Practice in the arcade, revisit a concept, or put your next idea into a precise prompt.' : current.question)}</p></div><div className="journey-next-action"><span>{t(finished ? `${(lessons.length * 20).toLocaleString()} lesson XP earned` : `Lesson ${pad(current.id)} · Part ${pad(current.module_id)} · +20 XP`)}</span><button onClick={() => go(finished ? 'arcade' : 'lesson', finished ? undefined : Number(current.id))}>{t(finished ? 'Play the arcade' : completed.length ? 'Continue lesson' : `Start lesson ${pad(current.id)}`)}<Glyph name="arrow" size={17}/></button></div></section>
    <section className="journey-map" aria-labelledby="journey-map-title"><div className="journey-section-heading"><div><span className="journey-eyebrow">{t("THE BIG PICTURE")}</span><h2 id="journey-map-title">{t("Your path to “I get it.”")}</h2><p>{t(reference.modules.length)}{t(" connected parts. From concepts to practical integration.")}</p></div><span className="journey-map-count"><b>{t(completed.length)}</b> / {t(lessons.length)}{t(" complete")}</span></div>
      <div className="journey-stage-tabs" role="group" aria-label={t("Learning stages")}>{stages.map((item, index) => <button className={stage === index ? 'is-active' : ''} key={item.title} onClick={() => selectStage(index)} aria-pressed={stage === index}><span>{t(pad(index + 1))}</span><div><small>{t(item.label)}</small><strong>{t(item.title)}</strong></div><span className="journey-stage-count">{t(completed.filter(id => item.ids.includes(Number(lessons.find(lesson => Number(lesson.id) === id)?.module_id))).length)}/{t(lessons.filter(lesson => item.ids.includes(Number(lesson.module_id))).length)}</span></button>)}</div>
      <div className="journey-trail" aria-label={t("Navigate all course parts")}>{reference.modules.map(part => { const group = groupLessons(part.id); const count = group.filter(lesson => completed.includes(Number(lesson.id))).length; return <button key={part.id} className={`${activeStage.ids.includes(part.id) ? 'in-stage' : ''} ${count === group.length ? 'is-done' : ''} ${Number(current.module_id) === part.id ? 'is-current' : ''}`} onClick={() => { setStage(Math.floor((part.id - 1) / 4)); setExpanded(part.id); }} aria-label={t(`Show part ${part.id}, ${part.title}, ${count} of ${group.length} lessons complete`)} title={t(part.title)}>{count === group.length ? <Glyph name="check" size={16}/> : pad(part.id)}</button>; })}</div>
      <div className="journey-stage-heading"><h3>{t(activeStage.description)}</h3><span>{t("Every part is open to explore")}</span></div>
      <div className="journey-part-grid" key={stage}>{reference.modules.filter(part => activeStage.ids.includes(part.id)).map(part => <PartCard key={part.id} part={part} completed={completed} expanded={expanded === part.id} setExpanded={setExpanded} go={go} current={!finished && Number(current.module_id) === part.id}/>)}</div>
    </section>
    <section className="journey-play" aria-labelledby="journey-play-title"><div className="journey-section-heading"><div><span className="journey-eyebrow">{t("LEARN IT. THEN PLAY WITH IT.")}</span><h2 id="journey-play-title">{t("Make the ideas stick.")}</h2></div><span className="journey-soft-note">{t("Try, get feedback, try again.")}</span></div><div className="journey-practice-grid"><button className="journey-practice journey-arcade" onClick={() => go('arcade')}><div className="journey-practice-top"><span className="journey-practice-icon"><Glyph name="game" size={30}/></span><span>{t("3 GAMES · +100 XP EACH")}</span></div><h3>{t("Your brain.")}<br/>{t("Meet the backend arcade.")}</h3><p>{t("Build a request pipeline, sort the trust boundaries, and investigate a broken checkout.")}</p><span className="journey-practice-link">{t("Enter the arcade ")}<Glyph name="arrow" size={18}/></span><span className="journey-arcade-orbit" aria-hidden="true">✳</span></button><button className="journey-practice journey-labs" onClick={() => go('labs', 'inventory')}><div className="journey-practice-top"><span className="journey-practice-icon"><Glyph name="flask" size={27}/></span><span>{t("3 INTERACTIVE LABS")}</span></div><h3>{t("What happens")}<br/>{t("if you try this?")}</h3><p>{t("Race for the last item. Replay a payment event. Change an untrusted request.")}</p><span className="journey-practice-link">{t("Open the sandbox ")}<Glyph name="arrow" size={18}/></span></button><button className="journey-practice journey-prompts" onClick={() => go('prompts')}><div className="journey-practice-top"><span className="journey-practice-icon"><Glyph name="code" size={27}/></span><span>{t("THE PROMPT WORKSHOP")}</span></div><h3>{t("Turn a clear idea")}<br/>{t("into a better prompt.")}</h3><p>{t("Give AI the context, rules, failure cases, and evidence that good work needs.")}</p><span className="journey-practice-link">{t("Build your prompt ")}<Glyph name="arrow" size={18}/></span></button></div></section>
    <div className="journey-practical-banner"><div><span className="journey-eyebrow">{t("THE FIELDSTORE PRACTICE STUDIO")}</span><h2>{t("Connect it. Break it. Repair it.")}</h2><p>{t(activities.length)}{t(" guided missions for configuration, permissions, shipping, and recovery. Synthetic data. No accounts required.")}</p></div><button className="journey-primary" onClick={() => go('practice')}>{t("Enter the practice studio ")}<Glyph name="arrow"/></button></div><AchievementShelf completed={completed} games={games}/>
    <div className="journey-bottom"><span><Glyph name="book" size={20}/><strong>{t("New to all of this?")}</strong>{t(" Start with the vocabulary and a little prework.")}</span><button onClick={() => go('resources')}>{t("Open the reference desk ")}<Glyph name="arrow" size={16}/></button></div>
  </div>;
}

export function PartJourney({ id, go, completed }) {
  const { t } = useLanguage();
  const { lessons, reference, activities, earnedXP, moduleLessons: groupLessons } = useCourse();
  const part = reference.modules.find(item => item.id === Number(id));
  if (!part) return null;
  const group = groupLessons(id);
  const count = group.filter(lesson => completed.includes(Number(lesson.id))).length;
  const next = group.find(lesson => !completed.includes(Number(lesson.id))) || group[0];
  return <div className="page journey-part-page"><button className="journey-back" onClick={() => go('home')}>{t("← Back to your learning path")}</button><section className="journey-chapter-hero"><div><span className="journey-eyebrow">{t("CHAPTER ")}{t(pad(id))}{t(" OF ")}{t(reference.modules.length)}</span><h1>{t(part.title)}</h1><p>{t(part.outcome)}</p><button className="journey-primary" onClick={() => go('lesson', Number(next.id))}>{t(count === group.length ? 'Revisit the first lesson' : count ? 'Continue this chapter' : 'Begin this chapter')}<Glyph name="arrow" size={18}/></button></div><div className="journey-chapter-progress"><ProgressRing value={count / group.length * 100} size={125}><strong>{t(count)}<small>/{t(group.length)}</small></strong></ProgressRing><span>{t(count === group.length ? 'Chapter complete' : 'Lessons completed')}</span><small>{t(count * 20)} / {t(group.length * 20)}{t(" lesson XP")}</small></div></section><div className="journey-chapter-layout"><section aria-label={t("Lessons in this chapter")} className="journey-chapter-lessons">{group.map((lesson, index) => { const done = completed.includes(Number(lesson.id)); return <button key={lesson.id} className={`${done ? 'is-done' : ''} ${next.id === lesson.id && count !== group.length ? 'is-next' : ''}`} onClick={() => go('lesson', Number(lesson.id))}><span className="journey-chapter-stop">{done ? <Glyph name="check"/> : pad(index + 1)}</span><div><small>{t("LESSON ")}{t(pad(lesson.id))} <span>· {t(done ? 'COMPLETE' : '+20 XP')}</span></small><h2>{t(lesson.title)}</h2><p>{t(lesson.question)}</p></div><Glyph name="arrow" size={20}/></button>; })}</section><aside className="journey-chapter-aside"><span className="journey-practice-icon"><Glyph name="spark" size={26}/></span><span className="journey-eyebrow">{t("YOUR LEARNING LOOP")}</span><h2>{t("Understand.")}<br/>{t("Predict.")}<br/>{t("Try it yourself.")}</h2><ol><li>{t("Explore the idea and click through the diagram.")}</li><li>{t("Predict the result before revealing the answer.")}</li><li>{t("Make the prompt specific to your own project.")}</li></ol><p>{t("For teachers: ask learners to explain the rule in their own words before moving on.")}</p>{activities.find(activity => activity.moduleId === Number(id)) ? <button onClick={() => go('practice', activities.find(activity => activity.moduleId === Number(id)).id)}>{t("Try this part’s mission ")}<Glyph name="arrow" size={16}/></button> : <button onClick={() => go('arcade')}>{t("Take a game break ")}<Glyph name="arrow" size={16}/></button>}</aside></div>{reference.modules.findIndex(m => m.id === Number(id)) < reference.modules.length - 1 && <div className="journey-chapter-next"><div><span className="journey-eyebrow">{t("NEXT ON YOUR PATH")}</span><h2>{t(reference.modules[Number(id)].title)}</h2></div><button className="journey-primary" onClick={() => go('part', Number(id) + 1)}>{t("Explore part ")}{t(pad(Number(id) + 1))}<Glyph name="arrow" size={18}/></button></div>}</div>;
}
