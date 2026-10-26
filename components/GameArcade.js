'use client';

import { useEffect, useRef, useState } from 'react';
import { detectiveCases, gameCatalog, pipelineRounds, trustCards, trustLayers } from '../lib/game-data';
import '../app/arcade.css';

function GameButton({ children, secondary = false, className = '', ...props }) {
  return <button type="button" className={`ga-button ${secondary ? 'ga-button-secondary' : ''} ${className}`} {...props}>{children}</button>;
}

function useStepFocus(step) {
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  return heading;
}

function Progress({ current, total, label }) {
  return <div className="ga-round-progress"><div><span>{label}</span><strong>{current} / {total}</strong></div><div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={current}><span style={{ width: `${current / total * 100}%` }}/></div></div>;
}

function Feedback({ success, title, children }) {
  return <div className={`ga-feedback ${success ? 'ga-feedback-success' : ''}`} role="status"><span className="ga-feedback-mark" aria-hidden="true">{success ? '✓' : '↳'}</span><div><strong>{title}</strong><p>{children}</p></div></div>;
}

function Celebration({ id, onReplay, onBack, go, alreadyCompleted }) {
  const info = gameCatalog.find(game => game.id === id);
  const heading = useStepFocus(id);
  return <section className="ga-finish" aria-labelledby={`ga-finish-${id}`}><div className="ga-medal" aria-hidden="true"><span>✦</span></div><span className="ga-kicker">RULES UNDERSTOOD. CASE CLOSED.</span><h2 ref={heading} tabIndex={-1} id={`ga-finish-${id}`}>{info.name} complete.</h2><p>You followed the evidence and protected the important rule. Take that reasoning into the next feature you build.</p><div className="ga-earned"><span aria-hidden="true">✓</span>{alreadyCompleted ? 'Completed medal kept · replay freely' : 'Course medal earned · one award per game'}</div><div className="ga-actions"><GameButton onClick={onBack}>Choose another game <span aria-hidden="true">↗</span></GameButton><GameButton secondary onClick={onReplay}>Replay for practice</GameButton>{go && <GameButton secondary onClick={() => go('lesson', info.lesson)}>Connect to lesson {String(info.lesson).padStart(2, '0')}</GameButton>}</div><small>Replays are for learning. They do not award extra completion credit.</small></section>;
}

function PipelineGame({ onWin, onBack, go, alreadyCompleted }) {
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
  return <div className="ga-play"><Progress current={roundIndex + (solved ? 1 : 0)} total={pipelineRounds.length} label="Routes connected"/><div className="ga-challenge-heading"><span className="ga-kicker">ROUTE {roundIndex + 1} · {round.label}</span><h2 ref={heading} tabIndex={-1}>{round.title}</h2><p>{round.story}</p></div><div className="ga-instruction"><span aria-hidden="true">↕</span><p>Move the steps into order. Use the up/down buttons with a mouse, touch, or keyboard. No dragging needed.</p></div><p className="ga-sr-only" aria-live="polite">{announcement}</p><ol className={`ga-pipeline ${solved ? 'is-solved' : ''}`} aria-label="Reorder this request pipeline">{order.map((id, index) => { const step = round.steps.find(item => item.id === id); return <li key={id}><span className="ga-position">{String(index + 1).padStart(2, '0')}</span><div className="ga-pipeline-text"><span>{step.layer}</span><strong>{step.title}</strong>{solved && <p>{step.why}</p>}</div><div className="ga-movers"><button type="button" ref={element => { moveRefs.current[`${id}-up`] = element; }} aria-label={`Move ${step.title} up`} disabled={index === 0 || solved} onClick={() => move(index, -1)}>↑</button><button type="button" ref={element => { moveRefs.current[`${id}-down`] = element; }} aria-label={`Move ${step.title} down`} disabled={index === order.length - 1 || solved} onClick={() => move(index, 1)}>↓</button></div></li>; })}</ol>{feedback && <Feedback success={feedback.success} title={feedback.title}>{feedback.message}</Feedback>}<div className="ga-actions">{solved ? <GameButton onClick={advance}>{roundIndex === pipelineRounds.length - 1 ? 'Complete the relay' : 'Next route'} <span aria-hidden="true">→</span></GameButton> : <GameButton onClick={check}>Check my route <span aria-hidden="true">✓</span></GameButton>}<GameButton secondary onClick={() => { setOrder(round.start); setSolved(false); setFeedback(null); setAnnouncement('This route returned to its starting order.'); }}>Reset this route</GameButton></div><p className="ga-small-note">Several architectures are possible. This challenge orders the specific route described above.</p></div>;
}

