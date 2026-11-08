import { Link } from "react-router-dom";
import Icon from "./Icon";
import ProgressBar from "./ProgressBar";
import { fa } from "../lib/format";
import { courseProgress, nextLesson } from "../services/courseService";
import { levelLabel } from "../types/course";
import type { Course } from "../types/course";

export default function CourseCard({ course, onDelete }: { course: Course; onDelete: (c: Course) => void }) {
  const p = courseProgress(course);
  const next = nextLesson(course);
  const href = next ? `/courses/${course.id}/lessons/${next.lessonId}` : `/courses/${course.id}`;
  const cta = p.total === 0 ? "مشاهده دوره" : p.done === 0 ? "شروع یادگیری" : next ? "ادامه یادگیری" : "مرور دوره";
  return (
    <article className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-base font-bold leading-snug">
          <Link to={`/courses/${course.id}`} className="hover:underline">{course.title}</Link>
        </h2>
        {course.isDemo && <span className="badge shrink-0">آزمایشی</span>}
      </div>
      <p className="muted text-sm">{course.subject} · {levelLabel(course.level)}</p>
      <div>
        <ProgressBar value={p.done} max={p.total} label={`پیشرفت ${course.title}`} />
        <p className="muted mt-1 text-xs">
          {p.total === 0 ? "هنوز درسی ندارد" : `${fa(p.done)} از ${fa(p.total)} درس (${fa(p.percent)}٪)`}
        </p>
      </div>
      <div className="mt-auto flex gap-2">
        <Link to={href} className="btn btn-primary flex-1"><Icon name="play" className="h-4 w-4" />{cta}</Link>
        <button type="button" className="btn btn-ghost" aria-label={`حذف دوره ${course.title}`} onClick={() => onDelete(course)}>
          <Icon name="trash" className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
