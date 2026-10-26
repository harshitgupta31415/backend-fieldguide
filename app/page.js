'use client';

import { useEffect, useRef, useState } from 'react';
import { lessons, reference, activities, activityIdSet, moduleLessons, lessonById as byId } from '../lib/course.mjs';
import interactions from '../lib/interactions.json';
import JourneyHome, { PartJourney } from '../components/Journey';
import GameArcade from '../components/GameArcade';
import LessonExperience from '../components/LessonExperience';
import PracticeStudio from '../components/PracticeStudio';

import { STORAGE_KEY as KEY, emptyProgress as empty, cleanProgress } from '../lib/progress.mjs';
const pad = n => String(n).padStart(2, '0');
const draftFields = [
  ['context', 'Project context', 'Stack, versions, relevant files, current behavior'],
  ['feature', 'Feature and actor', 'Who does what? What should change?'],
  ['inputs', 'Inputs and outputs', 'Accepted fields, returned data and saved records'],
  ['rules', 'Rules that must always hold', 'Ownership, money, stock and duplicate protection'],
  ['constraints', 'Scope and constraints', 'Existing conventions, compatibility, approved integrations'],
  ['failures', 'Failure and concurrency cases', 'Timeouts, repeated requests, invalid data and races'],
  ['evidence', 'Acceptance criteria and evidence', 'Concrete examples, expected results, relevant checks'],
];
const checkoutExample = {
  context: 'Inspect the existing cart, pricing, inventory and payment code. Use the actual stack and versions. For this exercise: signed-in customers, USD, sandbox payments, and on-hand stock deducted at shipment.',
  feature: 'A signed-in customer checks out a saved cart and receives an order and payment-attempt reference.',
  inputs: 'Accept cart_id. Derive customer identity from the session. Load variant prices on the server. Return the trusted amount, currency, order ID and attempt status. Preserve purchased item details.',
  rules: 'Customers access only their own orders. Availability never becomes negative. One logical checkout has one payment effect. Payment confirms allocation; shipment consumes the matching stock once.',
  constraints: 'Reuse current services and contracts. Use provider-hosted or maintained payment collection. Flag policy conflicts and unknowns before implementing.',
  failures: 'Repeated clicks recover the same operation. After a timeout, investigate the existing attempt. Handle duplicate/out-of-order notifications and late success after stock expiry through the agreed review/refund policy.',
  evidence: 'Demonstrate a normal purchase, tampered browser total, duplicate click, last-unit race, replayed webhook and cross-customer order request. Show changed files, checks run, observed results and remaining uncertainty.',
};

function Icon({ name, size = 20 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    lab: <><path d="M9 3h6M10 3v6L4 19a1.3 1.3 0 0 0 1.2 2h13.6a1.3 1.3 0 0 0 1.2-2L14 9V3M7.5 15h9"/><path d="M10 17h.01M14 18h.01"/></>,
    prompt: <><path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></>,
    book: <><path d="M12 5v16M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2Z"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    copy: <><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></>,
    focus: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/></>,
    game: <><path d="M7 8h10c3 0 5 9 3 11-2 2-4-3-5-3H9c-1 0-3 5-5 3-2-2 0-11 3-11Z"/><path d="M8 10v5m-2.5-2.5h5M15 11h.01M18 14h.01M12 8V4"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.book}</svg>;
}

