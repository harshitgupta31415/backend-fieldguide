'use client';

import { useLanguage, useCourse } from './LanguageProvider';
import { useEffect, useRef, useState } from 'react';
import { activities, moduleLessons, reference } from '../lib/course.mjs';
import PracticeExperiment from './PracticeExperiments';
import '../app/practice.css';

const experiments = ['environment','shipment','payment','notification','fulfillment','permissions'];

function CapstoneStockMap() {
  const { t } = useLanguage();
  const { activities, moduleLessons, reference } = useCourse();
  const [phase,setPhase]=useState('initialStock');
  const model=reference.capstoneModel;
  if(!model)return null;
  const states=[['initialStock','Before purchase'],['afterReservation','After reservation'],['afterCapture','After capture'],['afterPhysicalShipment','After shipment'],['afterSellableReturnInspection','After inspection & restock']];
  return <section className="studio-board"><span className="eyebrow">{t("ONE STORE · SEPARATE STATE DIMENSIONS")}</span><h2>{t("Track the same shirt through the system.")}</h2><p>{t(model.variant)} · {t(model.currency)} {t((model.unitMinor/100).toFixed(2))}. {t(model.quoteAssumptions)}</p><div className="studio-filters" role="group" aria-label={t("Explore capstone stock states")}>{states.map(([key,label])=><button key={key} aria-pressed={phase===key} onClick={()=>setPhase(key)}>{t(label)}</button>)}</div><div className="studio-stats" aria-live="polite">{Object.entries(model[phase]).map(([key,value])=><div key={key}><small>{t({onHand:'Fulfillment on-hand',reserved:'Reserved',available:'Available'}[key])}</small><strong>{t(value)}</strong></div>)}</div><p className="studio-simulation-note">{t("Returned physical goods enter a separate quarantine pool. This board shows fulfillment stock; only a sellable inspection and guarded restock transfer the returned unit back.")}</p><div className="studio-responsibilities">{model.rules.map(rule=><div key={rule}><p>{t(rule)}</p></div>)}</div></section>;
}

function PlacementBoard({activity,onComplete}) {
  const { t } = useLanguage();
  const { activities, moduleLessons, reference } = useCourse();
  const [placements,setPlacements] = useState({});
  const [checked,setChecked] = useState(false);
  const items=activity.sortItems || [];
  const correct=items.filter((item,index)=>placements[index]===item.correct).length;
  const solved=checked && correct===items.length;
  return <section className="studio-board"><div className="section-heading"><div><span className="eyebrow">{t(activity.kind==='architecture'?'ARCHITECTURE BOARD':'SORT THE RESPONSIBILITIES')}</span><h2>{t("Give each piece the right home.")}</h2></div><span className="pill">{t(checked?`${correct}/${items.length} correct`:`${items.length} pieces`)}</span></div><p>{t("Select a destination for every card, then check the board. Each placement has a reason.")}</p><div className="studio-placement-grid">{items.map((item,index)=><div className={`studio-placement ${checked?(placements[index]===item.correct?'is-correct':'needs-work'):''}`} key={item.id || index}><label><strong>{t(item.label)}</strong><select disabled={solved} value={placements[index] || ''} onChange={e=>{setPlacements({...placements,[index]:e.target.value});setChecked(false);}}><option value="">{t("Choose a destination…")}</option>{activity.categories.map(category=><option value={category.id} key={category.id}>{t(category.label)}</option>)}</select></label>{checked && <p>{t(placements[index]===item.correct?'✓':'↳')} {t(item.why)}</p>}</div>)}</div><button className="btn" disabled={solved} onClick={()=>{setChecked(true);if(correct===items.length)onComplete();}}>{t(solved?'✓ Board complete':'Check my placements')}</button></section>;
}

function OrderingBoard({activity,onComplete}) {
  const { t } = useLanguage();
  const { activities, moduleLessons, reference } = useCourse();
  const [order,setOrder] = useState(activity.orderStart || activity.orderItems.map(item=>item.id).reverse());
  const [feedback,setFeedback] = useState('');
  const [solved,setSolved] = useState(false);
  function move(index,offset) { const next=[...order];[next[index],next[index+offset]]=[next[index+offset],next[index]];setOrder(next);setFeedback(''); }
  return <section className="studio-board"><span className="eyebrow">{t("ASSEMBLE THE REQUEST")}</span><h2>{t("Connect the button to a saved change.")}</h2><p>{t("Use the arrow controls to put this specific request flow in order. Then inspect the security boundary in the case below.")}</p><ol className="studio-order">{order.map((id,index)=>{const item=activity.orderItems.find(d=>d.id===id);return <li key={id}><span>{t(String(index+1).padStart(2,'0'))}</span><div><strong>{t(item.label)}</strong>{solved&&<p>{t(item.why)}</p>}</div><button aria-label={t(`Move ${item.label} up`)} disabled={solved||index===0} onClick={()=>move(index,-1)}>↑</button><button aria-label={t(`Move ${item.label} down`)} disabled={solved||index===order.length-1} onClick={()=>move(index,1)}>↓</button></li>;})}</ol><button className="btn" disabled={solved} onClick={()=>{const index=activity.orderItems.findIndex((item,i)=>item.id!==order[i]);if(index<0){setSolved(true);setFeedback('The request is connected. Every backend entry point must enforce the relevant rules.');onComplete();}else setFeedback(`Look at position ${index+1}: ${activity.orderItems[index].why}`);}}>{t(solved?'✓ Request assembled':'Check this flow')}</button>{feedback&&<p role="status" className="studio-feedback">{t(feedback)}</p>}</section>;
}

