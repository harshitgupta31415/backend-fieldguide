'use client';

import { useLanguage, useCourse } from './LanguageProvider';

import { useEffect, useRef, useState } from 'react';
import { detectiveCases, gameCatalog, pipelineRounds, trustCards, trustLayers } from '../lib/game-data';
import '../app/arcade.css';

function GameButton({ children, secondary = false, className = '', ...props }) {
  const { t } = useLanguage();
  const { detectiveCases, gameCatalog, pipelineRounds, trustCards, trustLayers } = useCourse();
  return <button type="button" className={`ga-button ${secondary ? 'ga-button-secondary' : ''} ${className}`} {...props}>{t(children)}</button>;
}

function useStepFocus(step) {
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  return heading;
}

function Progress({ current, total, label }) {
  const { t } = useLanguage();
  const { detectiveCases, gameCatalog, pipelineRounds, trustCards, trustLayers } = useCourse();
  return <div className="ga-round-progress"><div><span>{t(label)}</span><strong>{t(current)} / {t(total)}</strong></div><div role="progressbar" aria-label={t(label)} aria-valuemin={0} aria-valuemax={total} aria-valuenow={current}><span style={{ width: `${current / total * 100}%` }}/></div></div>;
}

function Feedback({ success, title, children }) {
  const { t } = useLanguage();
  const { detectiveCases, gameCatalog, pipelineRounds, trustCards, trustLayers } = useCourse();
  return <div className={`ga-feedback ${success ? 'ga-feedback-success' : ''}`} role="status"><span className="ga-feedback-mark" aria-hidden="true">{t(success ? '✓' : '↳')}</span><div><strong>{t(title)}</strong><p>{t(children)}</p></div></div>;
}

function Celebration({ id, onReplay, onBack, go, alreadyCompleted }) {
  const { t } = useLanguage();
  const { detectiveCases, gameCatalog, pipelineRounds, trustCards, trustLayers } = useCourse();
  const info = gameCatalog.find(game => game.id === id);
  const heading = useStepFocus(id);
  return <section className="ga-finish" aria-labelledby={`ga-finish-${id}`}><div className="ga-medal" aria-hidden="true"><span>✦</span></div><span className="ga-kicker">{t("RULES UNDERSTOOD. CASE CLOSED.")}</span><h2 ref={heading} tabIndex={-1} id={`ga-finish-${id}`}>{t(info.name)}{t(" complete.")}</h2><p>{t("You followed the evidence and protected the important rule. Take that reasoning into the next feature you build.")}</p><div className="ga-earned"><span aria-hidden="true">✓</span>{t(alreadyCompleted ? 'Completed medal kept · replay freely' : 'Course medal earned · one award per game')}</div><div className="ga-actions"><GameButton onClick={onBack}>{t("Choose another game ")}<span aria-hidden="true">↗</span></GameButton><GameButton secondary onClick={onReplay}>{t("Replay for practice")}</GameButton>{go && <GameButton secondary onClick={() => go('lesson', info.lesson)}>{t("Connect to lesson ")}{t(String(info.lesson).padStart(2, '0'))}</GameButton>}</div><small>{t("Replays are for learning. They do not award extra completion credit.")}</small></section>;
}

