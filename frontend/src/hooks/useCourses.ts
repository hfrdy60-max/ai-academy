import { useCallback, useEffect, useState } from "react";
import { getCourse, listCourses } from "../services/courseService";
import { errMsg } from "../lib/errors";
import type { Course } from "../types/course";

/** All courses. `courses === null` means still loading. */
export function useCourseList() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try { setCourses(await listCourses()); setError(null); }
    catch (e) { setError(errMsg(e)); setCourses([]); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  return { courses, error, reload };
}

/** One course. `course === undefined` + `loading === false` means not found. */
export function useCourse(id: string | undefined) {
  const [course, setCourse] = useState<Course | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const c = id ? await getCourse(id) : undefined;
        if (!cancelled) { setCourse(c); setError(null); }
      } catch (e) {
        if (!cancelled) setError(errMsg(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  return { course, loading, error, setCourse };
}
