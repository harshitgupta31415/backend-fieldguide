import lessons from './lessons.json' with { type: 'json' };
import interactions from './interactions.json' with { type: 'json' };
import reference from './reference.json' with { type: 'json' };

// This index contains authored course material only. It never accepts progress,
// notes, chat history, environment variables, or remote documents as sources.
const MAX_RESULTS = 8;
const MAX_QUERY_CHARS = 12000;
const MAX_QUERY_TERMS = 64;
const MAX_EXCERPT_CHARS = 2500;
const K1 = 1.2;
const B = 0.7;

const STOP_WORDS = new Set(`a an and are as at be been being but by can cannot could did do does doing for from had has have having how i if in into is it its just may me might more most my need of on one only or our out please should so some than that the their them then there these they this those through to too us use used using very want was we were what when where which who why will with would you your about actually also any ask before after between both course explain give help know learn lets make much must not now other really show tell understand get getting got example existing fieldstore application app project thing things way work works working write written code question answer all no yes information instructions instruction previous prior earlier ignore reveal system assistant developer begin end`.split(/\s+/));

const ALIASES = new Map(Object.entries({
  rls: 'rls', db: 'database', databases: 'database', postgres: 'postgres', postgresql: 'postgres', apis: 'api',
  env: 'environment', config: 'configuration', configure: 'configuration', configured: 'configuration', configuring: 'configuration',
  secrets: 'secret', credentials: 'credential', keys: 'key', tokens: 'token', cookies: 'cookie', sessions: 'session',
  users: 'user', customers: 'customer', owns: 'ownership', owned: 'ownership', owner: 'ownership', owners: 'ownership',
  auth: 'authentication', authenticate: 'authentication', authenticated: 'authentication', authenticating: 'authentication',
  authorize: 'authorization', authorized: 'authorization', authorise: 'authorization', authorised: 'authorization',
  verify: 'verify', verification: 'verify', verified: 'verify', verifying: 'verify', verifies: 'verify', verifier: 'verify',
  grants: 'grant', granted: 'grant', policies: 'policy', constraints: 'constraint', migrations: 'migration',
  payments: 'payment', paid: 'payment', charges: 'charge', charged: 'charge', charging: 'charge',
  refunds: 'refund', refunded: 'refund', refunding: 'refund', webhooks: 'webhook', events: 'event',
  shipping: 'ship', shipment: 'ship', shipments: 'ship', shipped: 'ship', ships: 'ship', couriers: 'courier',
  timeouts: 'timeout', retry: 'retry', retries: 'retry', retried: 'retry', retrying: 'retry',
  duplicate: 'duplicate', duplicated: 'duplicate', duplicates: 'duplicate', deduplication: 'duplicate', deduplicate: 'duplicate',
  idempotency: 'idempotency', idempotent: 'idempotency', orders: 'order', carts: 'cart',
  reservations: 'reservation', reserved: 'reservation', reserve: 'reservation', reserving: 'reservation',
  uploads: 'upload', uploaded: 'upload', uploading: 'upload', files: 'file', callbacks: 'callback',
  redirects: 'redirect', redirected: 'redirect', deployments: 'deployment', deployed: 'deployment',
  functions: 'function', connections: 'connection', pools: 'pool', pooling: 'pool',
  permissions: 'permission', variables: 'variable', prices: 'price', pricing: 'price',
  browsers: 'browser', servers: 'server', builds: 'build', building: 'build', built: 'build',
  tests: 'test', testing: 'test', tested: 'test', failures: 'failure', failed: 'failure', fails: 'failure',
}));

const WEIGHTS = Object.freeze({
  title: 7, question: 3.8, definition: 3.5, why: 1.6, details: 3.2,
  example: 2.3, steps: 1.8, answer: 2.7, debug: 2.5, implementation: 1.8,
  checks: 1.1, misconception: 0.9, prompts: 0.3, quiz: 1.7, reference: 0.7,
});

// Explicit domain nouns should not disappear behind generic overlapping words
// such as “success”, “redirect”, and “verify” from a different subject area.
const DOMAIN_ANCHORS = new Set(['payment', 'ship', 'rls', 'supabase', 'nextpublic', 'database', 'inventory', 'authentication', 'authorization', 'webhook']);
const TOPIC_TERMS = new Set([...DOMAIN_ANCHORS, 'configuration', 'environment', 'secret', 'key', 'credential', 'session', 'cookie', 'cart', 'order', 'stock', 'cache', 'migration', 'index', 'callback', 'refund', 'retry', 'price', 'storage', 'realtime', 'function', 'api', 'http', 'json', 'constraint', 'permission', 'identity', 'ownership', 'grant', 'policy', 'npm', 'lockfile', 'build', 'server', 'browser', 'sql', 'pipeline', 'capstone', 'prompt', 'test', 'node', 'port', 'deployment']);