function TrustGame({ onWin, onBack, go, alreadyCompleted }) {
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
  return <div className="ga-play"><Progress current={index + (solved ? 1 : 0)} total={trustCards.length} label="Boundaries placed"/><div className="ga-challenge-heading"><span className="ga-kicker">RESPONSIBILITY CARD {String(index + 1).padStart(2, '0')}</span><h2 ref={heading} tabIndex={-1}>Who owns this job?</h2><p>Choose the layer responsible for the exact operation on this card. Other layers may participate in the wider flow.</p></div><div className={`ga-trust-card ${solved ? 'is-solved' : ''}`}><span className="ga-card-corner" aria-hidden="true">◇</span><span className="ga-kicker">PLACE THIS RESPONSIBILITY</span><h3>{card.title}</h3><p>{card.detail}</p><span className="ga-card-number">{String(index + 1).padStart(2, '0')} / 08</span></div><div className="ga-boundaries" aria-label="Choose the responsible layer">{trustLayers.map(item => { const selected = item.id === choice; return <button type="button" key={item.id} className={`ga-boundary ga-boundary-${item.color} ${selected ? 'is-selected' : ''} ${solved && selected ? 'is-correct' : ''}`} aria-pressed={selected} disabled={solved} onClick={() => choose(item.id)}><span className="ga-layer-icon" aria-hidden="true">{item.icon}</span><strong>{item.name}</strong><small>{item.hint}</small>{solved && selected && <span className="ga-boundary-check" aria-hidden="true">✓</span>}</button>; })}</div>{choice !== null && <Feedback success={solved} title={solved ? `Placed with the ${layer.name.toLowerCase()}.` : `Trace the boundary: this belongs to the ${layer.name.toLowerCase()}.`}>{card.why}{!solved && ' Select that layer to continue.'}</Feedback>}<div className="ga-actions"><GameButton disabled={!solved} onClick={advance}>{index === trustCards.length - 1 ? 'Complete the collection' : 'Next responsibility'} <span aria-hidden="true">→</span></GameButton></div><p className="ga-small-note">The request can cross many layers. Trust comes from checking which layer is authoritative for each specific fact or action.</p></div>;
}

function DetectiveGame({ onWin, onBack, go, alreadyCompleted }) {
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
  return <div className="ga-play"><Progress current={index + (solved ? 1 : 0)} total={detectiveCases.length} label="Cases resolved"/><div className="ga-case-file"><div className="ga-case-stamp"><span>{incident.number}</span><span>{solved ? 'RESOLVED ✓' : 'OPEN FOR INVESTIGATION'}</span></div><div className="ga-challenge-heading"><h2 ref={heading} tabIndex={-1}>{incident.title}</h2><p className="ga-case-subtitle">{incident.subtitle}</p></div><p className="ga-case-report">{incident.report}</p><div className="ga-evidence-heading"><span className="ga-kicker">EXAMINE THE EVIDENCE</span><span>{opened.length} of {incident.clues.length} open</span></div><div className="ga-evidence">{incident.clues.map((clue, clueIndex) => { const visible = opened.includes(clueIndex); return <div className={`ga-clue ${visible ? 'is-open' : ''}`} key={`${incident.id}-${clueIndex}`}><button type="button" aria-expanded={visible} aria-controls={`ga-clue-${incident.id}-${clueIndex}`} onClick={() => setOpened(previous => previous.includes(clueIndex) ? previous.filter(item => item !== clueIndex) : [...previous, clueIndex])}><span aria-hidden="true">{String(clueIndex + 1).padStart(2, '0')}</span><strong>{clue.title}</strong><b aria-hidden="true">{visible ? '−' : '+'}</b></button><div id={`ga-clue-${incident.id}-${clueIndex}`} hidden={!visible}><p>{clue.body}</p></div></div>; })}</div></div><fieldset className="ga-deductions"><legend>Which response protects the broken rule?</legend><p>Inspect the case, then choose a repair. You can revise an incorrect deduction.</p>{incident.choices.map((option, optionIndex) => <button type="button" key={`${incident.id}-${optionIndex}`} disabled={solved} className={`ga-deduction ${choice === optionIndex ? 'is-selected' : ''} ${choice === optionIndex && solved ? 'is-correct' : ''}`} aria-pressed={choice === optionIndex} onClick={() => choose(optionIndex)}><span>{String.fromCharCode(65 + optionIndex)}</span><strong>{option.text}</strong>{choice === optionIndex && solved && <b aria-hidden="true">✓</b>}</button>)}</fieldset>{choice !== null && <Feedback success={solved} title={solved ? 'That repair addresses the cause.' : 'That changes the symptom, not the rule.'}>{incident.choices[choice].why}</Feedback>}{solved && <div className="ga-case-resolution"><span className="ga-kicker">DETECTIVE’S NOTE</span><p>{incident.resolution}</p>{go && <button type="button" onClick={() => go('lesson', incident.lesson)}>Read lesson {String(incident.lesson).padStart(2, '0')} <span aria-hidden="true">↗</span></button>}</div>}<div className="ga-actions"><GameButton disabled={!solved} onClick={advance}>{index === detectiveCases.length - 1 ? 'Close the casebook' : 'Open the next case'} <span aria-hidden="true">→</span></GameButton></div></div>;
}

