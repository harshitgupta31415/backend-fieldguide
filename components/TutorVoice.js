'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import '../app/voice.css';

const MAX_BYTES = 5 * 1024 * 1024;
let playback = null;
function claimPlayback(owner, stop) {
  if (playback && playback.owner !== owner) playback.stop();
  playback = { owner, stop };
}
function stopPlayback() { playback?.stop(); }
function releasePlayback(owner) { if (playback?.owner === owner) playback = null; }

async function responseError(response, fallback) {
  try {
    const body = await response.json();
    const failure = new Error(typeof body.error === 'string' ? body.error.slice(0, 300) : fallback);
    if (body.code === 'VOICE_TERMS_REQUIRED') failure.code = 'VOICE_TERMS_REQUIRED';
    return failure;
  } catch { return new Error(fallback); }
}

export function VoiceInput({ onTranscript, accessCode = '', disabled = false, language = 'en', active = true }) {
  const [phase, setPhase] = useState('idle');
  const [supported, setSupported] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const mounted = useRef(false), generation = useRef(0), capture = useRef(null), upload = useRef(null), preview = useRef(null), previewUrl = useRef(null);
  const allowed = useRef(active && !disabled), callback = useRef(onTranscript);
  allowed.current = active && !disabled; callback.current = onTranscript;

  const clearCapture = useCallback(() => {
    const current = capture.current;
    if (!current) return;
    current.cancelled = true;
    clearInterval(current.interval); clearTimeout(current.timeout);
    if (current.recorder.state !== 'inactive') { try { current.recorder.stop(); } catch {} }
    current.stream.getTracks().forEach(track => track.stop());
    capture.current = null;
  }, []);

  const discard = useCallback((update = true) => {
    generation.current++;
    upload.current?.abort(); upload.current = null;
    clearCapture();
    preview.current?.pause(); releasePlayback(preview);
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    if (update && mounted.current) { setRecording(null); setPhase('idle'); setSeconds(0); }
  }, [clearCapture]);

  useEffect(() => {
    mounted.current = true;
    setSupported(Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder));
    return () => { mounted.current = false; discard(false); };
  }, [discard]);

  useEffect(() => { if (!active || disabled) discard(); }, [active, disabled, discard]);

  function stopRecording() {
    const current = capture.current;
    if (!current || current.recorder.state === 'inactive') return;
    clearInterval(current.interval); clearTimeout(current.timeout);
    current.duration = Date.now() - current.started;
    setPhase('stopping');
    try { current.recorder.stop(); } catch { discard(); setError('The recording stopped unexpectedly. Please try again.'); }
    current.stream.getTracks().forEach(track => track.stop());
  }

  async function startRecording() {
    if (!allowed.current || !supported) return;
    discard(); stopPlayback(); setNotice(''); setError(''); setPhase('requesting');
    const token = generation.current;
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 }, video: false });
      if (!mounted.current || token !== generation.current || !allowed.current) { stream.getTracks().forEach(track => track.stop()); return; }
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported?.(type));
      const recorder = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 64000 });
      const current = { recorder, stream, parts: [], size: 0, started: Date.now(), cancelled: false, oversized: false };
      capture.current = current;
      recorder.ondataavailable = event => {
        if (current.cancelled || !event.data.size) return;
        current.size += event.data.size;
        if (current.size > MAX_BYTES) { current.oversized = true; stopRecording(); }
        else current.parts.push(event.data);
      };
      recorder.onerror = () => { if (token === generation.current && mounted.current) { discard(); setError('The microphone could not finish recording. Please try again.'); } };
      recorder.onstop = () => {
        clearInterval(current.interval); clearTimeout(current.timeout);
        stream.getTracks().forEach(track => track.stop());
        if (capture.current === current) capture.current = null;
        if (current.cancelled || !mounted.current || token !== generation.current) return;
        const duration = current.duration || Date.now() - current.started;
        if (current.oversized || duration > 61000) { setPhase('idle'); setError('The recording was too long or large. Try a shorter question (up to 60 seconds).'); return; }
        const blob = new Blob(current.parts, { type: recorder.mimeType || mime || 'audio/webm' });
        if (!blob.size) { setPhase('idle'); setError('No audio was recorded. Check your microphone and try again.'); return; }
        const url = URL.createObjectURL(blob); previewUrl.current = url;
        setRecording({ blob, url, durationMs: Math.min(60000, Math.max(1, duration)) });
        setPhase('ready'); setNotice('Recording ready. Transcribe it, then review the question before sending.');
      };
      recorder.start(250);
      setPhase('recording'); setSeconds(0);
      current.interval = setInterval(() => setSeconds(Math.min(60, Math.floor((Date.now() - current.started) / 1000))), 250);
      current.timeout = setTimeout(stopRecording, 60000);
    } catch (failure) {
      stream?.getTracks().forEach(track => track.stop());
      if (!mounted.current || token !== generation.current) return;
      setPhase('idle');
      setError(failure.name === 'NotAllowedError' ? 'Microphone permission was not granted. Allow it in your browser, or type your question.' : failure.name === 'NotFoundError' ? 'No microphone was found. Connect one or type your question.' : 'This browser could not start recording. Try another browser or type your question.');
    }
  }

  async function transcribe() {
    if (!recording || !allowed.current || upload.current) return;
    preview.current?.pause(); releasePlayback(preview);
    setError(''); setNotice('Transcribing your recording…'); setPhase('transcribing');
    const token = generation.current, controller = new AbortController(); upload.current = controller;
    const form = new FormData();
    form.set('file', recording.blob, 'question.webm'); form.set('durationMs', String(recording.durationMs)); form.set('language', language); form.set('accessCode', accessCode);
    try {
      const response = await fetch('/api/voice/transcribe', { method: 'POST', body: form, signal: controller.signal });
      if (!response.ok) throw await responseError(response, 'Transcription is unavailable. Please type your question or try again.');
      const result = await response.json();
      if (!mounted.current || token !== generation.current || controller.signal.aborted || !allowed.current) return;
      if (typeof result.text !== 'string' || !result.text.trim()) throw new Error('No clear speech was found. Try again or type your question.');
      callback.current(result.text);
      discard(); setNotice(result.truncated ? 'The first 2,000 characters are in your question. Review them before sending.' : 'Your transcript is in the question box. Review it before sending.');
    } catch (failure) {
      if (!mounted.current || token !== generation.current || controller.signal.aborted) return;
      setPhase('ready'); setNotice(''); setError(failure.message || 'Transcription failed. Try again or type your question.');
    } finally { if (upload.current === controller) upload.current = null; }
  }

  return <div className="tutor-voice tutor-voice-input">
    <div className="voice-controls">
      {['idle', 'ready'].includes(phase) && <button type="button" className="voice-button" onClick={startRecording} disabled={disabled || !active || supported === false} aria-label={recording ? 'Record another question' : 'Record a question'}><span aria-hidden="true">●</span> {recording ? 'Record again' : 'Record question'}</button>}
      {phase === 'requesting' && <><span>Allow microphone access…</span><button type="button" className="voice-button" onClick={() => discard()}>Cancel</button></>}
      {phase === 'recording' && <><button type="button" className="voice-button voice-stop" onClick={stopRecording}>■ Stop recording</button><span className="voice-timer" role="timer">{seconds}s / 60s</span></>}
      {phase === 'stopping' && <span role="status">Preparing recording…</span>}
      {phase === 'ready' && <><button type="button" className="voice-button voice-primary" onClick={transcribe} disabled={disabled || !active}>Transcribe</button><button type="button" className="voice-button" onClick={() => { discard(); setNotice('Recording discarded.'); setError(''); }}>Discard</button></>}
      {phase === 'transcribing' && <button type="button" className="voice-button" onClick={() => { discard(); setNotice('Transcription cancelled.'); }}>Cancel transcription</button>}
    </div>
    {recording && <audio className="voice-preview" ref={preview} controls src={recording.url} preload="metadata" aria-label="Preview your recording" onPlay={() => claimPlayback(preview, () => preview.current?.pause())} />}
    {supported === false && <p className="voice-note">Microphone recording is unavailable in this browser. You can still type your question.</p>}
    <p className="voice-note">Up to 60 seconds. Audio is sent to Groq only when you choose Transcribe; this app does not save recordings.</p>
    {notice && <p className="voice-note" role="status">{notice}</p>}
    {error && <p className="voice-error" role="alert">{error}</p>}
  </div>;
}