function PipelineGame({ onWin, onBack, go, alreadyCompleted }) {
  const { t } = useLanguage();
  const { detectiveCases, gameCatalog, pipelineRounds, trustCards, trustLayers } = useCourse();
  const [roundIndex, setRoundIndex] = useState(0);
  const [order, setOrder] = useState(pipelineRounds[0].start);
  const [feedback, setFeedback] = useState(null);
  const [solved, setSolved] = useState(false);
  const [finished, setFinished] = useState(false);
  const [completedAtStart, setCompletedAtStart] = useState(alreadyCompleted);
  const [announcement, setAnnouncement] = useState('');
  const round = pipelineRounds[roundIndex];
  const heading = useStepFocus(roundIndex);
  const moveRefs = useRef({});

  function move(index, offset) {
    const nextIndex = index + offset;
    if (solved || nextIndex < 0 || nextIndex >= order.length) return;
    const next = [...order];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    setOrder(next); setFeedback(null);
    const item = round.steps.find(step => step.id === next[nextIndex]);
    setAnnouncement(`${item.title} moved to position ${nextIndex + 1} of ${next.length}.`);
    // Keep keyboard focus on the same operation when its old direction becomes disabled.
    const direction = nextIndex === 0 ? 'down' : nextIndex === next.length - 1 ? 'up' : offset < 0 ? 'up' : 'down';
    requestAnimationFrame(() => moveRefs.current[`${item.id}-${direction}`]?.focus());
  }

  function check() {
    const mismatch = round.steps.findIndex((step, index) => order[index] !== step.id);
    if (mismatch !== -1) {
      const expected = round.steps[mismatch];
      setFeedback({ success: false, title: `Look again at position ${mismatch + 1}.`, message: `This route needs “${expected.title}” here. ${expected.why}` });
      return;
    }
    setSolved(true);
    setFeedback({ success: true, title: 'The whole route connects.', message: round.takeaway });
  }

  function advance() {
    if (!solved) return;
    if (roundIndex === pipelineRounds.length - 1) { setFinished(true); onWin('pipeline'); return; }
    const nextIndex = roundIndex + 1;
    setRoundIndex(nextIndex); setOrder(pipelineRounds[nextIndex].start); setSolved(false); setFeedback(null); setAnnouncement('Next route loaded.');
  }

  function reset() { setRoundIndex(0); setOrder(pipelineRounds[0].start); setSolved(false); setFinished(false); setCompletedAtStart(true); setFeedback(null); setAnnouncement('Request relay restarted.'); }

  if (finished) return <Celebration id="pipeline" onReplay={reset} onBack={onBack} go={go} alreadyCompleted={completedAtStart}/>;
  return <div className="ga-play"><Progress current={roundIndex + (solved ? 1 : 0)} total={pipelineRounds.length} label={t("Routes connected")}/><div className="ga-challenge-heading"><span className="ga-kicker">{t("ROUTE ")}{t(roundIndex + 1)} · {t(round.label)}</span><h2 ref={heading} tabIndex={-1}>{t(round.title)}</h2><p>{t(round.story)}</p></div><div className="ga-instruction"><span aria-hidden="true">↕</span><p>{t("Move the steps into order. Use the up/down buttons with a mouse, touch, or keyboard. No dragging needed.")}</p></div><p className="ga-sr-only" aria-live="polite">{t(announcement)}</p><ol className={`ga-pipeline ${solved ? 'is-solved' : ''}`} aria-label={t("Reorder this request pipeline")}>{order.map((id, index) => { const step = round.steps.find(item => item.id === id); return <li key={id}><span className="ga-position">{t(String(index + 1).padStart(2, '0'))}</span><div className="ga-pipeline-text"><span>{t(step.layer)}</span><strong>{t(step.title)}</strong>{solved && <p>{t(step.why)}</p>}</div><div className="ga-movers"><button type="button" ref={element => { moveRefs.current[`${id}-up`] = element; }} aria-label={t(`Move ${step.title} up`)} disabled={index === 0 || solved} onClick={() => move(index, -1)}>↑</button><button type="button" ref={element => { moveRefs.current[`${id}-down`] = element; }} aria-label={t(`Move ${step.title} down`)} disabled={index === order.length - 1 || solved} onClick={() => move(index, 1)}>↓</button></div></li>; })}</ol>{feedback && <Feedback success={feedback.success} title={t(feedback.title)}>{t(feedback.message)}</Feedback>}<div className="ga-actions">{solved ? <GameButton onClick={advance}>{t(roundIndex === pipelineRounds.length - 1 ? 'Complete the relay' : 'Next route')} <span aria-hidden="true">→</span></GameButton> : <GameButton onClick={check}>{t("Check my route ")}<span aria-hidden="true">✓</span></GameButton>}<GameButton secondary onClick={() => { setOrder(round.start); setSolved(false); setFeedback(null); setAnnouncement('This route returned to its starting order.'); }}>{t("Reset this route")}</GameButton></div><p className="ga-small-note">{t("Several architectures are possible. This challenge orders the specific route described above.")}</p></div>;
}

