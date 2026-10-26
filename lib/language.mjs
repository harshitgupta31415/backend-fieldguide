import interfaceLabels from './interface-labels.json' with { type: 'json' };

export const LANGUAGES = ['en', 'hinglish'];
export const normalizeLanguage = value => value === 'hinglish' ? 'hinglish' : 'en';

// Labels and headings stay English; Hinglish is reserved for explanatory content.
export const interfaceTranslations = Object.fromEntries(interfaceLabels.map(label => [label, label]));
const protectedInterfaceLabels = new Set(interfaceLabels.map(label => label.toLowerCase()));


const structuralKeys = new Set(['id', 'ids', 'module_id', 'moduleId', 'track', 'kind', 'type', 'simulator', 'color', 'url', 'href', 'src', 'icon', 'code', 'language', 'currency', 'variant', 'store', 'correct', 'start', 'orderStart', 'layer', 'category', 'target', 'targetId', 'title', 'name', 'label', 'module_title', 'term', 'tag', 'nodes']);

export function translateText(value, language = 'en', dictionary = {}) {
  if (normalizeLanguage(language) === 'en' || typeof value !== 'string' || ['Backend Fieldguide', 'Fieldstore', 'harshitgupta31415'].includes(value.trim())) return value;
  const key = value.trim();
  if (protectedInterfaceLabels.has(key.toLowerCase())) return value;
  const translated = Object.hasOwn(dictionary, key) ? dictionary[key] : interfaceTranslations[key];
  if (typeof translated !== 'string' || !translated.trim()) return value;
  const leading = value.slice(0, value.length - value.trimStart().length);
  const trailing = value.slice(value.trimEnd().length);
  return leading + translated + trailing;
}

export function localizeValue(value, language = 'en', dictionary = {}, field = '') {
  if (normalizeLanguage(language) === 'en' || structuralKeys.has(field)) return value;
  if (typeof value === 'string') {
    if (/^(https?:\/\/|#lesson\/|#part\/)/i.test(value)) return value;
    return translateText(value, language, dictionary);
  }
  if (Array.isArray(value)) return value.map(item => localizeValue(item, language, dictionary, field));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, localizeValue(child, language, dictionary, key)]));
  return value;
}
