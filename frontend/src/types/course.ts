export type Level = "beginner" | "intermediate" | "advanced";

export const LEVELS: { value: Level; label: string }[] = [
  { value: "beginner", label: "مبتدی" },
  { value: "intermediate", label: "متوسط" },
  { value: "advanced", label: "پیشرفته" }
];
export const levelLabel = (l: Level): string => LEVELS.find(x => x.value === l)?.label ?? l;

export interface Exercise { question: string; hint: string; sampleAnswer: string }
export interface QuizItem { question: string; options: string[]; correctIndex: number; explanation: string }

/** Teaching content of one lesson (written by AI and/or edited by the learner). */
export interface LessonContent {
  intro: string;
  objectives: string[];
  explanation: string;
  examples: string[];
  notes: string[];
  exercises: Exercise[];
  quiz: QuizItem[];
  summary: string;
}

export type ContentSource = "ai" | "edited" | "manual";

export interface Lesson {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: number;
  content?: LessonContent;
  contentSource?: ContentSource;
  contentModel?: string;      // AI model that wrote it (when known)
  contentUpdatedAt?: number;
}

export interface Chapter {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  title: string;
  description: string;
  subject: string;
  level: Level;
  goal: string;
  chapters: Chapter[];
  lastLessonId?: string; // where the learner stopped (used by "continue learning")
  isDemo: boolean;       // true for sample data created by the "demo courses" button
  createdAt: number;
  updatedAt: number;
}