function TrustGame({ onWin, onBack, go, alreadyCompleted }) {
  const { t } = useLanguage();
  const { detectiveCases, gameCatalog, pipelineRounds, trustCards, trustLayers } = useCourse();
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState(null);
  const [solved, setSolved] = useState(false);
  const [finished, setFinished] = useState(false);
  const [completedAtStart, setCompletedAtStart] = useState(alreadyCompleted);
  const card = trustCards[index];
  const heading = useStepFocus(index);
  const layer = trustLayers.find(item => item.id === card.correct);
  function choose(id) { if (!solved) { setChoice(id); if (id === card.correct) setSolved(true); } }
  function advance() {
    if (!solved) return;
    if (index === trustCards.length - 1) { setFinished(true); onWin('trust'); return; }
    setIndex(index + 1); setChoice(null); setSolved(false);
  }
  function reset() { setIndex(0); setChoice(null); setSolved(false); setFinished(false); setCompletedAtStart(true); }
  if (finished) return <Celebration id="trust" onReplay={reset} onBack={onBack} go={go} alreadyCompleted={completedAtStart}/>;
  return <div className="ga-play"><Progress current={index + (solved ? 1 : 0)} total={trustCards.length} label={t("Boundaries placed")}/><div className="ga-challenge-heading"><span className="ga-kicker">{t("RESPONSIBILITY CARD ")}{t(String(index + 1).padStart(2, '0'))}</span><h2 ref={heading} tabIndex={-1}>{t("Who owns this job?")}</h2><p>{t("Choose the layer responsible for the exact operation on this card. Other layers may participate in the wider flow.")}</p></div><div className={`ga-trust-card ${solved ? 'is-solved' : ''}`}><span className="ga-card-corner" aria-hidden="true">◇</span><span className="ga-kicker">{t("PLACE THIS RESPONSIBILITY")}</span><h3>{t(card.title)}</h3><p>{t(card.detail)}</p><span className="ga-card-number">{t(String(index + 1).padStart(2, '0'))} / 08</span></div><div className="ga-boundaries" aria-label={t("Choose the responsible layer")}>{trustLayers.map(item => { const selected = item.id === choice; return <button type="button" key={item.id} className={`ga-boundary ga-boundary-${item.color} ${selected ? 'is-selected' : ''} ${solved && selected ? 'is-correct' : ''}`} aria-pressed={selected} disabled={solved} onClick={() => choose(item.id)}><span className="ga-layer-icon" aria-hidden="true">{t(item.icon)}</span><strong>{t(item.name)}</strong><small>{t(item.hint)}</small>{solved && selected && <span className="ga-boundary-check" aria-hidden="true">✓</span>}</button>; })}</div>{choice !== null && <Feedback success={solved} title={t(solved ? `Placed with the ${layer.name.toLowerCase()}.` : `Trace the boundary: this belongs to the ${layer.name.toLowerCase()}.`)}>{t(card.why)}{t(!solved && ' Select that layer to continue.')}</Feedback>}<div className="ga-actions"><GameButton disabled={!solved} onClick={advance}>{t(index === trustCards.length - 1 ? 'Complete the collection' : 'Next responsibility')} <span aria-hidden="true">→</span></GameButton></div><p className="ga-small-note">{t("The request can cross many layers. Trust comes from checking which layer is authoritative for each specific fact or action.")}</p></div>;
}

