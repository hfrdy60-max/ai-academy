import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { getCachedAccount, logoutAccount } from "../services/accountService";
import { isAccountSyncInProgress, syncAccountData } from "../services/syncService";
import { NAV } from "../nav";
import { useTheme } from "../hooks/useTheme";
import Icon from "./Icon";
import MoreSheet from "./MoreSheet";

const APP_NAME = "آکادمی هوش مصنوعی";
const PRIMARY = NAV.filter(n => n.primary);
const SECONDARY = NAV.filter(n => !n.primary);

const sideLink = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
    isActive ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"}`;

const tabLink = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${
    isActive ? "font-bold text-indigo-600 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400"}`;

export default function Layout() {
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const account = getCachedAccount();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  const moreBtn = useRef<HTMLButtonElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const changed = () => {
      if (isAccountSyncInProgress()) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void syncAccountData().catch(() => { /* manual sync remains available */ }); }, 1800);
    };
    window.addEventListener("ai-academy-data-change", changed);
    return () => { window.removeEventListener("ai-academy-data-change", changed); if (timer) clearTimeout(timer); };
  }, []);

  const closeMore = useCallback(() => { setMoreOpen(false); moreBtn.current?.focus(); }, []);

  // On route change: update the page title and move focus to the content (screen readers).
  useEffect(() => {
    const item = NAV.find(n => n.path === pathname);
    document.title = item && item.path !== "/" ? `${item.label} | ${APP_NAME}` : APP_NAME;
    if (first.current) { first.current = false; return; }
    setMoreOpen(false);
    mainRef.current?.focus();
  }, [pathname]);

  const moreActive = SECONDARY.some(n => n.path === pathname);

  return (
    <div className="min-h-dvh md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:right-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-white"
         onClick={e => { e.preventDefault(); mainRef.current?.focus(); }}>پرش به محتوای اصلی</a>

      <aside className="hidden w-64 shrink-0 border-l border-slate-200 p-4 md:block dark:border-white/10">
        <div className="mb-6 flex items-center gap-2 px-2 text-lg font-extrabold">
          <Icon name="cap" className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />{APP_NAME}
        </div>
        <nav aria-label="منوی اصلی">
          <ul className="space-y-1">
            {NAV.map(n => (
              <li key={n.path}><NavLink to={n.path} end={n.path === "/"} className={sideLink}><Icon name={n.icon} />{n.label}</NavLink></li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/85 px-4 py-2 backdrop-blur md:justify-end dark:border-white/10 dark:bg-[#0b1020]/85">
          <span className="flex items-center gap-2 font-extrabold md:hidden">
            <Icon name="cap" className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />{APP_NAME}
          </span>
          <div className="flex items-center gap-2">
          {account && <span className="hidden max-w-44 truncate text-xs text-slate-500 sm:inline" dir="ltr">{account.email}</span>}
          <button type="button" disabled={syncing} onClick={() => { setSyncing(true); setSyncMessage(""); void syncAccountData().then(r => setSyncMessage(`${r.courses} دوره و ${r.chats} گفتگو همگام شد.`)).catch(e => setSyncMessage(e instanceof Error ? e.message : "همگام‌سازی ناموفق بود.")).finally(() => setSyncing(false)); }} className="btn btn-ghost min-h-10 text-xs">{syncing ? "در حال همگام‌سازی…" : "همگام‌سازی"}</button>
          <button type="button" onClick={() => { void logoutAccount().finally(() => navigate("/login", { replace: true })); }} className="btn btn-ghost min-h-10 text-xs">خروج</button>
          <button type="button" onClick={toggle} aria-pressed={dark}
                  className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm dark:border-white/20">
            <Icon name={dark ? "sun" : "moon"} className="h-4 w-4" />{dark ? "حالت روشن" : "حالت تیره"}
          </button>
          </div>
          {syncMessage && <span className="px-3 pb-1 text-xs text-slate-500" role="status">{syncMessage}</span>}
        </header>
        <main id="main" ref={mainRef} tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 p-4 pb-28 outline-none md:p-8 md:pb-8">
          <div key={pathname} className="page-enter"><Outlet /></div>
        </main>
      </div>

      <nav aria-label="منوی موبایل"
           className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden dark:border-white/10 dark:bg-[#0b1020]">
        <ul className="grid grid-cols-6">
          {PRIMARY.map(n => (
            <li key={n.path}><NavLink to={n.path} end={n.path === "/"} className={tabLink}><Icon name={n.icon} />{n.short}</NavLink></li>
          ))}
          <li>
            <button ref={moreBtn} type="button" aria-haspopup="dialog" aria-expanded={moreOpen}
                    onClick={() => setMoreOpen(o => !o)} className={`w-full ${tabLink({ isActive: moreActive })}`}>
              <Icon name="more" />بیشتر
            </button>
          </li>
        </ul>
      </nav>
      <MoreSheet items={SECONDARY} open={moreOpen} onClose={closeMore} />
    </div>
  );
}
