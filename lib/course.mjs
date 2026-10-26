import lessons from './lessons.json' with { type: 'json' };
import reference from './reference.json' with { type: 'json' };
import activities from './activities.json' with { type: 'json' };

export { lessons, reference, activities };
export const LESSON_XP = 20;
export const GAME_XP = 100;
export const PRACTICE_XP = 50;
export const lessonIdSet = new Set(lessons.map(lesson => Number(lesson.id)));
export const activityIdSet = new Set(activities.map(activity => activity.id));
export const moduleLessons = id => lessons.filter(lesson => Number(lesson.module_id) === Number(id));
export const lessonById = id => lessons.find(lesson => Number(lesson.id) === Number(id));
export const nextLesson = id => lessons[lessons.findIndex(lesson => Number(lesson.id) === Number(id)) + 1];
export const previousLesson = id => lessons[lessons.findIndex(lesson => Number(lesson.id) === Number(id)) - 1];
export const earnedXP = data => data.completed.length * LESSON_XP + data.achievements.length * GAME_XP + (data.practice || []).length * PRACTICE_XP;
