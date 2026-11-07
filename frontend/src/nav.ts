import type { NavItem } from "./types/nav";

export const NAV: NavItem[] = [
  { path: "/", label: "داشبورد", short: "داشبورد", icon: "home", milestone: 1, primary: true },
  { path: "/courses", label: "دوره‌های من", short: "دوره‌ها", icon: "book", milestone: 2, primary: true },
  { path: "/create", label: "ساخت دوره", short: "ساخت", icon: "sparkles", milestone: 4, primary: true },
  { path: "/teacher", label: "معلم هوشمند", short: "معلم", icon: "chat", milestone: 4, primary: true },
  { path: "/games", label: "بازی‌های آموزشی", short: "بازی‌ها", icon: "gamepad", milestone: 5, primary: true },
  { path: "/exams", label: "آزمون‌ها", short: "آزمون‌ها", icon: "exam", milestone: 5, primary: false },
  { path: "/progress", label: "پیشرفت من", short: "پیشرفت", icon: "chart", milestone: 6, primary: false },
  { path: "/settings", label: "تنظیمات", short: "تنظیمات", icon: "settings", milestone: 3, primary: false }
];