export function GamePreview({ go }) {
  return <div className="ga-preview"><div className="ga-preview-icon" aria-hidden="true">✦</div><div><span className="ga-kicker">LEARN BY PLAYING</span><h2>Your next skill is one good decision away.</h2><p>Connect a request, protect a boundary, or solve an incident. Three games. Real backend reasoning.</p></div><GameButton onClick={() => go?.('arcade')}>Enter the arcade <span aria-hidden="true">↗</span></GameButton></div>;
}

export default function GameArcade({ onAward, go, completedGames = [] }) {
  const [active, setActive] = useState(null);
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
  return <section className="game-arcade" aria-label="Backend learning arcade"><div className="ga-topline"><span className="ga-kicker"><span className="ga-status-dot" aria-hidden="true"/>THE LEARNING ARCADE</span><span className="ga-no-pressure">No timers. Room to think.</span></div>{active ? <><button type="button" className="ga-back" onClick={() => setActive(null)}>← All games</button><div className="ga-game-label"><span aria-hidden="true">{info.icon}</span><div><strong>{info.name}</strong><small>{info.skill}</small></div><span className="ga-game-format">{info.rounds}</span></div>{active === 'pipeline' && <PipelineGame {...gameProps}/>} {active === 'trust' && <TrustGame {...gameProps}/>} {active === 'detective' && <DetectiveGame {...gameProps}/>}</> : <><header className="ga-hero"><div><h1>Less memorizing.<br/><em>More “I get it.”</em></h1><p>Take the controls. Follow the data, question the assumption, and make the backend behave.</p></div><div className="ga-medal-counter"><span className="ga-counter-symbol" aria-hidden="true">✦</span><strong>{completed.size}<span> / 3</span></strong><small>skill medals collected</small><div className="ga-mini-medals" aria-hidden="true">{gameCatalog.map(item => <span key={item.id} className={completed.has(item.id) ? 'is-earned' : ''}>{completed.has(item.id) ? '✓' : '◇'}</span>)}</div></div></header><div className="ga-game-grid">{gameCatalog.map((game, index) => <article className={`ga-game-card ga-game-card-${game.id}`} key={game.id}><div className="ga-card-top"><span>0{index + 1} / {game.skill}</span><span className={completed.has(game.id) ? 'ga-earned-tag' : 'ga-format-tag'}>{completed.has(game.id) ? '✓ Medal earned' : game.rounds}</span></div><div className="ga-card-illustration" aria-hidden="true">{game.id === 'pipeline' ? <><span className="ga-art-node">01</span><b>→</b><span className="ga-art-node">?</span><b>→</b><span className="ga-art-node">03</span></> : game.id === 'trust' ? <><span className="ga-art-boundary">▤</span><span className="ga-art-boundary">⌘</span><span className="ga-art-card">◇</span></> : <><span className="ga-art-folder">CASE<br/><b>001</b></span><span className="ga-art-search">⌕</span></>}</div><span className="ga-kicker">{game.tag}</span><h2>{game.name}</h2><p>{game.description}</p><GameButton onClick={() => setActive(game.id)}>{completed.has(game.id) ? 'Play again' : 'Let’s play'}<span aria-hidden="true">↗</span></GameButton></article>)}</div><div className="ga-playbook"><span aria-hidden="true">↳</span><div><strong>Predict. Try. Explain why.</strong><p>Finish every round in a game to earn its medal. Incorrect choices are invitations to investigate. You can replay freely; completion credit is awarded once.</p><small>All data is synthetic. Games make no real payment or API calls. Unfinished rounds restart when you leave a game.</small></div></div></>}</section>;
}


