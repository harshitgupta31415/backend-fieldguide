'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import '../app/access.css';

const AccessContext = createContext(null);

export function AIAccessProvider({ children, onOpenSettings }) {
  // Deliberately kept outside saved progress, browser storage and exported course data.
  const [accessCode, setAccessCode] = useState('');
  const [status, setStatus] = useState({ loading: true, required: true, configured: false });
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const request = useRef(null), currentCode = useRef('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/access', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok || typeof body.accessCodeRequired !== 'boolean') throw new Error();
      if (!controller.signal.aborted) setStatus({ loading: false, required: body.accessCodeRequired, configured: body.accessCodeConfigured === true });
    }).catch(() => { if (!controller.signal.aborted) { setStatus(value => ({ ...value, loading: false })); setError('The access status could not be checked. Enter your code to try again.'); } });
    return () => { controller.abort(); request.current?.abort(); };
  }, []);

  const clearAccess = useCallback(() => {
    request.current?.abort(); request.current = null;
    currentCode.current = ''; setAccessCode(''); setPending(false); setError('');
  }, []);
  const invalidate = useCallback(failedCode => {
    if (failedCode !== currentCode.current) return; // An old request must not clear a newly checked code.
    currentCode.current = ''; setAccessCode('');
    setStatus(value => ({ ...value, required: true }));
    setError('Your access code needs checking. Enter it again below.');
  }, []);

  async function unlock(value) {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setPending(true); setError('');
    try {
      const response = await fetch('/api/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accessCode: value.trim() }), signal: controller.signal });
      const body = await response.json();
      if (!response.ok || body.verified !== true) throw new Error(typeof body.error === 'string' ? body.error : 'The code could not be checked. Please try again.');
      if (request.current !== controller) return false;
      currentCode.current = body.accessCodeRequired ? value.trim() : '';
      setAccessCode(currentCode.current);
      setStatus({ loading: false, required: body.accessCodeRequired === true, configured: body.accessCodeConfigured === true });
      return true;
    } catch (failure) {
      if (!controller.signal.aborted && request.current === controller) setError(failure.message || 'Unable to check access. Please try again.');
      return false;
    } finally { if (request.current === controller) { request.current = null; setPending(false); } }
  }

  return <AccessContext.Provider value={{ accessCode, status, pending, error, unlock, clearAccess, invalidate, openSettings: onOpenSettings }}>{children}</AccessContext.Provider>;
}

export function useAIAccess() { return useContext(AccessContext); }

export function AIAccessNotice({ required = true }) {
  const { accessCode, openSettings } = useAIAccess();
  if (!required || accessCode) return null;
  return <div className="ai-access-notice"><span>Unlock AI once in Settings.</span><button type="button" onClick={openSettings}>Open AI access settings <span aria-hidden="true">↗</span></button></div>;
}

export function AIAccessSettings() {
  const { accessCode, status, pending, error, unlock, clearAccess } = useAIAccess();
  const [draft, setDraft] = useState('');
  const input = useRef(null);
  const unlocked = Boolean(accessCode), localReady = !status.loading && !status.required;
  async function submit(event) { event.preventDefault(); if (await unlock(draft)) setDraft(''); }
  function remove() { clearAccess(); setDraft(''); requestAnimationFrame(() => input.current?.focus()); }
  return <section className="resource-section ai-access-settings" aria-labelledby="ai-access-heading">
    <div className="ai-access-heading"><div><span className="eyebrow">YOUR AI COMPANION</span><h2 id="ai-access-heading">AI access</h2></div><span className={`ai-access-status ${unlocked || localReady ? 'is-unlocked' : ''}`}>{status.loading ? 'Checking…' : unlocked ? 'Unlocked' : localReady ? 'Ready locally' : 'Locked'}</span></div>
    <p>One code for your tutor, AI search and voice. Enter the access code shared by the app owner.</p>
    <div className="ai-access-features" aria-label="Shared AI access"><span>✦ Course tutor</span><span>⌕ AI search</span><span>♪ Voice</span></div>
    {unlocked ? <div className="ai-access-success" role="status"><strong>You’re ready to learn.</strong><p>Your code is checked and available across the app for this session.</p><button type="button" className="btn secondary" onClick={remove}>Remove access code</button></div> : localReady ? <p className="ai-access-success">AI access is open on this local server. No code is required.</p> : <form onSubmit={submit}>
      <label htmlFor="settings-ai-access-code">AI access code</label>
      <div className="ai-access-entry"><input ref={input} id="settings-ai-access-code" type="password" value={draft} onChange={event => setDraft(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} minLength={12} maxLength={256} required placeholder="Enter your access code" aria-describedby="ai-access-help ai-access-error" disabled={pending}/><button className="btn" type="submit" disabled={pending || draft.trim().length < 12}>{pending ? 'Checking…' : 'Unlock AI'}</button></div>
      <p id="ai-access-help" className="ai-access-help">Checking your code does not send a message or use AI credits.</p>
    </form>}
    <p id="ai-access-error" className="ai-access-error" role="alert">{error}</p>
    <p className="ai-access-privacy">Kept only in this page’s memory. Refreshing or closing the page clears it.</p>
  </section>;
}