function readRoute() {
  const [kind, id] = window.location.hash.replace(/^#\/?/, '').split('/');
  if (kind === 'lesson' && byId(id)) return { kind, id: Number(id) };
  if (kind === 'part' && reference.modules.some(m => m.id === Number(id))) return { kind, id: Number(id) };
  if (kind === 'labs') return { kind, id: ['inventory', 'payments', 'api'].includes(id) ? id : 'inventory' };
  if (kind === 'practice') return {kind, id: activityIdSet.has(id) ? id : undefined};
  if (['prompts', 'resources', 'arcade'].includes(kind)) return { kind };
  return { kind: 'home' };
}

export default function App() {
  const [route, setRoute] = useState({ kind: 'home' });
  const [data, setData] = useState(empty);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [query, setQuery] = useState('');
  const [menu, setMenu] = useState(false);
  const [focus, setFocus] = useState(false);
  const [toast, setToast] = useState('');
  const [importRevision, setImportRevision] = useState(0);
  const [navTrack, setNavTrack] = useState('foundation');
  const searchRef = useRef(null);
  const uploadRef = useRef(null);

  useEffect(() => {
    try { const saved = localStorage.getItem(KEY); if (saved) setData(cleanProgress(JSON.parse(saved))); }
    catch { setStorageError(true); }
    setReady(true); setRoute(readRoute());
    const onHash = () => { setRoute(readRoute()); setQuery(''); setMenu(false); window.scrollTo({ top: 0, behavior: 'instant' }); };
    const key = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); } if (e.key === 'Escape') { setMenu(false); setQuery(''); } };
    window.addEventListener('hashchange', onHash); window.addEventListener('keydown', key);
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('keydown', key); };
  }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { setStorageError(true); } }, [data, ready]);
  useEffect(() => { if (route.kind === 'lesson') setData(d => ({ ...d, last: route.id })); }, [route.kind, route.id]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3400); return () => clearTimeout(t); }, [toast]);

  function go(kind = 'home', id) {
    const hash = kind === 'home' ? '#home' : `#${kind}${id !== undefined ? '/' + id : ''}`;
    window.location.hash = hash; setRoute(readRoute()); setQuery(''); setMenu(false); window.scrollTo({ top: 0, behavior: 'instant' });
  }
  async function copy(value) {
    try { await navigator.clipboard.writeText(value); setToast('Prompt copied. Add your project context before using it.'); }
    catch { setToast('Clipboard unavailable. Select the prompt text and copy it manually.'); }
  }
  function download(content, name, type = 'application/json') {
    const u = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  async function importProgress(e) {
    const file = e.target.files?.[0]; if (!file) return;
    try { if (file.size > 1500000) throw new Error('This file is too large for a course progress export.'); const next = cleanProgress(JSON.parse(await file.text())); setData(next); setImportRevision(v => v + 1); setToast('Progress, notes, rewards and prompt draft imported.'); }
    catch (err) { setToast(err.message || 'Unable to import this file.'); }
    e.target.value = '';
  }
  function complete(id) {
    setData(d => ({ ...d, completed: d.completed.includes(id) ? d.completed.filter(n => n !== id) : [...d.completed, id] }));
  }
  function award(gameId) {
    if (!['pipeline', 'trust', 'detective'].includes(gameId)) return;
    setData(d => d.achievements.includes(gameId) ? d : { ...d, achievements: [...d.achievements, gameId] });
  }
  function awardPractice(id) {
    if (activityIdSet.has(id)) setData(d => d.practice.includes(id) ? d : {...d, practice:[...d.practice,id]});
  }
  const currentModule = route.kind === 'lesson' ? Number(byId(route.id)?.module_id) : route.kind === 'part' ? route.id : null;
  useEffect(() => { if (currentModule) setNavTrack(reference.modules.find(m => m.id === currentModule)?.track || 'foundation'); }, [currentModule]);
  const progress = Math.round(data.completed.length / lessons.length * 100);
  const resume = data.completed.includes(data.last) ? lessons.find(d => !data.completed.includes(Number(d.id)))?.id || Number(lessons.at(-1).id) : data.last;
  const title = query ? 'Search the fieldguide' : route.kind === 'lesson' ? `Part ${pad(currentModule)} / Lesson ${pad(route.id)}` : ({ home: 'Your learning path', part: `Part ${pad(route.id)}`, labs: 'Interactive labs', arcade: 'The backend arcade', practice:'Practice studio', prompts: 'Prompt workshop', resources: 'Reference desk' }[route.kind]);

  return <div className={`app-shell ${focus ? 'focus-mode' : ''} ${data.reduceMotion ? 'motion-quiet' : ''}`}>
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus(); }}>Skip to learning content</a>
    {menu && <button className="menu-shade" onClick={() => setMenu(false)} aria-label="Close navigation"/>}
    <aside className={`sidebar ${menu ? 'open' : ''}`}>
      <button className="brand" onClick={() => go()} aria-label="Backend Fieldguide home"><span className="brand-symbol"><Icon name="prompt" size={24}/></span><span>Backend<br/><b>Fieldguide</b></span></button>
      <div className="sidebar-caption">A STORE, FROM THE INSIDE OUT</div>
      <nav className="main-nav" aria-label="Main navigation">
        {[['home','grid','Learning path'],['practice','lab','Practice studio'],['arcade','game','Backend arcade'],['labs','lab','Interactive labs'],['prompts','prompt','Prompt workshop'],['resources','book','Reference desk']].map(([kind, icon, label]) => <button key={kind} className={route.kind === kind && !query ? 'active' : ''} onClick={() => go(kind)}><Icon name={icon}/><span>{label}</span>{kind === 'practice' && <em>TRY</em>}</button>)}
      </nav>
      <div className="sidebar-section-label">THE {reference.modules.length} PARTS <span>{lessons.length} lessons</span></div>
      <div className="nav-track"><button aria-pressed={navTrack === 'foundation'} onClick={() => setNavTrack('foundation')}>Foundation</button><button aria-pressed={navTrack === 'practical'} onClick={() => setNavTrack('practical')}>Practical</button></div><nav className="part-nav" aria-label="Course parts">{reference.modules.filter(m => (m.track || 'foundation') === navTrack).map(m => {
        const group = moduleLessons(m.id); const count = group.filter(d => data.completed.includes(Number(d.id))).length;
        return <div className="part-group" key={m.id}><button className={currentModule === m.id ? 'selected' : ''} onClick={() => go('part', m.id)}><span className={`part-number ${count === group.length ? 'done' : ''}`}>{count === group.length ? <Icon name="check" size={12}/> : pad(m.id)}</span><span>{m.title}</span><small>{count}/{group.length}</small></button>{currentModule === m.id && <div className="side-lessons">{group.map(d => <button key={d.id} className={route.kind === 'lesson' && route.id === Number(d.id) ? 'current' : ''} onClick={() => go('lesson', Number(d.id))}><i className={data.completed.includes(Number(d.id)) ? 'done-dot' : ''}/>{d.title}</button>)}</div>}</div>;
      })}</nav>
      <div className="sidebar-progress"><div><span>Your progress</span><strong>{progress}%</strong></div><div className="progress-track"><span style={{ width: `${progress}%` }}/></div><small>{data.completed.length} of {lessons.length} lessons completed</small><div className="progress-actions"><button onClick={() => download(JSON.stringify(data, null, 2), 'backend-fieldguide-progress.json')}>Export</button><button onClick={() => uploadRef.current?.click()}>Import</button></div><input ref={uploadRef} type="file" accept=".json,application/json" hidden onChange={importProgress}/></div>
      <div className="sidebar-author"><span className="avatar">HG</span><span>harshitgupta31415<small>Learn. Explain. Verify.</small></span></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMenu(!menu)} aria-label="Open navigation"><Icon name="menu"/></button><span className="breadcrumb">FIELDGUIDE <span>/</span> <b>{title}</b></span><label className="searchbox"><Icon name="search" size={17}/><input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Find a concept..." aria-label="Search lessons"/><kbd>Ctrl K</kbd></label><button className={`icon-button ${focus ? 'pressed' : ''}`} onClick={() => setFocus(!focus)} aria-label={focus ? 'Exit focus mode' : 'Enter focus mode'} title="Focus mode"><Icon name="focus"/></button></header>
      {storageError && <div className="storage-notice" role="status">Browser storage is unavailable or could not be read. Export your progress before closing this session.</div>}
      <main id="main-content" tabIndex={-1}>
        {query ? <SearchResults query={query} go={go} completed={data.completed}/> : <div className="route-view" key={`${route.kind}/${route.id || ''}/${importRevision}`}>
          {route.kind === 'home' && <JourneyHome key={resume} go={go} data={data} resume={Number(resume)}/>}
          {route.kind === 'part' && <PartJourney id={route.id} go={go} completed={data.completed}/>}
          {route.kind === 'lesson' && <Lesson key={route.id} lesson={byId(route.id)} go={go} copy={copy} data={data} setData={setData} complete={complete}/>}
          {route.kind === 'labs' && <Labs name={route.id} go={go}/>}
          {route.kind === 'arcade' && <GameArcade onAward={award} go={go} completedGames={data.achievements}/>}
          {route.kind === 'practice' && <PracticeStudio name={route.id} go={go} data={data} onAward={awardPractice}/>}
          {route.kind === 'prompts' && <PromptWorkshop draft={data.draft} update={draft => setData(d => ({ ...d, draft }))} copy={copy} download={download}/>}
          {route.kind === 'resources' && <Resources go={go}/>}
        </div>}
      </main>
      <footer className="site-footer"><span>Backend Fieldguide <span>by harshitgupta31415</span></span><button className="motion-setting" aria-pressed={data.reduceMotion} onClick={() => setData(d => ({ ...d, reduceMotion: !d.reduceMotion }))}>{data.reduceMotion ? 'Reduced motion on' : 'Reduce animations'}</button><span>Learn a little. Build understanding.</span></footer>
    </div>
    {toast && <div className="toast" role="status"><Icon name="check" size={17}/>{toast}</div>}
  </div>;
}

