import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TeacherChat from "../components/TeacherChat";
import { useCourseList } from "../hooks/useCourses";
import { contentToText } from "../lib/lessonText";
import { threadId } from "../services/chatService";
import { LEVELS } from "../types/course";
import type { Level } from "../types/course";

export default function Teacher() {
  const { courses } = useCourseList();
  const [courseId, setCourseId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [freeLevel, setFreeLevel] = useState<Level>("beginner");

  const course = courses?.find(c => c.id === courseId);
  const lessons = useMemo(() => course?.chapters.flatMap(ch => ch.lessons.map(l => ({ ...l, chapter: ch.title }))) ?? [], [course]);
  const lesson = lessons.find(l => l.id === lessonId);
  const key = course ? (lesson ? threadId.lesson(course.id, lesson.id) : threadId.course(course.id)) : threadId.general;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-xl font-extrabold md:text-2xl">معلم هوشمند</h1>
      <p className="muted text-sm leading-7">هر سؤالی دارید بپرسید. اگر دوره یا درسی را انتخاب کنید، معلم با توجه به همان موضوع و سطح پاسخ می‌دهد و گفتگوی هر درس جداگانه ذخیره می‌شود. قبل از استفاده، اتصال را در <Link to="/settings" className="underline">تنظیمات</Link> انجام دهید.</p>

      <div className="card grid gap-3 sm:grid-cols-3">
        <div><label htmlFor="t-course" className="mb-1 block text-sm font-bold">دوره</label>
          <select id="t-course" className="input" value={courseId} onChange={e => { setCourseId(e.target.value); setLessonId(""); }}>
            <option value="">بدون دوره (سؤال آزاد)</option>
            {courses?.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select></div>
        {course ? (
          <div><label htmlFor="t-lesson" className="mb-1 block text-sm font-bold">درس</label>
            <select id="t-lesson" className="input" value={lessonId} onChange={e => setLessonId(e.target.value)}>
              <option value="">کل دوره</option>
              {lessons.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select></div>
        ) : (
          <div><label htmlFor="t-level" className="mb-1 block text-sm font-bold">سطح شما</label>
            <select id="t-level" className="input" value={freeLevel} onChange={e => setFreeLevel(e.target.value as Level)}>
              {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select></div>
        )}
      </div>

      <TeacherChat threadKey={key} level={course ? course.level : freeLevel}
        context={course ? { courseTitle: course.title, subject: course.subject, goal: course.goal, lessonTitle: lesson?.title, lessonText: lesson?.content ? contentToText(lesson.content) : "" } : {}}
        suggestions={["این را ساده‌تر توضیح بده", "یک مثال کاربردی بزن", "چند تمرین برایم بساز", "مرحله‌به‌مرحله آموزش بده"]} />
    </div>
  );
}
