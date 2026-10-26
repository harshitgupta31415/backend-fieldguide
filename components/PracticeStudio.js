'use client';
import { useEffect, useRef, useState } from 'react';
import { activities, moduleLessons, reference } from '../lib/course.mjs';
import PracticeExperiment from './PracticeExperiments';
import '../app/practice.css';

const experiments = ['environment','shipment','payment','notification','fulfillment','permissions'];

function CapstoneStockMap() {
  const [phase,setPhase]=useState('initialStock');
  const model=reference.capstoneModel;
  if(!model)return null;
  const states=[['initialStock','Before purchase'],['afterReservation','After reservation'],['afterCapture','After capture'],['afterPhysicalShipment','After shipment'],['afterSellableReturnInspection','After inspection & restock']];
  return <section className="studio-board"><span className="eyebrow">ONE STORE · SEPARATE STATE DIMENSIONS</span><h2>Track the same shirt through the system.</h2><p>{model.variant} · {model.currency} {(model.unitMinor/100).toFixed(2)}. {model.quoteAssumptions}</p><div className="studio-filters" role="group" aria-label="Explore capstone stock states">{states.map(([key,label])=><button key={key} aria-pressed={phase===key} onClick={()=>setPhase(key)}>{label}</button>)}</div><div className="studio-stats" aria-live="polite">{Object.entries(model[phase]).map(([key,value])=><div key={key}><small>{{onHand:'Fulfillment on-hand',reserved:'Reserved',available:'Available'}[key]}</small><strong>{value}</strong></div>)}</div><p className="studio-simulation-note">Returned physical goods enter a separate quarantine pool. This board shows fulfillment stock; only a sellable inspection and guarded restock transfer the returned unit back.</p><div className="studio-responsibilities">{model.rules.map(rule=><div key={rule}><p>{rule}</p></div>)}</div></section>;
}

function PlacementBoard({activity,onComplete}) {
  const [placements,setPlacements] = useState({});
  const [checked,setChecked] = useState(false);
  const items=activity.sortItems || [];
  const correct=items.filter(item=>placements[item.label]===item.correct).length;
  const solved=checked && correct===items.length;
  return <section className="studio-board"><div className="section-heading"><div><span className="eyebrow">{activity.kind==='architecture'?'ARCHITECTURE BOARD':'SORT THE RESPONSIBILITIES'}</span><h2>Give each piece the right home.</h2></div><span className="pill">{checked?`${correct}/${items.length} correct`:`${items.length} pieces`}</span></div><p>Select a destination for every card, then check the board. Each placement has a reason.</p><div className="studio-placement-grid">{items.map(item=><div className={`studio-placement ${checked?(placements[item.label]===item.correct?'is-correct':'needs-work'):''}`} key={item.label}><label><strong>{item.label}</strong><select disabled={solved} value={placements[item.label] || ''} onChange={e=>{setPlacements({...placements,[item.label]:e.target.value});setChecked(false);}}><option value="">Choose a destination…</option>{activity.categories.map(category=><option value={category.id} key={category.id}>{category.label}</option>)}</select></label>{checked && <p>{placements[item.label]===item.correct?'✓':'↳'} {item.why}</p>}</div>)}</div><button className="btn" disabled={solved} onClick={()=>{setChecked(true);if(correct===items.length)onComplete();}}>{solved?'✓ Board complete':'Check my placements'}</button></section>;
}