function DetectiveGame({ onWin, onBack, go, alreadyCompleted }) {
  const { t } = useLanguage();
  const { detectiveCases, gameCatalog, pipelineRounds, trustCards, trustLayers } = useCourse();
  const [index, setIndex] = useState(0);
  const [opened, setOpened] = useState([]);
  const [choice, setChoice] = useState(null);
  const [solved, setSolved] = useState(false);
  const [finished, setFinished] = useState(false);
  const [completedAtStart, setCompletedAtStart] = useState(alreadyCompleted);
  const incident = detectiveCases[index];
  const heading = useStepFocus(index);
  function choose(value) { if (!solved) { setChoice(value); if (incident.choices[value].correct) setSolved(true); } }
  function advance() {
    if (!solved) return;
    if (index === detectiveCases.length - 1) { setFinished(true); onWin('detective'); return; }
    setIndex(index + 1); setOpened([]); setChoice(null); setSolved(false);
  }
  function reset() { setIndex(0); setOpened([]); setChoice(null); setSolved(false); setFinished(false); setCompletedAtStart(true); }
  if (finished) return <Celebration id="detective" onReplay={reset} onBack={onBack} go={go} alreadyCompleted={completedAtStart}/>;
  return <div className="ga-play"><Progress current={index + (solved ? 1 : 0)} total={detectiveCases.length} label={t("Cases resolved")}/><div className="ga-case-file"><div className="ga-case-stamp"><span>{t(incident.number)}</span><span>{t(solved ? 'RESOLVED ✓' : 'OPEN FOR INVESTIGATION')}</span></div><div className="ga-challenge-heading"><h2 ref={heading} tabIndex={-1}>{t(incident.title)}</h2><p className="ga-case-subtitle">{t(incident.subtitle)}</p></div><p className="ga-case-report">{t(incident.report)}</p><div className="ga-evidence-heading"><span className="ga-kicker">{t("EXAMINE THE EVIDENCE")}</span><span>{t(opened.length)}{t(" of ")}{t(incident.clues.length)}{t(" open")}</span></div><div className="ga-evidence">{incident.clues.map((clue, clueIndex) => { const visible = opened.includes(clueIndex); return <div className={`ga-clue ${visible ? 'is-open' : ''}`} key={`${incident.id}-${clueIndex}`}><button type="button" aria-expanded={visible} aria-controls={`ga-clue-${incident.id}-${clueIndex}`} onClick={() => setOpened(previous => previous.includes(clueIndex) ? previous.filter(item => item !== clueIndex) : [...previous, clueIndex])}><span aria-hidden="true">{t(String(clueIndex + 1).padStart(2, '0'))}</span><strong>{t(clue.title)}</strong><b aria-hidden="true">{t(visible ? '−' : '+')}</b></button><div id={`ga-clue-${incident.id}-${clueIndex}`} hidden={!visible}><p>{t(clue.body)}</p></div></div>; })}</div></div><fieldset className="ga-deductions"><legend>{t("Which response protects the broken rule?")}</legend><p>{t("Inspect the case, then choose a repair. You can revise an incorrect deduction.")}</p>{incident.choices.map((option, optionIndex) => <button type="button" key={`${incident.id}-${optionIndex}`} disabled={solved} className={`ga-deduction ${choice === optionIndex ? 'is-selected' : ''} ${choice === optionIndex && solved ? 'is-correct' : ''}`} aria-pressed={choice === optionIndex} onClick={() => choose(optionIndex)}><span>{t(String.fromCharCode(65 + optionIndex))}</span><strong>{t(option.text)}</strong>{choice === optionIndex && solved && <b aria-hidden="true">✓</b>}</button>)}</fieldset>{choice !== null && <Feedback success={solved} title={t(solved ? 'That repair addresses the cause.' : 'That changes the symptom, not the rule.')}>{t(incident.choices[choice].why)}</Feedback>}{solved && <div className="ga-case-resolution"><span className="ga-kicker">{t("DETECTIVE’S NOTE")}</span><p>{t(incident.resolution)}</p>{go && <button type="button" onClick={() => go('lesson', incident.lesson)}>{t("Read lesson ")}{t(String(incident.lesson).padStart(2, '0'))} <span aria-hidden="true">↗</span></button>}</div>}<div className="ga-actions"><GameButton disabled={!solved} onClick={advance}>{t(index === detectiveCases.length - 1 ? 'Close the casebook' : 'Open the next case')} <span aria-hidden="true">→</span></GameButton></div></div>;
}

export function GamePreview({ go }) {
  const { t } = useLanguage();
  const { detectiveCases, gameCatalog, pipelineRounds, trustCards, trustLayers } = useCourse();
  return <div className="ga-preview"><div className="ga-preview-icon" aria-hidden="true">✦</div><div><span className="ga-kicker">{t("LEARN BY PLAYING")}</span><h2>{t("Your next skill is one good decision away.")}</h2><p>{t("Connect a request, protect a boundary, or solve an incident. Three games. Real backend reasoning.")}</p></div><GameButton onClick={() => go?.('arcade')}>{t("Enter the arcade ")}<span aria-hidden="true">↗</span></GameButton></div>;
}

