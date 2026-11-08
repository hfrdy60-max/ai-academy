export type IconName =
  | "home" | "book" | "sparkles" | "chat" | "gamepad" | "exam"
  | "chart" | "settings" | "more" | "sun" | "moon" | "cap" | "target" | "trophy" | "plus" | "trash" | "play" | "check" | "back"
  | "edit" | "refresh" | "send" | "up" | "down" | "download" | "upload" | "search";

export interface NavItem {
  path: string;
  label: string;   // full label (sidebar, page title)
  short: string;   // short label (mobile bottom bar)
  icon: IconName;
  milestone: number; // milestone in which the page will be built
  primary: boolean;  // true = shown in the mobile bottom bar
}