function OrderingBoard({activity,onComplete}) {
  const [order,setOrder] = useState(activity.orderStart || activity.orderItems.map(item=>item.id).reverse());
  const [feedback,setFeedback] = useState('');
  const [solved,setSolved] = useState(false);
  function move(index,offset) { const next=[...order];[next[index],next[index+offset]]=[next[index+offset],next[index]];setOrder(next);setFeedback(''); }
  return <section className="studio-board"><span className="eyebrow">ASSEMBLE THE REQUEST</span><h2>Connect the button to a saved change.</h2><p>Use the arrow controls to put this specific request flow in order. Then inspect the security boundary in the case below.</p><ol className="studio-order">{order.map((id,index)=>{const item=activity.orderItems.find(d=>d.id===id);return <li key={id}><span>{String(index+1).padStart(2,'0')}</span><div><strong>{item.label}</strong>{solved&&<p>{item.why}</p>}</div><button aria-label={`Move ${item.label} up`} disabled={solved||index===0} onClick={()=>move(index,-1)}>↑</button><button aria-label={`Move ${item.label} down`} disabled={solved||index===order.length-1} onClick={()=>move(index,1)}>↓</button></li>;})}</ol><button className="btn" disabled={solved} onClick={()=>{const index=activity.orderItems.findIndex((item,i)=>item.id!==order[i]);if(index<0){setSolved(true);setFeedback('The request is connected. Every backend entry point must enforce the relevant rules.');onComplete();}else setFeedback(`Look at position ${index+1}: ${activity.orderItems[index].why}`);}}>{solved?'✓ Request assembled':'Check this flow'}</button>{feedback&&<p role="status" className="studio-feedback">{feedback}</p>}</section>;
}

function Mission({activity,completed,onAward,go}) {
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
  useEffect(()=>{ if(index>0)heading.current?.focus({preventScroll:true}); },[index]);
  function advance() {
    if(!solved)return;
    if(index<activity.scenarios.length-1){setIndex(index+1);setChoice(null);return;}
    if(!allBoards)return;
    setFinished(true);onAward(activity.id);
  }
  if(finished)return <div className="studio-finish" role="status"><span className="celebration-medal">✦</span><span className="eyebrow">{completedAtStart?'MISSION REVISITED':'MISSION COMPLETE · +50 XP'}</span><h1>{activity.title}</h1><p>{activity.completion}</p><p className="studio-simulation-note">You verified a learning simulation. Live integrations require separate provider-specific setup, authorization and tests.</p><div className="studio-controls"><button className="btn" onClick={()=>go('practice')}>Choose another mission →</button><button className="btn secondary" onClick={()=>go('part',activity.moduleId)}>Return to this part</button></div></div>;
  return <div className="studio-mission"><button className="back-link" onClick={()=>go('practice')}>← All practical missions</button><div className="studio-mission-head"><div><span className="eyebrow">PART {activity.moduleId} · FIELDSTORE PRACTICAL</span><h1 className="page-title">{activity.title}</h1><p className="page-intro">{activity.intro}</p></div><span className="lesson-reward">{completed?'✓ 50 XP earned':'+50 XP on completion'}</span></div><div className="studio-simulation-note">Synthetic data only. This page makes no service, payment, shipping, or deployment requests.</div>
    {activity.kind==='capstone' && <CapstoneStockMap/>}
    {activity.sortItems?.length>0 && <PlacementBoard activity={activity} onComplete={()=>setSortDone(true)}/>}
    {activity.orderItems?.length>0 && <OrderingBoard activity={activity} onComplete={()=>setOrderDone(true)}/>}
    {experiments.includes(activity.simulator || activity.kind) && <PracticeExperiment kind={activity.simulator || activity.kind} onComplete={()=>setExperimentDone(true)}/>}
    <section className="studio-case"><div className="studio-case-top"><span className="eyebrow">{activity.kind==='capstone'?'THE CONNECTED PURCHASE JOURNEY':'PREDICT · INVESTIGATE · REPAIR'}</span><span>{index+1} / {activity.scenarios.length}</span></div><div className="studio-case-progress" aria-label="Mission cases completed" role="progressbar" aria-valuemin={0} aria-valuemax={activity.scenarios.length} aria-valuenow={index+(solved?1:0)}><span style={{width:`${(index+(solved?1:0))/activity.scenarios.length*100}%`}}/></div>
      <div className="studio-case-steps" aria-label="Mission stages">{activity.scenarios.map((item,i)=><span key={item.title} className={i===index?'is-current':i<index?'is-done':''} title={item.title}>{i<index?'✓':String(i+1).padStart(2,'0')}</span>)}</div>
      <div className="stage-enter" key={index}><h2 ref={heading} tabIndex={-1}>{scenario.title}</h2>{scenario.actor && <dl className="studio-responsibilities">{[['actor','Who acts'],['data','Data'],['rule','Permission & rule'],['service','Service'],['failure','Failure'],['verify','Verification']].filter(([key])=>scenario[key]).map(([key,label])=><div key={key}><dt>{label}</dt><dd>{scenario[key]}</dd></div>)}</dl>}
      <div className="studio-evidence"><span className="eyebrow">OPEN THE EVIDENCE</span>{scenario.evidence.map((evidence,i)=><details key={i}><summary>Evidence {String(i+1).padStart(2,'0')}<span>+</span></summary><p>{evidence}</p></details>)}</div>
      <h3>{scenario.question}</h3><div className="studio-choices">{scenario.choices.map((item,i)=><button key={i} disabled={solved} aria-pressed={choice===i} className={choice===i?(solved?'is-correct':'needs-work'):''} onClick={()=>setChoice(i)}><span>{String.fromCharCode(65+i)}</span><strong>{typeof item==='string'?item:item.text}</strong>{choice===i&&solved&&<b>✓</b>}</button>)}</div>
      {choice!==null && <div className={`studio-feedback ${solved?'is-correct':''}`} role="status"><strong>{solved?'That protects the rule.':'Follow the evidence and try again.'}</strong><p>{scenario.choices[choice].why || scenario.explanation}</p></div>}
      <div className="studio-case-actions"><button className="btn" disabled={!solved||(index===activity.scenarios.length-1&&!allBoards)} onClick={advance}>{index<activity.scenarios.length-1?'Next case →':'Complete this mission · +50 XP'}</button><span>{!allBoards&&index===activity.scenarios.length-1?'Finish the board or experiment above to collect this mission.':'No timer. Correct answers unlock the next step.'}</span></div></div>
    </section><div className="studio-related"><span>Need a concept refresher?</span><button className="text-button" onClick={()=>go('lesson',Number(first.id))}>Open {first.title} ↗</button></div>
  </div>;
}