function wrapLabel(label) {
  const lines = []; let row = '';
  for (const word of label.split(' ')) { if ((row+' '+word).trim().length > 19 && row) { lines.push(row); row = word; } else row = (row+' '+word).trim(); }
  if (row) lines.push(row); return lines;
}

function ConceptDiagram({ lesson, details }) {
  const [selected, setSelected] = useState(0);
  const { nodes, kind, caption } = lesson.visual;
  const n = nodes.length; const w = 142; const h = 58;
  let positions = nodes.map((_,i) => [20+i*(760-w)/(Math.max(1,n-1)),65]);
  let edges = [];
  if (kind === 'relationship') { positions = [[329,12], ...nodes.slice(1).map((_,i) => [20+i*(760-w)/Math.max(1,n-2),132])]; edges = nodes.slice(1).map((_,i) => [0,i+1]); }
  else if (kind === 'stock' || kind === 'retry_branch') { positions = [[15,78],[280,78],[630,10],[630,143]]; edges = [[0,1],[1,2],[1,3]]; }
  else if (kind === 'race') { positions = [[15,10],[15,143],[310,78],[630,78]]; edges = [[0,2],[1,2],[2,3]]; }
  else if (kind !== 'compare') { edges = nodes.slice(1).map((_,i) => [i,i+1]); if (kind === 'sequence') positions = positions.map(([x,y],i) => [x,i%2 ? 100 : 35]); }
  const marker = `arrow-${lesson.id}`;
  return <div className="concept-diagram"><div className="diagram-toolbar"><span className="eyebrow">LOOK INSIDE THE CONCEPT</span><span>Click any node</span></div><div className="diagram-scroll"><svg className="concept-svg" viewBox="0 0 800 215" aria-label={caption} role="group"><defs><marker id={marker} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 10 5 0 10Z" fill="#7d9e9c"/></marker></defs>{edges.map(([a,b],i) => { const [x1,y1] = positions[a]; const [x2,y2] = positions[b]; const relationship = kind === 'relationship'; return <path key={i} className="diagram-connection" d={relationship ? `M${x1+w/2} ${y1+h} L${x2+w/2} ${y2}` : `M${x1+w} ${y1+h/2} C${(x1+w+x2)/2} ${y1+h/2}, ${(x1+w+x2)/2} ${y2+h/2}, ${x2-4} ${y2+h/2}`} markerEnd={relationship ? undefined : `url(#${marker})`}/>; })}{nodes.map((node,i) => { const [x,y] = positions[i]; const lines = wrapLabel(node); return <g key={i} className={`diagram-node ${selected === i ? 'selected' : ''}`} transform={`translate(${x},${y})`} role="button" tabIndex={0} aria-pressed={selected === i} aria-label={`Explain ${node}`} onClick={() => setSelected(i)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(i); } }}><rect width={w} height={h} rx="10"/><text x={w/2} y={h/2-(lines.length-1)*8+5} textAnchor="middle">{lines.map((l,j) => <tspan key={j} x={w/2} dy={j ? 16 : 0}>{l}</tspan>)}</text></g>; })}</svg></div><p className="diagram-caption">{caption}</p><div className="node-detail" aria-live="polite"><span>{pad(selected+1)}</span><div><strong>{nodes[selected]}</strong><p>{details?.[selected] || 'Trace this step through the worked example, and identify its input, rule and resulting data.'}</p></div></div></div>;
}