function spokenText(value) {
  return String(value || '').replace(/```[\s\S]*?```/g, ' Code example omitted from audio. ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '').replace(/[#*_`>|]/g, '').replace(/\[|\]/g, '').replace(/\s+/g, ' ').trim();
}

export function VoiceOutput({ text, accessCode = '', language = 'en', active = true }) {
  const [phase, setPhase] = useState('idle'), [mode, setMode] = useState('natural'), [error, setError] = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);
  const [voices, setVoices] = useState([]), [voice, setVoice] = useState(''), [browserAvailable, setBrowserAvailable] = useState(false);
  const mounted = useRef(false), generation = useRef(0), controller = useRef(null), player = useRef(null), url = useRef(null), utterance = useRef(null), owner = useRef({});
  const allowed = useRef(active); allowed.current = active;
  const selectId = useId(), fullText = spokenText(text), readText = fullText.slice(0, 2000);

  const stop = useCallback((update = true) => {
    generation.current++;
    controller.current?.abort(); controller.current = null;
    if (player.current) { player.current.onplay = null; player.current.onpause = null; player.current.onended = null; player.current.onerror = null; player.current.pause(); player.current.removeAttribute('src'); player.current.load(); player.current = null; }
    if (url.current) URL.revokeObjectURL(url.current); url.current = null;
    if (utterance.current) { utterance.current.onstart = null; utterance.current.onend = null; utterance.current.onerror = null; window.speechSynthesis?.cancel(); utterance.current = null; }
    releasePlayback(owner);
    if (update && mounted.current) setPhase('idle');
  }, []);

  useEffect(() => {
    mounted.current = true;
    const synth = window.speechSynthesis;
    setBrowserAvailable(Boolean(synth && window.SpeechSynthesisUtterance));
    const updateVoices = () => setVoices(synth?.getVoices() || []);
    updateVoices(); synth?.addEventListener('voiceschanged', updateVoices);
    return () => { mounted.current = false; synth?.removeEventListener('voiceschanged', updateVoices); stop(false); };
  }, [stop]);
  useEffect(() => { stop(); setError(''); setNeedsSetup(false); }, [text, language, stop]);
  useEffect(() => { if (!active) stop(); }, [active, stop]);

  function startBrowser() {
    if (!allowed.current || !readText || !browserAvailable) return;
    stop(); setMode('browser'); setError(''); setNeedsSetup(false); claimPlayback(owner, stop);
    const token = generation.current, speech = new SpeechSynthesisUtterance(readText);
    const selected = voices.find(item => item.voiceURI === voice) || voices.find(item => item.lang.toLowerCase() === 'en-in') || voices.find(item => item.lang.toLowerCase().startsWith('en')) || voices[0];
    if (selected) speech.voice = selected;
    speech.lang = selected?.lang || 'en-IN'; speech.rate = 1; speech.pitch = 1;
    speech.onstart = () => { if (mounted.current && token === generation.current) setPhase('playing'); };
    speech.onend = () => { if (mounted.current && token === generation.current) { utterance.current = null; releasePlayback(owner); setPhase('idle'); } };
    speech.onerror = event => { if (mounted.current && token === generation.current && !['interrupted', 'canceled'].includes(event.error)) { stop(); setError('The browser voice could not play. Try another available voice.'); } };
    utterance.current = speech; setPhase('playing'); window.speechSynthesis.resume(); window.speechSynthesis.speak(speech);
  }

  async function startNatural() {
    if (!allowed.current || !readText) return;
    stop(); setMode('natural'); setError(''); setNeedsSetup(false); setPhase('loading'); claimPlayback(owner, stop);
    const token = generation.current, request = new AbortController(); controller.current = request;
    try {
      const response = await fetch('/api/voice/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: readText, language, accessCode }), signal: request.signal });
      if (!response.ok) throw await responseError(response, 'Natural voice is unavailable. You can use the browser voice.');
      const blob = await response.blob();
      if (!mounted.current || token !== generation.current || request.signal.aborted || !allowed.current) return;
      const objectUrl = URL.createObjectURL(blob), audio = new Audio(objectUrl); url.current = objectUrl; player.current = audio;
      audio.onplay = () => { if (mounted.current && token === generation.current) setPhase('playing'); };
      audio.onpause = () => { if (mounted.current && token === generation.current && !audio.ended) setPhase('paused'); };
      audio.onended = () => { if (mounted.current && token === generation.current) setPhase('ready'); };
      audio.onerror = () => { if (mounted.current && token === generation.current) { stop(); setError('The generated audio could not play. Use the browser voice.'); } };
      setPhase('ready');
      try { await audio.play(); } catch { if (mounted.current && token === generation.current) setPhase('ready'); }
    } catch (failure) {
      if (!mounted.current || token !== generation.current || request.signal.aborted) return;
      stop(); setNeedsSetup(failure.code === 'VOICE_TERMS_REQUIRED'); setError(failure.message || 'Natural voice is unavailable. You can use the browser voice.');
    } finally { if (controller.current === request) controller.current = null; }
  }

  function pause() {
    if (utterance.current) window.speechSynthesis.pause(); else player.current?.pause();
    setPhase('paused');
  }
  async function resume() {
    if (!allowed.current) return;
    claimPlayback(owner, stop);
    if (utterance.current) { window.speechSynthesis.resume(); setPhase('playing'); }
    else if (player.current) { try { await player.current.play(); } catch { setError('Press Play again, or choose the browser voice.'); } }
  }

  return <div className="tutor-voice tutor-voice-output" aria-label="Read this answer aloud">
    <div className="voice-controls">
      <label className="voice-select-label" htmlFor={selectId}>Voice</label>
      <select id={selectId} className="voice-select" value={mode} onChange={event => { stop(); setError(''); setNeedsSetup(false); setMode(event.target.value); }}>
        <option value="natural">Natural voice</option><option value="browser" disabled={!browserAvailable}>Browser voice</option>
      </select>
      {phase === 'idle' && <button type="button" className="voice-button" disabled={!active || !readText || mode === 'browser' && !browserAvailable} onClick={mode === 'browser' ? startBrowser : startNatural}>▶ Read aloud</button>}
      {phase === 'loading' && <span role="status">Preparing natural voice…</span>}
      {phase === 'playing' && <button type="button" className="voice-button" onClick={pause}>Ⅱ Pause</button>}
      {['paused', 'ready'].includes(phase) && <button type="button" className="voice-button" disabled={!active} onClick={resume}>▶ {phase === 'paused' ? 'Resume' : 'Play'}</button>}
      {phase !== 'idle' && <button type="button" className="voice-button" onClick={() => stop()}>■ Stop</button>}
    </div>
    {mode === 'browser' && voices.length > 0 && <label className="voice-choice">Available voice <select className="voice-select" value={voice} onChange={event => { stop(); setVoice(event.target.value); }}><option value="">Default English voice</option>{voices.map(item => <option key={item.voiceURI} value={item.voiceURI}>{item.name} ({item.lang})</option>)}</select></label>}
    <p className="voice-note">{mode === 'natural' ? 'Natural English voice. Hindi pronunciation may vary.' : 'Browser/device voices vary and may use an online speech service.'}{fullText.length > 2000 ? ' Reads the first 2,000 characters.' : ''}</p>
    {error && <div className="voice-error" role="alert"><p>{error}</p>{needsSetup && <p><a href="https://console.groq.com/playground?model=canopylabs%2Forpheus-v1-english" target="_blank" rel="noopener noreferrer">Open Groq model setup ↗</a></p>}{mode === 'natural' && browserAvailable && <button type="button" className="voice-button" disabled={!active} onClick={startBrowser}>Use browser voice</button>}</div>}
  </div>;
}
