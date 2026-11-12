export interface ExamResult {
  id: string;
  date: number;
  correct: number;
  total: number;
  percent: number;
}

export interface GameResult {
  id: string;
  date: number;
  points: number;
  correct: number;
  answered: number;
  bestStreak: number;
}

export const EXAM_RESULTS_KEY = "ai-academy:exam-results:v1";
export const GAME_RESULTS_KEY = "ai-academy:game-results:v1";
const HISTORY_LIMIT = 20;

export function isExamResult(value: unknown): value is ExamResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const x = value as Record<string, unknown>;
  return typeof x.id === "string" && x.id.length > 0 && x.id.length <= 100 &&
    Number.isSafeInteger(x.date) && (x.date as number) >= 0 &&
    Number.isSafeInteger(x.correct) && Number.isSafeInteger(x.total) && Number.isSafeInteger(x.percent) &&
    (x.correct as number) >= 0 && (x.total as number) > 0 && (x.correct as number) <= (x.total as number) &&
    x.percent === Math.round((x.correct as number) / (x.total as number) * 100);
}

export function isGameResult(value: unknown): value is GameResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const x = value as Record<string, unknown>;
  return typeof x.id === "string" && x.id.length > 0 && x.id.length <= 100 &&
    Number.isSafeInteger(x.date) && (x.date as number) >= 0 &&
    Number.isSafeInteger(x.points) && Number.isSafeInteger(x.correct) &&
    Number.isSafeInteger(x.answered) && Number.isSafeInteger(x.bestStreak) &&
    (x.points as number) >= 0 && (x.correct as number) >= 0 && (x.answered as number) > 0 &&
    (x.correct as number) <= (x.answered as number) &&
    (x.bestStreak as number) >= 0 && (x.bestStreak as number) <= (x.answered as number) &&
    x.points === (x.correct as number) * 10;
}

function readHistory<T>(key: string, valid: (value: unknown) => value is T): T[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(parsed) ? parsed.filter(valid).slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

export const readExamHistory = (): ExamResult[] => readHistory(EXAM_RESULTS_KEY, isExamResult);
export const readGameHistory = (): GameResult[] => readHistory(GAME_RESULTS_KEY, isGameResult);

export function mergeHistories<T extends { id: string; date: number }>(
  local: T[], remote: unknown[], valid: (value: unknown) => value is T
): T[] {
  const byId = new Map<string, T>();
  for (const item of [...local, ...remote]) {
    if (!valid(item)) continue;
    const previous = byId.get(item.id);
    if (!previous || item.date > previous.date) byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => b.date - a.date).slice(0, HISTORY_LIMIT);
}

function notifyResultsChanged(): void {
  window.dispatchEvent(new Event("ai-academy-results-change"));
  window.dispatchEvent(new Event("ai-academy-data-change"));
}

export function writeExamHistory(records: ExamResult[]): void {
  const safe = mergeHistories([], records, isExamResult);
  localStorage.setItem(EXAM_RESULTS_KEY, JSON.stringify(safe));
  notifyResultsChanged();
}

export function writeGameHistory(records: GameResult[]): void {
  const safe = mergeHistories([], records, isGameResult);
  localStorage.setItem(GAME_RESULTS_KEY, JSON.stringify(safe));
  notifyResultsChanged();
}

export function writeSyncedHistories(exams: ExamResult[], games: GameResult[]): void {
  // Preserve the old values if the browser rejects either write.
  const previousExam = localStorage.getItem(EXAM_RESULTS_KEY);
  const previousGame = localStorage.getItem(GAME_RESULTS_KEY);
  try {
    localStorage.setItem(EXAM_RESULTS_KEY, JSON.stringify(mergeHistories([], exams, isExamResult)));
    localStorage.setItem(GAME_RESULTS_KEY, JSON.stringify(mergeHistories([], games, isGameResult)));
  } catch (error) {
    try {
      if (previousExam === null) localStorage.removeItem(EXAM_RESULTS_KEY);
      else localStorage.setItem(EXAM_RESULTS_KEY, previousExam);
      if (previousGame === null) localStorage.removeItem(GAME_RESULTS_KEY);
      else localStorage.setItem(GAME_RESULTS_KEY, previousGame);
    } catch { /* best-effort rollback */ }
    throw error;
  }
  notifyResultsChanged();
}