function Lesson(props) {
  const id = Number(props.lesson.id);
  return <LessonExperience {...props} module={reference.modules.find(m => Number(m.id) === Number(props.lesson.module_id))} quiz={interactions[pad(id)]} Diagram={ConceptDiagram} Icon={Icon} nextTitle={byId(id+1)?.title}/>;
}

function Labs({ name, go }) {
  const ref = useRef(null); const [error, setError] = useState('');
  useEffect(() => {
    let live = true; let cleanup; let script;
    const element = ref.current;
    setError('');
    function mount() { if (live && element && window.BackendLabs) { try { cleanup = window.BackendLabs.mount(element, name); } catch { setError('The lab could not initialize. Refresh this local page to try again.'); } } }
    function fail() { if (live) setError('The lab script could not load. Check the local server and refresh.'); }
    if (window.BackendLabs) mount();
    else { script = document.getElementById('backend-lab-script'); if (!script) { script=document.createElement('script'); script.id='backend-lab-script'; script.src='/labs.js'; document.body.appendChild(script); } script.addEventListener('load', mount); script.addEventListener('error', fail); }
    return () => { live=false; if (typeof cleanup === 'function') cleanup(); script?.removeEventListener('load', mount); script?.removeEventListener('error', fail); element?.replaceChildren(); };
  }, [name]);
  const labInfo = { inventory: ['Inventory lab','Can two customers buy the last unit?', 'Change reservations, confirm payment and ship stock. Watch each quantity and the rules that keep it consistent.'], payments: ['Payment lab','What does a timeout really mean?', 'Apply provider outcomes and replay notifications. Distinguish missing information from financial failure.'], api: ['API explorer','Can the server trust what the browser sends?', 'Change quantity, cart ownership and browser price. Follow validation and the server’s authoritative response.'] }[name];
  return <div className="page labs-page"><span className="eyebrow">HANDS-ON / SYNTHETIC DATA</span><h1 className="page-title">Small actions.<br/><em>Visible consequences.</em></h1><p className="page-intro">Make a prediction, change one thing, and explain the result. These are learning simulations, with no real payment or API calls.</p><div className="lab-tabs" role="navigation" aria-label="Choose a lab">{[['inventory','Inventory & stock'],['payments','Payments & retries'],['api','Request explorer']].map(([v,l]) => <button key={v} className={name === v ? 'active' : ''} onClick={() => go('labs',v)}>{l}<span>↗</span></button>)}</div><div className="lab-intro"><span className="eyebrow">{labInfo[0]}</span><h2>{labInfo[1]}</h2><p>{labInfo[2]}</p></div>{error && <div className="storage-notice">{error}</div>}<div ref={ref} className="lab-mount"/><div className="related-lessons"><span className="eyebrow">CONNECT THE LAB TO THE LESSONS</span>{(name === 'inventory' ? [17,28,42] : name === 'payments' ? [22,23,24,25] : [1,2,4,18]).map(id => <button key={id} onClick={() => go('lesson',id)}>{pad(id)} / {byId(id).title}<span>→</span></button>)}</div></div>;
}

