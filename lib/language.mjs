export const LANGUAGES = ['en', 'hinglish'];
export const normalizeLanguage = value => value === 'hinglish' ? 'hinglish' : 'en';

// Small interface translations are available before the optional course dictionary loads.
export const interfaceTranslations = {
  'Settings': 'Settings', 'Language': 'Bhasha', 'Course language': 'Course ki bhasha',
  'Choose how you want to learn.': 'Jis bhasha mein seekhna aasaan lage, use chunein.',
  'Your language preference is saved in this browser and included in progress exports.': 'Aapki bhasha is browser mein save hoti hai aur progress export mein bhi aati hai.',
  'English': 'English', 'Hinglish (Hindi in English letters)': 'Hinglish (Hindi in English letters)',
  'Hinglish is loading…': 'Hinglish load ho rahi hai…',
  'Translations could not load. English content is still available; reload to try again.': 'Translation load nahi hui. English content available hai; dobara try karne ke liye reload karein.',
  'Code, URLs, lesson IDs and your own notes stay unchanged.': 'Code, URLs, lesson IDs aur aapke khud ke notes waise hi rehte hain.',
  'Learning path': 'Seekhne ka raasta', 'Course tutor': 'Course tutor', 'Practice studio': 'Practice studio',
  'Backend arcade': 'Backend games', 'Interactive labs': 'Interactive labs', 'Prompt workshop': 'Prompt workshop',
  'Reference desk': 'Reference desk', 'Foundation': 'Buniyaad', 'Practical': 'Practical',
  'Your progress': 'Aapki progress', 'Export': 'Export', 'Import': 'Import',
  'Learn. Explain. Verify.': 'Seekho. Samjhao. Verify karo.', 'Search lessons': 'Lessons khojein',
  'Find a concept...': 'Koi concept khojein...', 'Focus mode': 'Focus mode', 'Enter focus mode': 'Focus mode kholein',
  'Exit focus mode': 'Focus mode band karein', 'Open navigation': 'Navigation kholein', 'Close navigation': 'Navigation band karein',
  'Skip to learning content': 'Seedha learning content par jaayein', 'Course parts': 'Course ke parts',
  'Main navigation': 'Main navigation', 'Search the fieldguide': 'Fieldguide mein khojein',
  'Your learning path': 'Aapka learning path', 'The backend arcade': 'Backend games',
  'Reduced motion on': 'Animations kam hain', 'Reduce animations': 'Animations kam karein',
  'Learn a little. Build understanding.': 'Thoda seekho. Samajh badhao.',
  'Understand': 'Samjhein', 'Explore': 'Explore karein', 'Solve': 'Solve karein', 'Apply': 'Apply karein',
  'Inspect': 'Jaanch karein', 'Plan': 'Plan banayein', 'Implement': 'Implement karein', 'Debug': 'Debug karein',
  'Verify': 'Verify karein', 'Review': 'Review karein', 'Previous': 'Pichhla', 'Next': 'Agla',
  'Continue': 'Aage badhein', 'Continue lesson': 'Lesson jaari rakhein', 'Complete lesson': 'Lesson poora karein',
  'Mark incomplete': 'Adhoora mark karein', 'Mark complete': 'Poora mark karein',
  'Check answer': 'Answer check karein', 'Check my answer': 'Mera answer check karein',
  'Try again': 'Dobara try karein', 'Reset': 'Reset', 'Replay': 'Dobara khelein',
  'Reveal answer': 'Answer dekhein', 'Show answer': 'Answer dekhein', 'Hide answer': 'Answer chhupayein',
  'Copy prompt': 'Prompt copy karein', 'Copied': 'Copy ho gaya', 'Your notes': 'Aapke notes',
  'Save your takeaway': 'Apni seekh likhein', 'Back to learning path': 'Learning path par laut jaayein',
  'Let’s start learning': 'Chaliye seekhna shuru karein', 'Continue your journey': 'Apni journey jaari rakhein',
  'Revisit the course': 'Course dobara dekhein', 'At your own pace': 'Apni speed se seekhein',
  'Keep your curiosity going': 'Apni curiosity jaari rakhein', 'A fresh start': 'Ek nayi shuruaat',
  'Ready to explore': 'Explore karne ke liye taiyaar', 'Your next chapter': 'Aapka agla chapter',
  'Begin this part': 'Yeh part shuru karein', 'Keep going': 'Aage badhte rahein', 'Revisit this part': 'Yeh part dobara dekhein',
  'Every part is open to explore': 'Har part explore karne ke liye khula hai',
  'Enter the arcade': 'Games kholein', 'Open the sandbox': 'Lab kholein', 'Build your prompt': 'Apna prompt banayein',
  'Enter the practice studio': 'Practice studio kholein', 'Open the reference desk': 'Reference desk kholein',
  'New to all of this?': 'Yeh sab aapke liye naya hai?', 'Earned': 'Haasil kiya',
  'Chapter complete': 'Chapter poora hua', 'Lessons completed': 'Lessons poore hue',
  'Begin this chapter': 'Yeh chapter shuru karein', 'Continue this chapter': 'Yeh chapter jaari rakhein',
  'Revisit the first lesson': 'Pehla lesson dobara dekhein', 'Take a game break': 'Thoda game khelein',
  'All missions': 'Saare missions', 'To explore': 'Abhi explore karna hai', 'Completed': 'Poore hue',
  'Start mission': 'Mission shuru karein', 'Revisit mission': 'Mission dobara dekhein',
  'Back to missions': 'Missions par laut jaayein', 'Next case': 'Agla case', 'Finish mission': 'Mission poora karein',
  'Choose an answer': 'Ek answer chunein', 'Evidence': 'Evidence', 'What would you do?': 'Aap kya karenge?',
  'Check order': 'Order check karein', 'Check placements': 'Placement check karein',
  'Play again': 'Dobara khelein', 'Play game': 'Game khelein', 'Back to arcade': 'Games par laut jaayein',
  'Next round': 'Agla round', 'Show explanation': 'Explanation dekhein', 'Mission complete': 'Mission poora hua',
  'Loading': 'Load ho raha hai', 'Search': 'Khojein', 'Clear': 'Saaf karein',
};

const structuralKeys = new Set(['id', 'ids', 'module_id', 'moduleId', 'track', 'kind', 'type', 'simulator', 'color', 'url', 'href', 'src', 'icon', 'code', 'language', 'currency', 'variant', 'store', 'correct', 'start', 'orderStart', 'layer', 'category', 'target', 'targetId']);

export function translateText(value, language = 'en', dictionary = {}) {
  if (normalizeLanguage(language) === 'en' || typeof value !== 'string' || ['Backend Fieldguide', 'Fieldstore', 'harshitgupta31415'].includes(value.trim())) return value;
  const key = value.trim();
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