export default function GameArcade({ initialGame, onAward, go, completedGames = [] }) {
  const { t } = useLanguage();
  const { detectiveCases, gameCatalog, pipelineRounds, trustCards, trustLayers } = useCourse();
  const [active, setActive] = useState(['pipeline','trust','detective'].includes(initialGame) ? initialGame : null);
  const [localWins, setLocalWins] = useState([]);
  const awarded = useRef(new Set());
  const completed = new Set([...completedGames, ...localWins]);
  function award(id) {
    if (!awarded.current.has(id) && !completedGames.includes(id)) {
      awarded.current.add(id);
      setLocalWins(previous => previous.includes(id) ? previous : [...previous, id]);
      onAward?.(id);
    }
  }
  const gameProps = { onWin: award, onBack: () => setActive(null), go, alreadyCompleted: completedGames.includes(active) };
  const info = gameCatalog.find(item => item.id === active);
  return <section className="game-arcade" aria-label={t("Backend learning arcade")}><div className="ga-topline"><span className="ga-kicker"><span className="ga-status-dot" aria-hidden="true"/>{t("THE LEARNING ARCADE")}</span><span className="ga-no-pressure">{t("No timers. Room to think.")}</span></div>{active ? <><button type="button" className="ga-back" onClick={() => setActive(null)}>{t("← All games")}</button><div className="ga-game-label"><span aria-hidden="true">{t(info.icon)}</span><div><strong>{t(info.name)}</strong><small>{t(info.skill)}</small></div><span className="ga-game-format">{t(info.rounds)}</span></div>{active === 'pipeline' && <PipelineGame {...gameProps}/>} {active === 'trust' && <TrustGame {...gameProps}/>} {active === 'detective' && <DetectiveGame {...gameProps}/>}</> : <><header className="ga-hero"><div><h1>{t("Less memorizing.")}<br/><em>{t("More “I get it.”")}</em></h1><p>{t("Take the controls. Follow the data, question the assumption, and make the backend behave.")}</p></div><div className="ga-medal-counter"><span className="ga-counter-symbol" aria-hidden="true">✦</span><strong>{t(completed.size)}<span> / 3</span></strong><small>{t("skill medals collected")}</small><div className="ga-mini-medals" aria-hidden="true">{gameCatalog.map(item => <span key={item.id} className={completed.has(item.id) ? 'is-earned' : ''}>{t(completed.has(item.id) ? '✓' : '◇')}</span>)}</div></div></header><div className="ga-game-grid">{gameCatalog.map((game, index) => <article className={`ga-game-card ga-game-card-${game.id}`} key={game.id}><div className="ga-card-top"><span>0{t(index + 1)} / {t(game.skill)}</span><span className={completed.has(game.id) ? 'ga-earned-tag' : 'ga-format-tag'}>{t(completed.has(game.id) ? '✓ Medal earned' : game.rounds)}</span></div><div className="ga-card-illustration" aria-hidden="true">{game.id === 'pipeline' ? <><span className="ga-art-node">01</span><b>→</b><span className="ga-art-node">?</span><b>→</b><span className="ga-art-node">03</span></> : game.id === 'trust' ? <><span className="ga-art-boundary">▤</span><span className="ga-art-boundary">⌘</span><span className="ga-art-card">◇</span></> : <><span className="ga-art-folder">{t("CASE")}<br/><b>001</b></span><span className="ga-art-search">⌕</span></>}</div><span className="ga-kicker">{t(game.tag)}</span><h2>{t(game.name)}</h2><p>{t(game.description)}</p><GameButton onClick={() => setActive(game.id)}>{t(completed.has(game.id) ? 'Play again' : 'Let’s play')}<span aria-hidden="true">↗</span></GameButton></article>)}</div><div className="ga-playbook"><span aria-hidden="true">↳</span><div><strong>{t("Predict. Try. Explain why.")}</strong><p>{t("Finish every round in a game to earn its medal. Incorrect choices are invitations to investigate. You can replay freely; completion credit is awarded once.")}</p><small>{t("All data is synthetic. Games make no real payment or API calls. Unfinished rounds restart when you leave a game.")}</small></div></div></>}</section>;
}