function PromptWorkshop({ draft, update, copy, download }) {
  const sections = draftFields.map(([key,title]) => draft[key]?.trim() ? `${title.toUpperCase()}\n${draft[key].trim()}` : '').filter(Boolean);
  const compiled = sections.length ? sections.join('\n\n')+'\n\nBefore implementing, identify conflicts or missing decisions. Explain a small approach, verify the result and separate observations from assumptions.' : 'Add the real context, behavior, rules and evidence on the left. Your complete prompt will appear here.';
  const score = draftFields.filter(([key]) => draft[key]?.trim()).length;
  return <div className="page workshop-page"><span className="eyebrow">PROMPT WORKSHOP</span><h1 className="page-title">Be precise.<br/><em>Make success observable.</em></h1><p className="page-intro">A useful prompt describes behavior and proof. Build one from your actual project, then copy it into your chosen AI tool.</p><div className="vague-precise"><div><span className="eyebrow">VAGUE REQUEST</span><p>“Build checkout and make it secure.”</p><small>Who can act? Which totals? What happens after a timeout?</small></div><div><span className="eyebrow">PRECISE DIRECTION</span><p>Actor + trusted data + invariants + failure cases + evidence.</p><button className="text-button" onClick={() => update(checkoutExample)}>Load the completed checkout example <span>↗</span></button></div></div><div className="workshop-toolbar"><span className="pill">{score} of 7 ingredients supplied</span><span>This is a completeness guide, not a guarantee of quality.</span><button className="text-button" onClick={() => update({})}>Clear draft</button></div><div className="workshop-grid"><form onSubmit={e => e.preventDefault()} className="prompt-form">{draftFields.map(([key,title,placeholder],i) => <label key={key} htmlFor={`draft-${key}`}><span><b>{pad(i+1)}</b>{title}</span><textarea id={`draft-${key}`} value={draft[key] || ''} placeholder={placeholder} maxLength={5000} onChange={e => update({ ...draft, [key]: e.target.value })}/></label>)}</form><aside className="compiled-prompt"><div className="prompt-heading"><span className="eyebrow">YOUR COMPOSED PROMPT</span><Icon name="prompt"/></div><pre>{compiled}</pre><div className="compiled-actions"><button className="btn lime" disabled={!sections.length} onClick={() => copy(compiled)}><Icon name="copy" size={16}/> Copy prompt</button><button className="btn dark-secondary" disabled={!sections.length} onClick={() => download(compiled,'backend-feature-prompt.txt','text/plain')}><Icon name="download" size={16}/> Save .txt</button></div><p className="prompt-safety">Use sanitized examples. Keep keys, passwords and customer records out of prompts. This workshop prepares text; it does not send AI requests.</p></aside></div><section className="precision-check"><span className="eyebrow">BEFORE YOU SEND</span><h2>Can another person check the outcome?</h2><div className="step-grid"><div><span>01</span><p>Give one concrete input and the exact expected outcome.</p></div><div><span>02</span><p>Name a failure, a retry and a permission boundary where relevant.</p></div><div><span>03</span><p>Ask what was inspected, what ran and what remains uncertain.</p></div></div></section></div>;
}

