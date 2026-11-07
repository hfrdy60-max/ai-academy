import { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import type { NavItem } from "../types/nav";
import Icon from "./Icon";

interface Props { items: NavItem[]; open: boolean; onClose: () => void }

/** Mobile bottom sheet with the secondary navigation items. */
export default function MoreSheet({ items, open, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    ref.current?.querySelector<HTMLElement>("a")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 md:hidden">
      <button type="button" aria-label="بستن منو" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label="بخش‌های بیشتر"
           className="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-slate-200 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] dark:border-white/10 dark:bg-[#121833]">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-300 dark:bg-white/20" aria-hidden="true" />
        <ul className="space-y-1">
          {items.map(n => (
            <li key={n.path}>
              <NavLink to={n.path} onClick={onClose}
                className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-medium ${isActive ? "bg-indigo-600 text-white" : "text-slate-700 dark:text-slate-200"}`}>
                <Icon name={n.icon} />{n.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