function Mission({activity,completed,onAward,go}) {
  const { t } = useLanguage();
  const { activities, moduleLessons, reference } = useCourse();
  const [index,setIndex]=useState(0);
  const [choice,setChoice]=useState(null);
  const [sortDone,setSortDone]=useState(!activity.sortItems?.length);
  const [orderDone,setOrderDone]=useState(!activity.orderItems?.length);
  const [experimentDone,setExperimentDone]=useState(!experiments.includes(activity.simulator || activity.kind));
  const [finished,setFinished]=useState(false);
  const [completedAtStart]=useState(completed);
  const heading=useRef(null);
  const scenario=activity.scenarios[index];
  const solved=choice===scenario.correct;
  const allBoards=sortDone && orderDone && experimentDone;
  const first=moduleLessons(activity.moduleId)[0];
  useEffect(()=>{ if(index>0){ heading.current?.focus({preventScroll:true}); heading.current?.scrollIntoView({block:'start',behavior:document.querySelector('.motion-quiet')||window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}); } },[index]);
  function advance() {
    if(!solved)return;
    if(index<activity.scenarios.length-1){setIndex(index+1);setChoice(null);return;}
    if(!allBoards)return;
    setFinished(true);onAward(activity.id);
  }
  if(finished)return <div className="studio-finish" role="status"><span className="celebration-medal">✦</span><span className="eyebrow">{t(completedAtStart?'MISSION REVISITED':'MISSION COMPLETE · +50 XP')}</span><h1>{t(activity.title)}</h1><p>{t(activity.completion)}</p><p className="studio-simulation-note">{t("You verified a learning simulation. Live integrations require separate provider-specific setup, authorization and tests.")}</p><div className="studio-controls"><button className="btn" onClick={()=>go('practice')}>{t("Choose another mission →")}</button><button className="btn secondary" onClick={()=>go('part',activity.moduleId)}>{t("Return to this part")}</button></div></div>;
  return <div className="studio-mission"><button className="back-link" onClick={()=>go('practice')}>{t("← All practical missions")}</button><div className="studio-mission-head"><div><span className="eyebrow">{t("PART ")}{t(activity.moduleId)}{t(" · FIELDSTORE PRACTICAL")}</span><h1 className="page-title">{t(activity.title)}</h1><p className="page-intro">{t(activity.intro)}</p></div><span className="lesson-reward">{t(completed?'✓ 50 XP earned':'+50 XP on completion')}</span></div><div className="studio-simulation-note">{t("Synthetic data only. This page makes no service, payment, shipping, or deployment requests.")}</div>
    {activity.kind==='capstone' && <CapstoneStockMap/>}
    {activity.sortItems?.length>0 && <PlacementBoard activity={activity} onComplete={()=>setSortDone(true)}/>}
    {activity.orderItems?.length>0 && <OrderingBoard activity={activity} onComplete={()=>setOrderDone(true)}/>}
    {experiments.includes(activity.simulator || activity.kind) && <PracticeExperiment kind={activity.simulator || activity.kind} onComplete={()=>setExperimentDone(true)}/>}
    <section className="studio-case"><div className="studio-case-top"><span className="eyebrow">{t(activity.kind==='capstone'?'THE CONNECTED PURCHASE JOURNEY':'PREDICT · INVESTIGATE · REPAIR')}</span><span>{t(index+1)} / {t(activity.scenarios.length)}</span></div><div className="studio-case-progress" aria-label={t("Mission cases completed")} role="progressbar" aria-valuemin={0} aria-valuemax={activity.scenarios.length} aria-valuenow={index+(solved?1:0)}><span style={{width:`${(index+(solved?1:0))/activity.scenarios.length*100}%`}}/></div>
      <div className="studio-case-steps" aria-label={t("Mission stages")}>{activity.scenarios.map((item,i)=><span key={item.title} className={i===index?'is-current':i<index?'is-done':''} title={t(item.title)}>{t(i<index?'✓':String(i+1).padStart(2,'0'))}</span>)}</div>
      <div className="stage-enter" key={index}><h2 ref={heading} tabIndex={-1}>{t(scenario.title)}</h2>{scenario.actor && <dl className="studio-responsibilities">{[['actor','Who acts'],['data','Data'],['rule','Permission & rule'],['service','Service'],['failure','Failure'],['verify','Verification']].filter(([key])=>scenario[key]).map(([key,label])=><div key={key}><dt>{t(label)}</dt><dd>{t(scenario[key])}</dd></div>)}</dl>}
      <div className="studio-evidence"><span className="eyebrow">{t("OPEN THE EVIDENCE")}</span>{scenario.evidence.map((evidence,i)=><details key={i}><summary>{t("Evidence ")}{t(String(i+1).padStart(2,'0'))}<span>+</span></summary><p>{t(evidence)}</p></details>)}</div>
      <h3>{t(scenario.question)}</h3><div className="studio-choices">{scenario.choices.map((item,i)=><button key={i} disabled={solved} aria-pressed={choice===i} className={choice===i?(solved?'is-correct':'needs-work'):''} onClick={()=>setChoice(i)}><span>{t(String.fromCharCode(65+i))}</span><strong>{t(typeof item==='string'?item:item.text)}</strong>{choice===i&&solved&&<b>✓</b>}</button>)}</div>
      {choice!==null && <div className={`studio-feedback ${solved?'is-correct':''}`} role="status"><strong>{t(solved?'That protects the rule.':'Follow the evidence and try again.')}</strong><p>{t(scenario.choices[choice].why || scenario.explanation)}</p></div>}
      <div className="studio-case-actions"><button className="btn" disabled={!solved||(index===activity.scenarios.length-1&&!allBoards)} onClick={advance}>{t(index<activity.scenarios.length-1?'Next case →':'Complete this mission · +50 XP')}</button><span>{t(!allBoards&&index===activity.scenarios.length-1?'Finish the board or experiment above to collect this mission.':'No timer. Correct answers unlock the next step.')}</span></div></div>
    </section><div className="studio-related"><span>{t("Need a concept refresher?")}</span><button className="text-button" onClick={()=>go('lesson',Number(first.id))}>{t("Open ")}{t(first.title)} ↗</button></div>
  </div>;
}