const prework = [
  ['Read enough code to ask better questions','A value is data; a type describes its kind. A function groups a task. A condition chooses a path. A side effect changes something outside the function, such as inventory. An async operation finishes later and may fail or time out. Ask AI to locate the start command, test command, cart handler and data write. Explain the input, checks and result before changing it.'],
  ['Follow the network and app layers','DNS maps a domain to a reachable service. HTTPS uses TLS to protect traffic and authenticate the server. A gateway may route traffic across healthy app instances. A router picks a handler; middleware performs shared checks. The handler speaks HTTP, a service holds business rules and a repository accesses data. These layers can live in one application. HTTPS does not decide who owns an order.'],
  ['Learn the security boundaries','Use maintained authentication components. Passwords require suitable one-way hashing; recovery tokens need expiry and single use. Parameterized queries keep data separate from SQL instructions. CORS controls browser cross-origin access and does not authenticate API callers. Cookie-based state changes need appropriate CSRF defenses. Validate inputs, check ownership and limit abuse on the server.'],
  ['Know what this course covers','The foundation and practical tracks cover a standard single-store ecommerce business with synthetic service-integration exercises. Advanced marketplaces, subscriptions, multi-warehouse inventory, international money movement, disputes, event streaming and alternate databases need additional business and technical decisions. Start with clear domain boundaries; add services or infrastructure to solve a demonstrated need.'],
];

