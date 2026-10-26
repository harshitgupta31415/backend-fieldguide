'use client';

import { useEffect, useRef, useState } from 'react';
import CourseTutor, { TutorIcon } from './CourseTutor';

// Mount this once outside the keyed route view. Hiding the panel keeps its chat alive.
export default function TutorDock({ externalDraft, restoreFocus = true, lessonId, onNavigate, onCourseAction, course, learnerSummary, courseContext, open, onOpenChange, onLayoutChange, defaultOpen = false }) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [width, setWidth] = useState(600);
  const [mobile, setMobile] = useState(false);
  const [showSizing, setShowSizing] = useState(false);
  const panelRef = useRef(null);
  const launcherRef = useRef(null);
  const previousFocus = useRef(null);
  const restoreFocusRef = useRef(restoreFocus);
  restoreFocusRef.current = restoreFocus;
  const layoutCallback = useRef(onLayoutChange);
  layoutCallback.current = onLayoutChange;
  const opened = typeof open === 'boolean' ? open : internalOpen;
  const visible = opened && !collapsed;
  const panelWidth = expanded ? 960 : width;
  const modal = mobile || expanded;

  function setOpen(value) { setInternalOpen(value); onOpenChange?.(value); }
  function reveal() { setCollapsed(false); setOpen(true); }
  function hide() { setOpen(false); setCollapsed(false); setExpanded(false); }
  function minimize() { setOpen(false); setCollapsed(true); setExpanded(false); }

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1000px)');
    const update = () => setMobile(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => { if (opened) setCollapsed(false); }, [opened]);
  useEffect(() => { layoutCallback.current?.({ width: panelWidth, visible, collapsed, expanded, mobile }); }, [panelWidth, visible, collapsed, expanded, mobile]);
  useEffect(() => {
    if (!visible) return;
    previousFocus.current = document.activeElement;
    const frame = requestAnimationFrame(() => panelRef.current?.querySelector(externalDraft?.question || !mobile ? '#tutor-question' : '[data-dock-close]')?.focus({ preventScroll: true }));
    return () => { cancelAnimationFrame(frame); if (restoreFocusRef.current && previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true }); };
  }, [visible]);
  useEffect(() => {
    if (!modal || !visible) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const keydown = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (expanded && !mobile) setExpanded(false); else hide(); return; }
      if (event.key !== 'Tab') return;
      const elements = [...(panelRef.current?.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex="0"]') || [])].filter(element => element.getClientRects().length);
      const first = elements[0], last = elements.at(-1);
      if (!first) return;
      if (event.shiftKey && (document.activeElement === first || !panelRef.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panelRef.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', keydown); };
  }, [modal, mobile, expanded, visible]);

  function navigate(id) {
    if (onNavigate) onNavigate(id); else window.location.hash = `#lesson/${id}`;
    if (mobile) minimize();
    else if (expanded) setExpanded(false);
  }

  return <div className={`tutor-dock-root tutor-roomy ${expanded ? 'is-expanded' : ''} ${visible ? 'is-visible' : ''} ${mobile ? 'is-mobile' : ''}`} style={{ '--tutor-dock-width': `${panelWidth}px` }}>
    {visible && modal && <button type="button" className="tutor-dock-backdrop" aria-label="Dismiss tutor overlay" onClick={hide} tabIndex={-1}/>}
    <aside ref={panelRef} className="tutor-dock" hidden={!visible} role={modal ? 'dialog' : 'complementary'} aria-modal={modal && visible ? true : undefined} aria-label="Your course tutor">
      <header className="tutor-dock-header"><div className="tutor-dock-identity"><span><TutorIcon size={20}/></span><div><strong>Your tutor</strong><small>Let’s work through it together</small></div></div><div className="tutor-dock-controls"><button type="button" className="tutor-width-control" aria-label="Adjust tutor width" aria-expanded={showSizing} onClick={() => setShowSizing(value => !value)} title="Adjust width">↔</button><button type="button" className="tutor-expand-control" onClick={() => {setExpanded(value => !value);setShowSizing(false);}} aria-label={expanded ? 'Return to side chat' : 'Open full chat'} aria-pressed={expanded}><span aria-hidden="true">{expanded ? '↙' : '↗'}</span>{expanded ? 'Side chat' : 'Full chat'}</button><button type="button" onClick={minimize} aria-label="Minimize tutor" title="Minimize">−</button><button type="button" data-dock-close onClick={hide} aria-label="Close tutor" title="Close">×</button></div></header>
      {showSizing && !expanded && <div className="tutor-dock-sizing"><label htmlFor="tutor-panel-width">Chat width <span>{width}px</span></label><input id="tutor-panel-width" type="range" min="480" max="800" step="20" value={width} onChange={event => setWidth(Number(event.target.value))}/></div>}
      <div className="tutor-dock-body"><CourseTutor externalDraft={externalDraft} lessonId={lessonId} onNavigate={navigate} onCourseAction={onCourseAction} course={course} learnerSummary={learnerSummary} courseContext={courseContext} embedded active={visible}/></div>
    </aside>
    {!visible && <button ref={launcherRef} type="button" className={`tutor-dock-launcher ${collapsed ? 'is-collapsed' : ''}`} onClick={reveal} aria-label={collapsed ? 'Resume tutor conversation' : 'Open course tutor'} aria-expanded={false}><span><TutorIcon size={20}/></span><div><strong>{collapsed ? 'Continue our chat' : 'Ask your tutor'}</strong><small>{collapsed ? 'Your conversation is here' : 'Explain · practice · plan'}</small></div><b aria-hidden="true">↗</b></button>}
  </div>;
}
