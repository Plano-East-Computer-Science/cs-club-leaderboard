/**
 * Every course in the Learn area, in catalog order. To add one, write
 * courses/<id>.js (see ../schema.js and docs/next-lessons.md) and list it here.
 */
import apcsa from './apcsa.js';

export const COURSES = [apcsa];

export const findCourse = (id) => COURSES.find((c) => c.id === id) || null;

export function findLesson(courseId, lessonId) {
  const course = findCourse(courseId);
  for (const unit of course?.units || []) {
    const lesson = unit.lessons.find((l) => l.id === lessonId);
    if (lesson) return { course, unit, lesson };
  }
  return null;
}