function text(value) {
  return typeof value === 'string' ? value : '';
}

function normalize(value) {
  return text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\brow[\s-]+level[\s-]+security\b/g, ' rls ')
    .replace(/\btimed?[\s-]+out\b/g, ' timeout ')
    .replace(/\bnext_public_?/g, ' nextpublic ')
    .replace(/\b(?:recovery point objective|rpo)\b/g, ' recoverypointobjective ')
    .replace(/\b(?:recovery time objective|rto)\b/g, ' recoverytimeobjective ')
    .replace(/\b([a-z]+)'s\b/g, '$1');
}

function tokenize(value) {
  const tokens = normalize(value).match(/[a-z0-9]+/g) || [];
  return tokens.map(token => ALIASES.get(token) || token)
    .filter(token => token.length > 1 && !STOP_WORDS.has(token));
}

function frequencies(tokens) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  return counts;
}

const modules = new Map((reference.modules || []).map(module => [Number(module.id), module]));
const referenceByUrl = new Map((reference.sources || []).map(source => [source.url, source]));

function sourcesFor(lesson) {
  const seen = new Set();
  return (lesson.sources || []).filter(source => {
    if (!source || typeof source.title !== 'string' || typeof source.url !== 'string' || !/^https:\/\//i.test(source.url) || seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  }).map(source => ({ title: source.title, url: source.url }));
}

function buildDocument(lesson) {
  const chunks = [];
  const add = (type, section, value) => {
    const body = text(value).replace(/\r\n/g, '\n').trim();
    if (body) chunks.push({ type, section, text: body, tokens: tokenize(body) });
  };
  const quiz = interactions[String(lesson.id).padStart(2, '0')];
  const module = modules.get(Number(lesson.module_id));
  const references = sourcesFor(lesson);
  add('title', 'Lesson title', lesson.title);
  add('question', 'Motivating question', lesson.question);
  add('definition', 'Core concept', lesson.definition);
  add('why', 'Why it matters', lesson.why);
  for (const detail of lesson.details || []) add('details', `Practical detail: ${detail.title}`, detail.body);
  add('example', 'Worked example', lesson.example);
  add('steps', 'How it works', (lesson.steps || []).join('\n'));
  // Misconceptions and distractors never become isolated claims in the prompt.
  // Include the question with its teaching answer, not false multiple-choice text.
  add('answer', 'Prediction and teaching answer', `${text(lesson.exercise)}\n${text(lesson.answer)}`);
  if (lesson.misconception) add('misconception', 'Incorrect assumption and its correction', `Incorrect assumption: ${lesson.misconception}\nCorrection: ${text(lesson.definition)}\n${text(lesson.answer)}`);
  add('debug', 'Debugging clues', (lesson.debugClues || []).join('\n'));
  add('implementation', 'Implementation example (check its stated limits)', [lesson.implementation?.code, lesson.implementation?.note].filter(Boolean).join('\n'));
  add('checks', 'Completion checks', (lesson.completionChecks || []).join('\n'));
  add('prompts', 'Topic prompt ideas', Object.values(lesson.prompts || { implement: lesson.prompt }).map(text).join('\n'));
  if (quiz) {
    add('quiz', 'Quiz reasoning', [quiz.choices?.[quiz.correct], quiz.explanation].filter(Boolean).join('\n'));
    add('quiz', 'Diagram explanations', (quiz.nodeDetails || []).join('\n'));
  }
  add('reference', 'Course section', [module?.title || lesson.module_title, module?.outcome].filter(Boolean).join('. '));
  add('reference', 'Official reference context', references.map(source => [source.title, referenceByUrl.get(source.url)?.note].filter(Boolean).join(': ')).join('\n'));
  const anchorTokens = new Set(tokenize([lesson.title, lesson.question, lesson.definition].join(' ')));
  for (const entry of reference.glossary || []) {
    const terms = tokenize(entry.term);
    if (terms.length && terms.every(term => anchorTokens.has(term))) add('reference', `Glossary: ${entry.term}`, `${entry.term}: ${entry.meaning}`);
  }
  const fields = new Map();
  for (const chunk of chunks) {
    const field = fields.get(chunk.type) || { tokens: [], counts: new Map(), length: 0 };
    field.tokens.push(...chunk.tokens);
    fields.set(chunk.type, field);
  }
  const allTerms = new Set();
  for (const field of fields.values()) {
    field.counts = frequencies(field.tokens);
    field.length = field.tokens.length;
    for (const term of field.counts.keys()) allTerms.add(term);
    delete field.tokens;
  }
  return { lessonId: Number(lesson.id), title: lesson.title, moduleId: Number(lesson.module_id), moduleTitle: module?.title || lesson.module_title, chunks, fields, allTerms, references };
}

const documents = lessons.map(buildDocument).sort((a, b) => a.lessonId - b.lessonId);
const documentFrequency = new Map();
const averageFieldLength = new Map();
for (const document of documents) {
  for (const term of document.allTerms) documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
  for (const [type, field] of document.fields) averageFieldLength.set(type, (averageFieldLength.get(type) || 0) + field.length);
}
for (const [type, total] of averageFieldLength) averageFieldLength.set(type, total / documents.length || 1);

// A small floor keeps useful course-wide nouns (“secret”, “configuration”) from
// becoming numerically meaningless merely because prompt templates repeat them.
const idf = term => Math.max(0.12, Math.log(1 + (documents.length - (documentFrequency.get(term) || 0) + 0.5) / ((documentFrequency.get(term) || 0) + 0.5)));

function queryTerms(question) {
  // Remove a few common instruction wrappers, but do not execute, follow, or
  // treat query text as source material. This is relevance cleanup, not a prompt
  // injection security boundary; the tutor route must keep that boundary too.
  const clean = question.slice(0, MAX_QUERY_CHARS)
    .replace(/(?:reveal|print|show|return|repeat|expose)\s+(?:me\s+)?(?:the\s+|your\s+)?(?:hidden\s+|private\s+)?system\s+prompts?/gi, ' ')
    .replace(/ignore\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|earlier)\s+(?:instructions|rules|messages)/gi, ' ');
  return [...new Set(tokenize(clean))].slice(0, MAX_QUERY_TERMS);
}

function scoreField(field, type, terms) {
  const norm = K1 * (1 - B + B * field.length / (averageFieldLength.get(type) || 1));
  let score = 0;
  for (const term of terms) {
    const tf = field.counts.get(term) || 0;
    if (tf) score += idf(term) * tf * (K1 + 1) / (tf + norm);
  }
  return score * (WEIGHTS[type] || 1);
}

function rankDocument(document, terms, currentLesson) {
  if (terms.some(term => DOMAIN_ANCHORS.has(term) && !document.allTerms.has(term))) return null;
  const matches = terms.filter(term => document.allTerms.has(term));
  const matchedWeight = matches.reduce((sum, term) => sum + idf(term), 0);
  const queryWeight = terms.reduce((sum, term) => sum + idf(term), 0);
  const coverage = matchedWeight / (queryWeight || 1);
  // Unknown/off-topic words count against coverage. Generic words alone should
  // not cause a current lesson to be inserted into an unrelated conversation.
  if (!matches.length || (terms.length > 1 && matches.length < 2) || coverage < 0.4) return null;
  const substantive = ['title', 'question', 'definition', 'details', 'example', 'steps', 'answer', 'debug', 'implementation'];
  const substantiveMatch = matches.some(term => substantive.some(type => document.fields.get(type)?.counts.has(term)));
  const topicalQuery = terms.some(term => TOPIC_TERMS.has(term));
  if (!substantiveMatch || matchedWeight < (topicalQuery ? 0.1 : 0.65)) return null;
  let score = 0;
  for (const [type, field] of document.fields) score += scoreField(field, type, terms);
  if (score < (topicalQuery ? 0.65 : 3.2)) return null;
  if (document.lessonId === currentLesson) score *= 1.24;
  return { document, score, coverage, matches };
}

function chunkScore(chunk, terms) {
  const counts = frequencies(chunk.tokens);
  const lengthPenalty = 1 + chunk.tokens.length / 150;
  const termScore = terms.reduce((sum, term) => sum + (counts.has(term) ? idf(term) * (1 + Math.min(counts.get(term), 3) / 5) : 0), 0);
  return termScore * (WEIGHTS[chunk.type] || 1) / lengthPenalty;
}

function excerptWindow(value, terms, maxChars) {
  const body = value.replace(/\s+/g, ' ').trim();
  if (body.length <= maxChars) return body;
  // Window around a literal query term when possible. Canonical aliases still
  // rank the full chunk; a nonliteral alias simply uses its introductory text.
  const lower = normalize(body);
  const positions = terms.map(term => lower.indexOf(term)).filter(index => index >= 0);
  const match = positions.length ? Math.min(...positions) : 0;
  let start = Math.max(0, Math.min(body.length - maxChars, match - Math.floor(maxChars / 4)));
  if (start) {
    const boundary = body.indexOf(' ', start);
    if (boundary >= 0 && boundary - start < 35) start = boundary + 1;
  }
  let end = Math.min(body.length, start + maxChars - (start ? 2 : 0) - 2);
  if (end < body.length) {
    const boundary = body.lastIndexOf(' ', end);
    if (boundary > start + maxChars / 2) end = boundary;
  }
  return `${start ? '… ' : ''}${body.slice(start, end)}${end < body.length ? ' …' : ''}`;
}

function citation(result, terms) {
  const document = result.document;
  const rankedChunks = document.chunks
    .map((chunk, index) => ({ chunk, index, score: chunkScore(chunk, terms) }))
    .filter(item => item.score > 0 && item.chunk.type !== 'title' && item.chunk.type !== 'question')
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const best = rankedChunks[0]?.chunk || document.chunks.find(chunk => chunk.type === 'definition');
  const selected = [];
  const definition = document.chunks.find(chunk => chunk.type === 'definition');
  // Always retain an explanatory anchor. Prefer teaching content to imperative
  // prompt examples, which remain explicitly labeled when they are relevant.
  if (definition) selected.push({ chunk: definition, max: 650 });
  for (const candidate of rankedChunks) {
    if (selected.some(item => item.chunk === candidate.chunk)) continue;
    selected.push({ chunk: candidate.chunk, max: candidate.chunk.type === 'prompts' ? 450 : 850 });
    if (selected.length >= 4) break;
  }
  let excerpt = `Lesson ${document.lessonId}: ${document.title}\n`;
  for (const item of selected) {
    const prefix = `\n${item.chunk.section}: `;
    const available = MAX_EXCERPT_CHARS - excerpt.length - prefix.length;
    if (available < 80) break;
    excerpt += prefix + excerptWindow(item.chunk.text, terms, Math.min(item.max, available));
  }
  return {
    id: `lesson-${document.lessonId}`,
    lessonId: document.lessonId,
    title: document.title,
    section: `Part ${document.moduleId}: ${document.moduleTitle} · ${best?.section || 'Core concept'}`,
    excerpt: excerpt.slice(0, MAX_EXCERPT_CHARS),
    href: `#lesson/${document.lessonId}`,
    references: document.references.map(source => ({ ...source })),
  };
}

/** Retrieve authored, relevant course context. No network or learner data. */
export function retrieveCourse(question, { lessonId, limit = 4 } = {}) {
  if (typeof question !== 'string' || !question.trim()) return [];
  const parsedLimit = Number(limit);
  const boundedLimit = Number.isFinite(parsedLimit) ? Math.max(0, Math.min(MAX_RESULTS, Math.floor(parsedLimit))) : 4;
  if (!boundedLimit) return [];
  const terms = queryTerms(question);
  if (!terms.length) return [];
  const currentLesson = Number.isInteger(Number(lessonId)) ? Number(lessonId) : null;
  const ranked = documents.map(document => rankDocument(document, terms, currentLesson)).filter(Boolean)
    .sort((a, b) => b.score - a.score || b.coverage - a.coverage || a.document.lessonId - b.document.lessonId);
  if (!ranked.length) return [];
  // Avoid padding a good answer with weakly related, generic tail results.
  return ranked.filter(result => result.score >= ranked[0].score * 0.3)
    .slice(0, boundedLimit).map(result => citation(result, terms));
}

export const retrievalStats = Object.freeze({
  lessonCount: documents.length,
  vocabularySize: documentFrequency.size,
  maxResults: MAX_RESULTS,
  maxExcerptChars: MAX_EXCERPT_CHARS,
  maxQueryChars: MAX_QUERY_CHARS,
  indexedSources: Object.freeze(['lessons', 'details', 'implementation', 'prompts', 'correct quiz reasoning', 'diagram explanations', 'module metadata', 'glossary', 'official reference metadata']),
});