function Resources({ go }) {
  const [term, setTerm] = useState('');
  const filtered = reference.glossary.filter(g => (g.term+' '+g.meaning).toLowerCase().includes(term.toLowerCase()));
  return <div className="page resources-page"><span className="eyebrow">REFERENCE DESK</span><h1 className="page-title">Keep the meaning.<br/><em>Lose the mystery.</em></h1><p className="page-intro">Plain-language prework, a searchable glossary and primary references for going deeper.</p><section className="resource-section"><div className="section-heading"><h2>Before lesson one</h2><span className="pill">Start here if code is new</span></div>{prework.map(([title,body],i) => <details className="prework-item" key={title}><summary><span>{pad(i+1)}</span>{title}<b>+</b></summary><p>{body}</p></details>)}<button className="btn secondary" onClick={() => go('lesson',1)}>Begin lesson 01<Icon name="arrow" size={17}/></button></section><section className="resource-section"><div className="section-heading"><h2>The vocabulary, translated.</h2><label className="glossary-search"><Icon name="search" size={17}/><input value={term} onChange={e => setTerm(e.target.value)} placeholder="Find a term..." aria-label="Search glossary"/></label></div><div className="glossary-grid">{filtered.map(g => <div key={g.term}><h3>{g.term}</h3><p>{g.meaning}</p></div>)}</div>{!filtered.length && <p>No matching terms. Try “transaction”, “session” or “retry”.</p>}</section>{reference.advancedTracks?.length > 0 && <section className="resource-section"><div className="section-heading"><div><span className="eyebrow">OPTIONAL EXTENSIONS</span><h2>Beyond a standard single-store foundation.</h2></div></div><p className="reference-intro">These are follow-on tracks for specialized business requirements, not included lessons or completed competencies.</p>{reference.advancedTracks.map((track,index) => <details className="prework-item" key={track.title}><summary><span>{pad(index+1)}</span>{track.title}<b>+</b></summary><p>{track.summary}<br/><strong>Prerequisites: </strong>{Array.isArray(track.prerequisites) ? track.prerequisites.join('; ') : track.prerequisites}</p></details>)}</section>}<section className="resource-section"><div className="section-heading"><div><span className="eyebrow">PRIMARY DOCUMENTATION</span><h2>Check the original source.</h2></div><small>Reviewed {reference.reviewed || '23 October 2026'}</small></div><p className="reference-intro">The lessons use original store examples. These references provide technical depth; provider names illustrate concepts and do not prescribe your stack. Verify the versions and business rules in your own project.</p><div className="reference-list">{reference.sources.map(s => <a key={s.id} href={s.url} target="_blank" rel="noreferrer noopener"><span>{s.id}</span><div><h3>{s.title}</h3><p>{s.note}</p></div><b>↗</b></a>)}</div></section></div>;
}

function SearchResults({ query, go, completed }) {
  const results = lessons.filter(d => `${d.title} ${d.definition} ${d.module_title} ${d.question} ${d.details?.map(x => x.title + ' ' + x.body).join(' ') || ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="page narrow-page"><span className="eyebrow">SEARCH THE FIELDGUIDE</span><h1 className="page-title">Find your next<br/>connection.</h1><p className="page-intro">{results.length} {results.length === 1 ? 'lesson' : 'lessons'} matching “{query}”</p><div className="lesson-list">{results.map(d => <button key={d.id} onClick={() => go('lesson',Number(d.id))}><span className="lesson-list-num">{completed.includes(Number(d.id)) ? '✓' : pad(d.id)}</span><div><small>PART {pad(d.module_id)} / {reference.modules[Number(d.module_id)-1].title}</small><h2>{d.title}</h2><p>{d.question}</p></div><Icon name="arrow"/></button>)}</div>{!results.length && <div className="empty-state"><Icon name="search" size={32}/><h2>No matching concept yet.</h2><p>Try “payment”, “stock”, “API”, “session” or “testing”.</p></div>}</div>;
}
