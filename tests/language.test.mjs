import test from 'node:test';
import assert from 'node:assert/strict';
import lessons from '../lib/lessons.json' with { type: 'json' };
import interactions from '../lib/interactions.json' with { type: 'json' };
import activities from '../lib/activities.json' with { type: 'json' };
import reference from '../lib/reference.json' with { type: 'json' };
import dictionary from '../lib/hinglish.json' with { type: 'json' };
import { localizeValue, normalizeLanguage, translateText } from '../lib/language.mjs';
import { cleanProgress, emptyProgress } from '../lib/progress.mjs';

const DEVANAGARI = /\p{Script=Devanagari}/u;
const ROMAN_HINDI = /\b(?:hai|hain|ho|hota|hoti|hote|tha|thi|nahi|nahin|kyunki|kyun|pehle|baad|karo|karna|karein|karke|ko|se|aur|mein|par|mat|chahiye|rakho|taaki|toh|yeh|iska)\b/i;
const requiredLessonFields = ['title', 'question', 'definition', 'why', 'example', 'misconception', 'prompt', 'exercise', 'answer', 'steps', 'details', 'debugClues', 'completionChecks', 'prompts', 'visual'];
const excludedFields = new Set(['id', 'moduleId', 'module_id', 'kind', 'simulator', 'language', 'code', 'url', 'href', 'icon', 'correct', 'orderStart', 'start', 'reviewed', 'source', 'date', 'sources', 'references', 'color', 'track']);

function requiresTranslation(value) {
  return typeof value === 'string' && value.length > 4 && /[a-zA-Z]/.test(value) && /\s/.test(value) && !/^https?:\/\//.test(value);
}

function teachingStrings(value, path, output = []) {
  if (typeof value === 'string') {
    if (requiresTranslation(value)) output.push({ path, source: value });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => teachingStrings(item, `${path}[${index}]`, output));
  } else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) if (!excludedFields.has(key)) teachingStrings(child, `${path}.${key}`, output);
  }
  return output;
}

function translated(source) {
  const key = source.trim();
  return Object.hasOwn(dictionary, key) && typeof dictionary[key] === 'string' && dictionary[key].trim() ? dictionary[key] : null;
}

test('every lesson has dictionary coverage for its complete teaching text, including seven prompt patterns', () => {
  assert.equal(lessons.length, 108);
  const missing = [];
  let checked = 0;
  for (const lesson of lessons) {
    for (const field of requiredLessonFields) {
      for (const entry of teachingStrings(lesson[field], `lesson-${lesson.id}.${field}`)) {
        checked++;
        if (!translated(entry.source)) missing.push(`${entry.path}: ${entry.source.slice(0, 95)}`);
      }
    }
  }
  assert.ok(checked > 2000, 'coverage includes practical details and the full prompt set, not only lesson titles');
  assert.deepEqual(missing, [], `Missing lesson translations (${missing.length}):\n${missing.slice(0, 20).join('\n')}`);
});

test('quiz feedback, mission decisions, and reference learning metadata are covered too', () => {
  const entries = [
    ...teachingStrings(interactions, 'interactions'),
    ...teachingStrings(activities, 'activities'),
    ...teachingStrings(reference.modules, 'modules'),
    ...teachingStrings(reference.glossary, 'glossary'),
  ];
  const missing = entries.filter(entry => !translated(entry.source));
  assert.ok(entries.length > 1000);
  assert.deepEqual(missing.map(entry => entry.path), [], `Missing interaction/metadata translations:\n${missing.slice(0, 15).map(entry => `${entry.path}: ${entry.source.slice(0, 80)}`).join('\n')}`);
});

