'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as course from '../lib/course.mjs';
import interactions from '../lib/interactions.json';
import * as gameData from '../lib/game-data';
import { normalizeLanguage, translateText, localizeValue } from '../lib/language.mjs';

const LanguageContext = createContext(null);
let dictionaryPromise;
function loadDictionary() {
  dictionaryPromise ||= import('../lib/hinglish.json').then(module => module.default);
  return dictionaryPromise;
}

function localizedCourse(localize, workspace) {
  const localized = localize({ lessons: workspace?.lessons || course.lessons, reference: course.reference, activities: course.activities, interactions: workspace?.interactions || interactions, ...gameData });
  const lessonById = id => localized.lessons.find(lesson => Number(lesson.id) === Number(id));
  const moduleLessons = id => localized.lessons.filter(lesson => Number(lesson.module_id) === Number(id));
  return { ...course, ...localized, lessonById, moduleLessons, lessonsForModule: moduleLessons,
    moduleById: id => localized.reference.modules.find(module => Number(module.id) === Number(id)),
    nextLesson: id => localized.lessons[localized.lessons.findIndex(lesson => Number(lesson.id) === Number(id)) + 1],
    previousLesson: id => localized.lessons[localized.lessons.findIndex(lesson => Number(lesson.id) === Number(id)) - 1],
  };
}

export function LanguageProvider({ language: selectedLanguage = 'en', onLanguageChange, workspace, children }) {
  const language = normalizeLanguage(selectedLanguage);
  const [dictionary, setDictionary] = useState(null);
  const [translationError, setTranslationError] = useState(false);
  useEffect(() => {
    document.documentElement.lang = language === 'hinglish' ? 'hi-Latn' : 'en';
  }, [language]);
  useEffect(() => {
    if (language !== 'hinglish' || dictionary) return;
    let active = true;
    loadDictionary().then(value => { if (active) { setDictionary(value); setTranslationError(false); } }).catch(() => { if (active) setTranslationError(true); });
    return () => { active = false; };
  }, [language, dictionary]);
  const t = useCallback(value => translateText(value, language, dictionary || {}), [language, dictionary]);
  const localize = useCallback(value => localizeValue(value, language, dictionary || {}), [language, dictionary]);
  const setLanguage = useCallback(value => onLanguageChange?.(normalizeLanguage(value)), [onLanguageChange]);
  const courseData = useMemo(() => localizedCourse(localize, workspace), [localize, workspace]);
  const value = useMemo(() => ({ language, t, localize, setLanguage, course: courseData, loadingLanguage: language === 'hinglish' && !dictionary && !translationError, translationError }), [language, t, localize, setLanguage, courseData, dictionary, translationError]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('Language controls must be rendered inside LanguageProvider.');
  return context;
}

export function useCourse() {
  return useLanguage().course;
}