export default function PracticeStudio({name,go,data,onAward}) {
  const { t } = useLanguage();
  const { activities, moduleLessons, reference } = useCourse();
  const [filter,setFilter]=useState('all');
  const selected=activities.find(activity=>activity.id===name);
  if(selected)return <div className="page studio-page"><Mission key={selected.id} activity={selected} completed={data.practice.includes(selected.id)} onAward={onAward} go={go}/></div>;
  const visible=activities.filter(activity=>filter==='all'||(filter==='completed'?data.practice.includes(activity.id):!data.practice.includes(activity.id)));
  return <div className="page studio-page"><div className="studio-home-heading"><div><span className="eyebrow">{t("THE FIELDSTORE PRACTICE STUDIO")}</span><h1 className="page-title">{t("Connect the pieces.")}<br/><em>{t("Understand the failures.")}</em></h1><p className="page-intro">{t("Go from concepts to practical decisions. Repair configuration, enforce permissions, recover shipping and payment attempts, then trace the whole store.")}</p></div><div className="studio-score"><span>✦</span><strong>{t(data.practice.length)}/{t(activities.length)}</strong><small>{t("practical missions completed")}</small></div></div><div className="studio-simulation-note">{t("Every mission runs locally using synthetic fixtures. No cloud resources, credentials, paid accounts, or live integrations are required.")}</div><div className="studio-filters" role="group" aria-label={t("Filter practical missions")}>{[['all','All missions'],['next','To explore'],['completed','Completed']].map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{t(label)}</button>)}</div><div className="studio-mission-grid">{visible.map(activity=><article className="studio-card" key={activity.id}><div><span className="eyebrow">{t("PART ")}{t(String(activity.moduleId).padStart(2,'0'))}</span><span>{t(data.practice.includes(activity.id)?'✓ Complete':'+50 XP')}</span></div><h2>{t(activity.title)}</h2><p>{t(activity.intro)}</p><small>{t(reference.modules.find(m=>m.id===activity.moduleId)?.title)} · {t(activity.scenarios.length)}{t(" cases")}</small><button className="btn" onClick={()=>go('practice',activity.id)}>{t(data.practice.includes(activity.id)?'Revisit mission':'Start mission')} →</button></article>)}</div>{!visible.length&&<div className="empty-state"><h2>{t(filter==='completed'?'Your first mission is waiting.':'This shelf is complete.')}</h2><p>{t("Choose another filter to explore the course.")}</p></div>}</div>;
}