test('the complete dictionary is nonempty Roman-script text without Devanagari', () => {
  assert.ok(Object.keys(dictionary).length > 5000);
  for (const [source, value] of Object.entries(dictionary)) {
    assert.equal(typeof value, 'string', `translation type: ${source.slice(0, 60)}`);
    assert.ok(value.trim(), `empty translation: ${source.slice(0, 60)}`);
    assert.equal(DEVANAGARI.test(value), false, `Devanagari in: ${source.slice(0, 80)}`);
  }
  for (const lesson of lessons) {
    const value = translated(lesson.definition);
    assert.ok(value && ROMAN_HINDI.test(value), `lesson${lesson.id} has an actual Roman-Hindi explanation rather than English fallback`);
    assert.notEqual(value, lesson.definition, `lesson${lesson.id} definition changed language`);
  }
});

test('English is a lossless default and missing Hinglish text falls back without dropping content', () => {
  assert.equal(normalizeLanguage('hinglish'), 'hinglish');
  for (const invalid of [undefined, null, 'hi', 'hi-Latn', 'Hinglish', '', false, {}]) assert.equal(normalizeLanguage(invalid), 'en');
  assert.equal(localizeValue(lessons, 'en', dictionary), lessons);
  assert.equal(translateText('Unknown teaching sentence.', 'hinglish', dictionary), 'Unknown teaching sentence.');
  assert.equal(translateText('Title', 'hinglish', { Title: '' }), 'Title');
  assert.equal(translateText('  Continue\n', 'hinglish', { Continue: 'Aage badhein' }), '  Aage badhein\n');
  assert.equal(translateText(42, 'hinglish', dictionary), 42);
  assert.equal(localizeValue(null, 'hinglish', dictionary), null);
});

test('localization preserves identifiers, routing, code, correct answers, and structural arrays even with tempting translations', () => {
  const input = {
    id: '01', ids: ['01', '02'], module_id: 13, moduleId: 13, track: 'practical', kind: 'flow', type: 'diagnose',
    simulator: 'inventory', color: '#aabbcc', url: 'https://example.invalid/private', href: '#lesson/64',
    src: '/illustration.svg', icon: 'server', code: 'const total_minor = 25000;', language: 'javascript',
    currency: 'INR', variant: 'shirt_demo', store: 'Fieldstore', correct: 2, start: ['request', 'commit'],
    orderStart: ['commit', 'request'], layer: 'server', category: 'browser', target: 'test', targetId: 'cart_demo',
    title: 'Continue', nested: { id: 'cart_demo', title: 'Continue', href: '#part/13' },
    links: ['https://example.invalid/docs', '#lesson/64', '#part/13'],
  };
  const poisoned = Object.fromEntries([
    ...Object.values(input).filter(value => typeof value === 'string').map(value => [value, 'BAD_STRUCTURAL_TRANSLATION']),
    ['01', 'BAD_ID'], ['02', 'BAD_ID'], ['request', 'BAD_REQUEST'], ['commit', 'BAD_COMMIT'], ['cart_demo', 'BAD_CART'], ['Continue', 'Aage badhein'],
  ]);
  const before = structuredClone(input);
  const output = localizeValue(input, 'hinglish', poisoned);
  for (const key of Object.keys(input)) if (!['title', 'nested', 'links'].includes(key)) assert.deepEqual(output[key], input[key], key);
  assert.equal(output.title, 'Aage badhein');
  assert.equal(output.nested.title, 'Aage badhein');
  assert.equal(output.nested.id, 'cart_demo');
  assert.equal(output.nested.href, '#part/13');
  assert.deepEqual(output.links, input.links);
  assert.deepEqual(input, before, 'translation does not mutate the original model');
});