export default function PracticeStudio({name,go,data,onAward}) {
  const [filter,setFilter]=useState('all');
  const selected=activities.find(activity=>activity.id===name);
  if(selected)return <div className="page studio-page"><Mission key={selected.id} activity={selected} completed={data.practice.includes(selected.id)} onAward={onAward} go={go}/></div>;
  const visible=activities.filter(activity=>filter==='all'||(filter==='completed'?data.practice.includes(activity.id):!data.practice.includes(activity.id)));
  return <div className="page studio-page"><div className="studio-home-heading"><div><span className="eyebrow">THE FIELDSTORE PRACTICE STUDIO</span><h1 className="page-title">Connect the pieces.<br/><em>Understand the failures.</em></h1><p className="page-intro">Go from concepts to practical decisions. Repair configuration, enforce permissions, recover shipping and payment attempts, then trace the whole store.</p></div><div className="studio-score"><span>✦</span><strong>{data.practice.length}/{activities.length}</strong><small>practical missions completed</small></div></div><div className="studio-simulation-note">Every mission runs locally using synthetic fixtures. No cloud resources, credentials, paid accounts, or live integrations are required.</div><div className="studio-filters" role="group" aria-label="Filter practical missions">{[['all','All missions'],['next','To explore'],['completed','Completed']].map(([value,label])=><button key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div><div className="studio-mission-grid">{visible.map(activity=><article className="studio-card" key={activity.id}><div><span className="eyebrow">PART {String(activity.moduleId).padStart(2,'0')}</span><span>{data.practice.includes(activity.id)?'✓ Complete':'+50 XP'}</span></div><h2>{activity.title}</h2><p>{activity.intro}</p><small>{reference.modules.find(m=>m.id===activity.moduleId)?.title} · {activity.scenarios.length} cases</small><button className="btn" onClick={()=>go('practice',activity.id)}>{data.practice.includes(activity.id)?'Revisit mission':'Start mission'} →</button></article>)}</div>{!visible.length&&<div className="empty-state"><h2>{filter==='completed'?'Your first mission is waiting.':'This shelf is complete.'}</h2><p>Choose another filter to explore the course.</p></div>}</div>;
}