test('all108 localized lessons retain technical implementations, source URLs, and stable lesson identity', () => {
  const before = JSON.stringify(lessons);
  const localized = localizeValue(lessons, 'hinglish', dictionary);
  assert.equal(localized.length, lessons.length);
  for (let index = 0; index < lessons.length; index++) {
    const original = lessons[index];
    const result = localized[index];
    assert.equal(result.id, original.id);
    assert.equal(result.module_id, original.module_id);
    assert.equal(result.visual.kind, original.visual.kind);
    assert.equal(result.implementation?.code, original.implementation?.code);
    assert.equal(result.implementation?.language, original.implementation?.language);
    assert.deepEqual(result.sources.map(source => source.url), original.sources.map(source => source.url));
    assert.equal(result.definition, translated(original.definition));
  }
  const localizedQuiz = localizeValue(interactions, 'hinglish', dictionary);
  for (const key of Object.keys(interactions)) {
    assert.equal(localizedQuiz[key].correct, interactions[key].correct, `lesson${key} answer index`);
    assert.equal(localizedQuiz[key].choices.length, interactions[key].choices.length);
  }
  assert.equal(JSON.stringify(lessons), before);
});

test('critical stock arithmetic and auth identifiers survive the translated prose', () => {
  const byId = id => lessons.find(lesson => Number(lesson.id) === id);
  for (const id of [17, 28]) {
    const source = byId(id).example;
    const target = translated(source);
    assert.ok(target, `inventory example${id} translated`);
    // Keep every numeric literal and its count; spelling “one” as “ek” is fine.
    const counts = value => (value.match(/\b\d+(?:[.:]\d+)*\b/g) || []).reduce((map, number) => map.set(number, (map.get(number) || 0) + 1), new Map());
    const expected = counts(source);
    const actual = counts(target);
    for (const [number, count] of expected) assert.equal(actual.get(number), count, `lesson${id} numeric literal${number}`);
  }
  const auth = translated(byId(74).answer);
  assert.match(auth, /getClaims/);
  assert.match(auth, /getUser/);
  assert.match(auth, /nahi|nahin|not/i, 'cookie/user object is not sufficient proof');
  const retry = translated(byId(22).answer);
  assert.match(retry, /pending|uncertain/i);
  assert.match(retry, /mat|nahi|nahin|not/i, 'uncertainty does not authorize a fresh charge');
  const stock = translated(byId(42).answer);
  assert.match(stock, /on-hand/i);
  assert.match(stock, /nahi|nahin|not/i, 'payment confirmation must not deduct on-hand');
  const permissions = translated(byId(72).answer);
  assert.match(permissions, /ownership/i);
  assert.match(permissions, /nahi|nahin|not/i, 'authenticated-only policy does not provide ownership');
});

test('older progress exports default to English without losing IDs, notes, drafts, or earned rewards', () => {
  const note = 'मेरी निजी note: browser success is not verified payment.';
  const old = { version: 1, completed: [1, 64], notes: { 1: note }, draft: { feature: 'Your progress' }, last: 64, achievements: ['trust'], quizzes: [1], practice: ['setup'], checks: { 64: [0] }, reduceMotion: true };
  const restored = cleanProgress(old);
  assert.equal(emptyProgress.language, 'en');
  assert.equal(restored.language, 'en');
  assert.equal(restored.notes[1], note, 'user-written notes are never translated');
  assert.equal(restored.draft.feature, old.draft.feature);
  assert.deepEqual(restored.completed, [1, 64]);
  assert.deepEqual(restored.achievements, ['trust']);
  assert.deepEqual(restored.practice, ['setup']);
  assert.deepEqual(restored.quizzes, [1]);
  assert.deepEqual(restored.checks, { 64: [0] });
  assert.equal(restored.last, 64);
  assert.equal(restored.reduceMotion, true);
  const optedIn = cleanProgress(JSON.parse(JSON.stringify({ ...restored, language: 'hinglish' })));
  assert.equal(optedIn.language, 'hinglish');
  const { language: _oldLanguage, ...before } = restored;
  const { language: _newLanguage, ...after } = optedIn;
  assert.deepEqual(after, before, 'changing display language does not rewrite progress or award XP');
  for (const invalid of ['hi', 'HI', 'Hinglish', null, 1, {}]) assert.equal(cleanProgress({ ...old, language: invalid }).language, 'en');
});
